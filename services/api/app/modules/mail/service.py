"""MailService: central business logic for Professional Email.

Portal -> API -> MailService -> DockerMailserverProvider -> mailserver.
All logic lives here, never in routers. Passwords are never stored or logged.
"""

from __future__ import annotations

import logging
import re
import secrets

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.audit import log_audit
from app.core.datetime_utils import utc_now
from app.core.encryption import decrypt_value, encrypt_value
from app.models.audit_log import AuditLog  # noqa: F401 (register model)
from app.models.customer import Customer
from app.modules.billing.models import (
    Contract,
    ContractItem,
    Invoice,
    PricePlan,
    Product,
)
from app.modules.mail.enums import (
    EmailDomainStatus,
    MailboxStatus,
    MailJobStatus,
    MailJobType,
    MailServiceStatus,
)
from app.modules.mail.models import (
    EmailDomain,
    EmailMailbox,
    MailProvisioningJob,
    Service,
)
from app.modules.mail.provider import DockerMailserverProvider, MailProviderError

logger = logging.getLogger(__name__)

EMAIL_PRODUCT_SLUGS = ("professional-email",)
EMAIL_PRODUCT_CATEGORIES = ("email",)
LOCAL_PART_RE = re.compile(r"^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$")
DOMAIN_RE = re.compile(r"^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$")
MIN_PASSWORD_LEN = 8
DKIM_SELECTOR = "mail"
MAIL_IPV4 = "173.212.248.236"


class MailError(Exception):
    """Domain error with a stable code for the frontend (§28)."""

    def __init__(self, code: str, detail: str = "", extra: dict | None = None):
        super().__init__(detail or code)
        self.code = code
        self.detail = detail or code
        self.extra = extra or {}


def check_domain_dns(domain: str) -> dict:
    """Valida MX/SPF/DKIM/DMARC via DNS público (nunca levanta exceção).

    Tolerante: verifica presença + conteúdo plausível, não igualdade exata
    (cliente pode ter outros TXT como google-site-verification).
    """
    domain = _norm_domain(domain)
    checks: dict[str, dict] = {}

    def _txt(name: str) -> list[str]:
        try:
            import dns.resolver

            res = dns.resolver.Resolver()
            res.lifetime = res.timeout = 8
            out = []
            for r in res.resolve(name, "TXT"):
                out.append(
                    "".join(
                        p.decode() if isinstance(p, bytes) else str(p)
                        for p in r.strings
                    )
                )
            return out
        except Exception:  # noqa: BLE001 (DNS ausente = check falho, não erro)
            return []

    def _mx() -> list[str]:
        try:
            import dns.resolver

            res = dns.resolver.Resolver()
            res.lifetime = res.timeout = 8
            return sorted(
                str(r.exchange).rstrip(".").lower() for r in res.resolve(domain, "MX")
            )
        except Exception:  # noqa: BLE001
            return []

    mx = _mx()
    mx_ok = any(m == f"mail.{domain}" or m.endswith(f".{domain}") for m in mx)
    checks["mx"] = {
        "ok": mx_ok,
        "found": mx,
        "expected": f"10 mail.{domain}",
        "hint": "MX deve apontar para mail." + domain,
    }
    txts = _txt(domain)
    spf = [t for t in txts if t.lower().startswith("v=spf1")]
    spf_ok = any(
        ("mx" in t.lower() and (MAIL_IPV4 in t or f"mail.{domain}" in t.lower()))
        for t in spf
    )
    checks["spf"] = {
        "ok": spf_ok,
        "found": spf,
        "expected": f"v=spf1 mx a:mail.{domain} ip4:{MAIL_IPV4} -all",
        "hint": "SPF precisa autorizar nosso MX/IP",
    }
    dkim = _txt(f"{DKIM_SELECTOR}._domainkey.{domain}")
    dkim_ok = any("v=dkim1" in t.lower().replace(" ", "") for t in dkim)
    checks["dkim"] = {
        "ok": dkim_ok,
        "found": [t[:80] + ("…" if len(t) > 80 else "") for t in dkim],
        "expected": f"{DKIM_SELECTOR}._domainkey.{domain} TXT (chave do mailserver)",
        "hint": "DKIM é gerado no mailserver (mail-admin)",
    }
    dmarc = _txt(f"_dmarc.{domain}")
    dmarc_ok = any("v=dmarc1" in t.lower().replace(" ", "") for t in dmarc)
    checks["dmarc"] = {
        "ok": dmarc_ok,
        "found": dmarc,
        "expected": f"v=DMARC1; p=quarantine; rua=mailto:postmaster@{domain}",
        "hint": "DMARC protege contra spoofing",
    }
    checks["all_ok"] = all(c["ok"] for c in checks.values() if isinstance(c, dict))
    return {"domain": domain, "checks": checks}


def _norm_domain(domain: str) -> str:
    return (domain or "").strip().lower().rstrip(".")


def _validate_password(password: str) -> None:
    if not password or len(password) < MIN_PASSWORD_LEN:
        raise MailError(
            "invalid_email_password",
            f"Senha deve ter no mínimo {MIN_PASSWORD_LEN} caracteres",
        )


class MailService:
    """Professional Email business logic. Depends on AsyncSession only."""

    def __init__(
        self, db: AsyncSession, provider: DockerMailserverProvider | None = None
    ):
        self._db = db
        self._provider = provider or DockerMailserverProvider()

    # -- internal helpers -------------------------------------------------
    async def _audit(
        self,
        *,
        entity: str,
        entity_id: str | None,
        action: str,
        actor_type: str,
        actor_id: str | None,
        org_id: str,
        payload: dict | None = None,
    ) -> None:
        await log_audit(
            self._db,
            entity=entity,
            entity_id=entity_id,
            action=action,
            actor_type=actor_type,
            actor_id=actor_id,
            org_id=org_id,
            payload=payload,
        )

    async def _get_domain(
        self, customer_id: int, org_id: str, domain: str
    ) -> EmailDomain | None:
        domain = _norm_domain(domain)
        r = await self._db.execute(
            select(EmailDomain).where(
                EmailDomain.customer_id == customer_id,
                EmailDomain.org_id == org_id,
                EmailDomain.domain == domain,
            )
        )
        return r.scalar_one_or_none()

    async def _require_domain(
        self, customer_id: int, org_id: str, domain: str
    ) -> EmailDomain:
        d = await self._get_domain(customer_id, org_id, domain)
        if not d:
            raise MailError(
                "email_domain_not_configured",
                f"Domínio {domain} não configurado para este cliente",
            )
        return d

    async def _get_mailbox(
        self, mailbox_id: int, customer_id: int, org_id: str
    ) -> EmailMailbox | None:
        r = await self._db.execute(
            select(EmailMailbox)
            .options(selectinload(EmailMailbox.email_domain))
            .where(
                EmailMailbox.id == mailbox_id,
                EmailMailbox.customer_id == customer_id,
                EmailMailbox.org_id == org_id,
            )
        )
        return r.scalar_one_or_none()

    async def _require_mailbox(
        self, mailbox_id: int, customer_id: int, org_id: str
    ) -> EmailMailbox:
        m = await self._get_mailbox(mailbox_id, customer_id, org_id)
        if not m:
            # IDOR-safe: same error whether missing or foreign.
            raise MailError("unauthorized_mailbox_access", "Mailbox não encontrada")
        return m

    def _email_products_q(self):
        return select(Product).where(
            (Product.slug.in_(EMAIL_PRODUCT_SLUGS))
            | (Product.category.in_(EMAIL_PRODUCT_CATEGORIES))
        )

    async def entitlement(
        self, customer_id: int, org_id: str, domain: str | None = None
    ) -> dict:
        """Contracted vs used mailboxes (+ price reference)."""
        cust = (
            await self._db.execute(
                select(Customer).where(
                    Customer.id == customer_id, Customer.org_id == org_id
                )
            )
        ).scalar_one_or_none()
        if not cust:
            raise MailError("unauthorized_mailbox_access", "Cliente não encontrado")
        currency = (
            cust.currency or ("BRL" if cust.org_id == "innexar-br" else "USD")
        ).upper()

        products = (await self._db.execute(self._email_products_q())).scalars().all()
        product_ids = [p.id for p in products]
        contracted = 0
        unit_price: float | None = None
        price_currency = currency
        if product_ids:
            items = (
                await self._db.execute(
                    select(ContractItem, Contract)
                    .join(Contract, Contract.id == ContractItem.contract_id)
                    .where(
                        Contract.customer_id == customer_id,
                        Contract.status.in_(["active", "pending"]),
                        ContractItem.product_id.in_(product_ids),
                    )
                )
            ).all()
            # billing_type por plano (setup one_time não consome licença).
            plan_ids = {item.price_plan_id for item, _ in items if item.price_plan_id}
            plan_by_id: dict[int, str] = {}
            if plan_ids:
                for p in (
                    await self._db.execute(
                        select(PricePlan.id, PricePlan.billing_type).where(
                            PricePlan.id.in_(plan_ids)
                        )
                    )
                ).all():
                    plan_by_id[p[0]] = p[1] or ""
            for item, _contract in items:
                # Setup (one_time) é cobrança comercial, não licença de mailbox.
                plan_bt = (
                    (plan_by_id.get(item.price_plan_id) or "").lower()
                    if item.price_plan_id
                    else ""
                )
                if plan_bt == "one_time":
                    continue
                contracted += item.quantity or 0
            # preço de referência: plano mensal recorrente na moeda do cliente
            plans = (
                (
                    await self._db.execute(
                        select(PricePlan).where(
                            PricePlan.product_id.in_(product_ids),
                            PricePlan.currency == currency,
                        )
                    )
                )
                .scalars()
                .all()
            )
            monthly = [
                p
                for p in plans
                if (p.billing_type or "recurring") == "recurring"
                and (p.interval or "") == "monthly"
            ]
            ref = monthly[0] if monthly else (plans[0] if plans else None)
            if ref:
                unit_price = float(ref.amount)
                price_currency = ref.currency
        used_q: list = [
            EmailMailbox.customer_id == customer_id,
            EmailMailbox.status == MailboxStatus.ACTIVE.value,
        ]
        if domain:
            used_q.append(
                EmailMailbox.email_domain_id.in_(
                    select(EmailDomain.id).where(
                        EmailDomain.customer_id == customer_id,
                        EmailDomain.domain == _norm_domain(domain),
                    )
                )
            )
        used = (
            await self._db.execute(
                select(func.count()).select_from(EmailMailbox).where(*used_q)
            )
        ).scalar_one()
        return {
            "contracted": contracted,
            "used": used,
            "available": max(contracted - used, 0),
            "currency": price_currency,
            "unit_price": unit_price,
            "provider_fallback": "mercadopago" if price_currency == "BRL" else "stripe",
        }

    # -- domains ----------------------------------------------------------
    async def claim_domain(
        self,
        *,
        customer_id: int,
        org_id: str,
        domain: str,
        contract_item_id: int | None = None,
        actor_type: str,
        actor_id: str | None,
    ) -> EmailDomain:
        """Reivindica domínio (status pending) sem exigir presença no servidor.

        Usado pelo onboarding: o provisionamento server-side (DKIM/conta no
        mailserver) é feito pelo staff; o DNS do cliente independe disso.
        """
        domain = _norm_domain(domain)
        if not domain or "." not in domain:
            raise MailError("email_domain_not_configured", "Domínio inválido")
        existing = await self._get_domain(customer_id, org_id, domain)
        if existing:
            return existing
        d = EmailDomain(
            customer_id=customer_id,
            org_id=org_id,
            domain=domain,
            status=EmailDomainStatus.PENDING.value,
        )
        self._db.add(d)
        await self._db.flush()
        svc = await self._get_or_create_service(customer_id, org_id, contract_item_id)
        d.service_id = svc.id
        await self._audit(
            entity="email_domain",
            entity_id=str(d.id),
            action="email_domain_claimed",
            actor_type=actor_type,
            actor_id=actor_id,
            org_id=org_id,
            payload={"domain": domain},
        )
        await self._db.flush()
        return d

    async def register_domain(
        self,
        *,
        customer_id: int,
        org_id: str,
        domain: str,
        contract_item_id: int | None = None,
        actor_type: str,
        actor_id: str | None,
    ) -> EmailDomain:
        domain = _norm_domain(domain)
        if not domain or "." not in domain:
            raise MailError("email_domain_not_configured", "Domínio inválido")
        existing = await self._get_domain(customer_id, org_id, domain)
        if existing:
            if contract_item_id and not existing.service_id:
                svc = await self._get_or_create_service(
                    customer_id, org_id, contract_item_id
                )
                existing.service_id = svc.id
                await self._db.flush()
            return existing
        try:
            known = self._provider.list_domains()
        except MailProviderError as e:
            raise MailError("mail_provider_unavailable", str(e)) from e
        if domain not in known:
            raise MailError(
                "email_domain_not_configured",
                f"Domínio {domain} não existe no mailserver (DKIM/conta ausente)",
            )
        d = EmailDomain(
            customer_id=customer_id,
            org_id=org_id,
            domain=domain,
            status=EmailDomainStatus.ACTIVE.value,
        )
        self._db.add(d)
        await self._db.flush()
        d.verified_at = utc_now()
        svc = await self._get_or_create_service(customer_id, org_id, contract_item_id)
        d.service_id = svc.id
        await self._audit(
            entity="email_domain",
            entity_id=str(d.id),
            action="email_domain_added",
            actor_type=actor_type,
            actor_id=actor_id,
            org_id=org_id,
            payload={"domain": domain, "contract_item_id": contract_item_id},
        )
        await self._db.flush()
        return d

    def expected_dns_records(self, domain: str) -> dict:
        """Registros DNS que o cliente deve ter (chave DKIM real do mailserver)."""
        domain = _norm_domain(domain)
        try:
            dkim_txt = self._provider.read_dkim_txt(domain)
        except MailProviderError:
            dkim_txt = None
        return {
            "domain": domain,
            "records": [
                {"type": "MX", "host": "@", "value": f"10 mail.{domain}"},
                {
                    "type": "TXT",
                    "host": "@",
                    "value": f"v=spf1 mx a:mail.{domain} ip4:{MAIL_IPV4} -all",
                },
                {
                    "type": "TXT",
                    "host": f"{DKIM_SELECTOR}._domainkey",
                    "value": dkim_txt or "(gerar DKIM no mail-admin primeiro)",
                },
                {
                    "type": "TXT",
                    "host": "_dmarc",
                    "value": f"v=DMARC1; p=quarantine; rua=mailto:postmaster@{domain}",
                },
                {"type": "A", "host": "mail", "value": MAIL_IPV4},
            ],
            "auto_provision": "supported_when_dns_credentials",
        }

    def mailbox_usage(self) -> dict[str, dict]:
        """Uso live por endereço {address: {used, quota, pct}}. Sem exceção."""
        from app.core.ttl_cache import get as _cache_get
        from app.core.ttl_cache import put as _cache_put

        hit, cached = _cache_get("mail:usage", 60)
        if hit:
            return cached  # type: ignore[return-value]
        try:
            infos = self._provider.list_mailboxes()
        except MailProviderError:
            return {}
        out = {
            i.address.lower(): {"used": i.used, "quota": i.quota, "pct": i.pct}
            for i in infos
        }
        _cache_put("mail:usage", out)
        return out

    async def _get_or_create_service(
        self, customer_id: int, org_id: str, contract_item_id: int | None
    ) -> Service:
        r = await self._db.execute(
            select(Service).where(
                Service.customer_id == customer_id,
                Service.service_type == "professional_email",
                Service.status.in_(
                    [MailServiceStatus.PENDING.value, MailServiceStatus.ACTIVE.value]
                ),
            )
        )
        svc = r.scalars().first()
        if svc:
            return svc
        svc = Service(
            customer_id=customer_id,
            contract_item_id=contract_item_id,
            org_id=org_id,
            service_type="professional_email",
            status=MailServiceStatus.ACTIVE.value,
            provider="docker-mailserver",
            activated_at=utc_now(),
        )
        self._db.add(svc)
        await self._db.flush()
        return svc

    async def list_domains(self, customer_id: int, org_id: str) -> list[EmailDomain]:
        r = await self._db.execute(
            select(EmailDomain)
            .where(EmailDomain.customer_id == customer_id, EmailDomain.org_id == org_id)
            .order_by(EmailDomain.domain)
        )
        return list(r.scalars().all())

    # -- mailboxes --------------------------------------------------------
    async def list_mailboxes(
        self, customer_id: int, org_id: str, domain: str | None = None
    ) -> list[EmailMailbox]:
        q = (
            select(EmailMailbox)
            .options(selectinload(EmailMailbox.email_domain))
            .where(
                EmailMailbox.customer_id == customer_id,
                EmailMailbox.org_id == org_id,
                EmailMailbox.status != MailboxStatus.PENDING_PAYMENT.value,
            )
            .order_by(EmailMailbox.address)
        )
        if domain:
            q = q.where(
                EmailMailbox.email_domain_id.in_(
                    select(EmailDomain.id).where(
                        EmailDomain.customer_id == customer_id,
                        EmailDomain.domain == _norm_domain(domain),
                    )
                )
            )
        return list((await self._db.execute(q)).scalars().all())

    def _build_address(self, local_part: str, domain: str) -> str:
        local = (local_part or "").strip().lower()
        if not LOCAL_PART_RE.match(local):
            raise MailError("invalid_email_password", "Parte local do e-mail inválida")
        return f"{local}@{_norm_domain(domain)}"

    async def create_mailbox(
        self,
        *,
        customer_id: int,
        org_id: str,
        domain: str,
        local_part: str,
        display_name: str | None,
        password: str,
        quota: str | None,
        actor_type: str,
        actor_id: str | None,
    ) -> EmailMailbox:
        _validate_password(password)
        d = await self._require_domain(customer_id, org_id, domain)
        address = self._build_address(local_part, d.domain)
        ent = await self.entitlement(customer_id, org_id)
        if ent["available"] <= 0:
            raise MailError(
                "mailbox_limit_reached",
                f"Plano contratado: {ent['contracted']} contas em uso: {ent['used']}",
                extra={
                    "contracted": ent["contracted"],
                    "used": ent["used"],
                    "currency": ent["currency"],
                    "unit_price": ent["unit_price"],
                },
            )
        dup = await self._db.execute(
            select(EmailMailbox).where(EmailMailbox.address == address)
        )
        if dup.scalar_one_or_none():
            raise MailError("mailbox_exists", f"Conta {address} já existe")
        try:
            if self._provider.mailbox_exists(address):
                raise MailError(
                    "mailbox_exists", f"Conta {address} já existe no servidor"
                )
            self._provider.create_mailbox(address, password)
            if quota:
                self._provider.set_quota(address, quota)
        except MailError:
            raise
        except MailProviderError as e:
            raise MailError("mail_provisioning_failed", str(e)) from e
        m = EmailMailbox(
            customer_id=customer_id,
            org_id=org_id,
            email_domain_id=d.id,
            address=address,
            local_part=address.split("@")[0],
            display_name=(display_name or "").strip() or None,
            quota=quota,
            status=MailboxStatus.ACTIVE.value,
            external_id=address,
        )
        self._db.add(m)
        await self._db.flush()
        svc = await self._get_or_create_service(customer_id, org_id, None)
        m.service_id = svc.id
        await self._audit(
            entity="email_mailbox",
            entity_id=str(m.id),
            action="mailbox_created",
            actor_type=actor_type,
            actor_id=actor_id,
            org_id=org_id,
            payload={"address": address, "quota": quota},
        )
        await self._db.flush()
        return m

    async def change_password(
        self,
        *,
        mailbox_id: int,
        customer_id: int,
        org_id: str,
        password: str,
        actor_type: str,
        actor_id: str | None,
    ) -> EmailMailbox:
        _validate_password(password)
        m = await self._require_mailbox(mailbox_id, customer_id, org_id)
        try:
            self._provider.change_password(m.address, password)
        except MailProviderError as e:
            raise MailError("mail_provisioning_failed", str(e)) from e
        await self._audit(
            entity="email_mailbox",
            entity_id=str(m.id),
            action="mailbox_password_changed",
            actor_type=actor_type,
            actor_id=actor_id,
            org_id=org_id,
            payload={"address": m.address},
        )
        await self._db.flush()
        return m

    async def set_quota(
        self,
        *,
        mailbox_id: int,
        customer_id: int,
        org_id: str,
        quota: str | None,
        actor_type: str,
        actor_id: str | None,
    ) -> EmailMailbox:
        m = await self._require_mailbox(mailbox_id, customer_id, org_id)
        try:
            self._provider.set_quota(m.address, quota)
        except MailProviderError as e:
            raise MailError("mail_provisioning_failed", str(e)) from e
        m.quota = quota
        await self._audit(
            entity="email_mailbox",
            entity_id=str(m.id),
            action="mailbox_quota_changed",
            actor_type=actor_type,
            actor_id=actor_id,
            org_id=org_id,
            payload={"address": m.address, "quota": quota},
        )
        await self._db.flush()
        return m

    async def set_disabled(
        self,
        *,
        mailbox_id: int,
        customer_id: int,
        org_id: str,
        disabled: bool,
        actor_type: str,
        actor_id: str | None,
    ) -> EmailMailbox:
        m = await self._require_mailbox(mailbox_id, customer_id, org_id)
        try:
            if disabled:
                self._provider.disable_mailbox(m.address)
            else:
                self._provider.enable_mailbox(m.address)
        except MailProviderError as e:
            raise MailError("mail_provisioning_failed", str(e)) from e
        m.status = (
            MailboxStatus.DISABLED.value if disabled else MailboxStatus.ACTIVE.value
        )
        await self._audit(
            entity="email_mailbox",
            entity_id=str(m.id),
            action="mailbox_disabled" if disabled else "mailbox_enabled",
            actor_type=actor_type,
            actor_id=actor_id,
            org_id=org_id,
            payload={"address": m.address},
        )
        await self._db.flush()
        return m

    async def delete_mailbox(
        self,
        *,
        mailbox_id: int,
        customer_id: int,
        org_id: str,
        actor_type: str,
        actor_id: str | None,
    ) -> None:
        m = await self._require_mailbox(mailbox_id, customer_id, org_id)
        try:
            self._provider.delete_mailbox(m.address)
        except MailProviderError as e:
            raise MailError("mail_provisioning_failed", str(e)) from e
        await self._audit(
            entity="email_mailbox",
            entity_id=str(m.id),
            action="mailbox_deleted",
            actor_type=actor_type,
            actor_id=actor_id,
            org_id=org_id,
            payload={"address": m.address},
        )
        await self._db.delete(m)
        await self._db.flush()

    # -- paid additional mailbox (§29: sem cobrança automática; com confirmação) --
    async def request_additional_mailbox(
        self,
        *,
        customer_id: int,
        org_id: str,
        domain: str,
        local_part: str,
        display_name: str | None,
        password: str,
        quota: str | None,
        actor_type: str,
        actor_id: str | None,
    ) -> dict:
        """Conta além do plano: cria ContractItem + Invoice pendente + mailbox
        pending_payment + job. A mailbox só é provisionada após o pagamento
        (webhook → trigger → job). Nada é cobrado automaticamente aqui."""
        from datetime import timedelta

        _validate_password(password)
        d = await self._require_domain(customer_id, org_id, domain)
        address = self._build_address(local_part, d.domain)
        ent = await self.entitlement(customer_id, org_id)
        if ent["available"] > 0:
            # Dentro do plano: cria direto, sem cobrança.
            m = await self.create_mailbox(
                customer_id=customer_id,
                org_id=org_id,
                domain=d.domain,
                local_part=local_part,
                display_name=display_name,
                password=password,
                quota=quota,
                actor_type=actor_type,
                actor_id=actor_id,
            )
            return {
                "mailbox_id": m.id,
                "address": m.address,
                "invoice_id": None,
                "charged": False,
            }
        dup = await self._db.execute(
            select(EmailMailbox).where(EmailMailbox.address == address)
        )
        if dup.scalar_one_or_none() or self._provider.mailbox_exists(address):
            raise MailError("mailbox_exists", f"Conta {address} já existe")
        if not ent["contracted"] or ent["unit_price"] is None:
            raise MailError(
                "email_domain_not_configured",
                "Sem plano de e-mail contratado — fale com a Innexar",
            )
        cust = (
            await self._db.execute(select(Customer).where(Customer.id == customer_id))
        ).scalar_one()
        products = (await self._db.execute(self._email_products_q())).scalars().all()
        plan = None
        for p in products:
            plans = (
                (
                    await self._db.execute(
                        select(PricePlan).where(
                            PricePlan.product_id == p.id,
                            PricePlan.currency == ent["currency"],
                            PricePlan.billing_type == "recurring",
                            PricePlan.interval == "monthly",
                        )
                    )
                )
                .scalars()
                .all()
            )
            if plans:
                plan, product = plans[0], p
                break
        if plan is None:
            raise MailError(
                "email_domain_not_configured",
                f"Sem preço mensal {ent['currency']} no catálogo",
            )
        contract = (
            (
                await self._db.execute(
                    select(Contract).where(
                        Contract.customer_id == customer_id,
                        Contract.status.in_(["active", "pending"]),
                    )
                )
            )
            .scalars()
            .first()
        )
        if not contract:
            contract = Contract(
                customer_id=customer_id,
                org_id=org_id,
                status="pending",
                currency=ent["currency"],
                source="portal",
            )
            self._db.add(contract)
            await self._db.flush()
        item = ContractItem(
            contract_id=contract.id,
            product_id=product.id,
            price_plan_id=plan.id,
            description=f"Conta adicional: {address}",
            quantity=1,
            unit_amount=float(plan.amount),
            source="portal",
        )
        self._db.add(item)
        await self._db.flush()
        due = utc_now() + timedelta(days=3)
        inv = Invoice(
            customer_id=customer_id,
            status="pending",
            due_date=due,
            total=float(plan.amount),
            currency=ent["currency"],
            line_items={
                "items": [
                    {
                        "description": f"Conta adicional: {address}",
                        "quantity": 1,
                        "unit_amount": float(plan.amount),
                        "mailbox_address": address,
                        "preferred_locale": (
                            cust.locale or "pt-BR"
                            if cust.org_id == "innexar-br"
                            else "en-US"
                        ),
                    }
                ]
            },
        )
        # Lazy import: evita ciclo billing -> mail.
        from app.repositories.billing_repository import BillingRepository

        BillingRepository(self._db).add_invoice(inv)
        await self._db.flush()
        password_enc = encrypt_value(password)
        m = EmailMailbox(
            customer_id=customer_id,
            org_id=org_id,
            email_domain_id=d.id,
            address=address,
            local_part=address.split("@")[0],
            display_name=(display_name or "").strip() or None,
            quota=quota,
            status=MailboxStatus.PENDING_PAYMENT.value,
        )
        self._db.add(m)
        await self._db.flush()
        await self.enqueue_job(
            job_type=MailJobType.CREATE_MAILBOX.value,
            org_id=org_id,
            mailbox_id=m.id,
            invoice_id=inv.id,
            payload=(
                {"address": address, "quota": quota, "password_enc": password_enc}
                if password_enc
                else {"address": address, "quota": quota}
            ),
            idempotency_key=f"mail-{inv.id}-{address}",
        )
        svc = await self._get_or_create_service(customer_id, org_id, item.id)
        m.service_id = svc.id
        await self._audit(
            entity="email_mailbox",
            entity_id=str(m.id),
            action="mailbox_pending_payment",
            actor_type=actor_type,
            actor_id=actor_id,
            org_id=org_id,
            payload={"address": address, "invoice_id": inv.id},
        )
        await self._db.flush()
        return {
            "mailbox_id": m.id,
            "address": address,
            "invoice_id": inv.id,
            "total": float(plan.amount),
            "currency": ent["currency"],
            "charged": True,
        }

    # -- sync -------------------------------------------------------------
    async def sync_domain(
        self,
        *,
        customer_id: int,
        org_id: str,
        domain: str,
        actor_type: str,
        actor_id: str | None,
    ) -> dict:
        d = await self._require_domain(customer_id, org_id, domain)
        try:
            remote = {m.address.lower(): m for m in self._provider.list_mailboxes()}
        except MailProviderError as e:
            raise MailError("mail_provider_unavailable", str(e)) from e
        local = await self.list_mailboxes(customer_id, org_id, d.domain)
        local_by_addr = {m.address.lower(): m for m in local}
        created, updated, unknown_remote = 0, 0, []
        for addr, info in remote.items():
            if not addr.endswith("@" + d.domain):
                continue
            if addr not in local_by_addr:
                self._db.add(
                    EmailMailbox(
                        customer_id=customer_id,
                        org_id=org_id,
                        email_domain_id=d.id,
                        address=addr,
                        local_part=addr.split("@")[0],
                        quota=None if info.quota.strip() == "~" else info.quota,
                        status=MailboxStatus.ACTIVE.value,
                        external_id=addr,
                    )
                )
                created += 1
            else:
                m = local_by_addr[addr]
                quota = None if info.quota.strip() == "~" else info.quota
                if m.quota != quota:
                    m.quota = quota
                    updated += 1
        for addr in remote:
            if (
                "@" in addr
                and addr.endswith("@" + d.domain)
                and addr not in local_by_addr
            ):
                unknown_remote.append(addr)
        await self._db.flush()
        return {
            "created": created,
            "updated": updated,
            "remote_total": len([a for a in remote if a.endswith("@" + d.domain)]),
        }

    # -- jobs (async provisioning) ----------------------------------------
    async def enqueue_job(
        self,
        *,
        job_type: str,
        org_id: str,
        mailbox_id: int | None = None,
        invoice_id: int | None = None,
        payload: dict | None = None,
        idempotency_key: str | None = None,
    ) -> MailProvisioningJob:
        if idempotency_key:
            existing = (
                await self._db.execute(
                    select(MailProvisioningJob).where(
                        MailProvisioningJob.idempotency_key == idempotency_key
                    )
                )
            ).scalar_one_or_none()
            if existing:
                return existing
        job = MailProvisioningJob(
            mailbox_id=mailbox_id,
            invoice_id=invoice_id,
            org_id=org_id,
            job_type=job_type,
            status=MailJobStatus.PENDING.value,
            payload=payload,
            idempotency_key=idempotency_key,
        )
        self._db.add(job)
        await self._db.flush()
        return job

    async def process_pending_jobs(self, limit: int = 10) -> dict:
        """Worker: processa jobs pendentes (idempotente)."""
        rows = (
            (
                await self._db.execute(
                    select(MailProvisioningJob)
                    .where(MailProvisioningJob.status == MailJobStatus.PENDING.value)
                    .order_by(MailProvisioningJob.id)
                    .limit(limit)
                )
            )
            .scalars()
            .all()
        )
        done, failed = 0, 0
        for job in rows:
            job.status = MailJobStatus.PROCESSING.value
            job.attempts = (job.attempts or 0) + 1
            await self._db.flush()
            try:
                await self._run_job(job)
                job.status = MailJobStatus.COMPLETED.value
                job.completed_at = utc_now()
                # limpa segredo do payload após concluir
                if job.payload and "password_enc" in job.payload:
                    job.payload = {
                        k: v for k, v in job.payload.items() if k != "password_enc"
                    }
                done += 1
            except Exception as e:  # noqa: BLE001 (worker não pode morrer)
                job.status = MailJobStatus.FAILED.value
                job.last_error = str(e)[:500]
                logger.exception("mail job %s failed", job.id)
                failed += 1
            await self._db.flush()
        return {"done": done, "failed": failed}

    async def _run_job(self, job: MailProvisioningJob) -> None:
        payload = job.payload or {}
        if job.job_type == MailJobType.CREATE_MAILBOX.value:
            address = payload.get("address", "")
            if self._provider.mailbox_exists(address):
                return  # idempotente: já existe
            password_enc = payload.get("password_enc")
            password = decrypt_value(password_enc) if password_enc else None
            if not password:
                password = secrets.token_urlsafe(16)
            self._provider.create_mailbox(address, password)
            if payload.get("quota"):
                self._provider.set_quota(address, payload["quota"])
            if job.mailbox_id:
                m = await self._db.get(EmailMailbox, job.mailbox_id)
                if m:
                    m.status = MailboxStatus.ACTIVE.value
                    m.external_id = address
        elif job.job_type == MailJobType.DISABLE_MAILBOX.value:
            self._provider.disable_mailbox(payload.get("address", ""))
        elif job.job_type == MailJobType.ENABLE_MAILBOX.value:
            self._provider.enable_mailbox(payload.get("address", ""))
        elif job.job_type == MailJobType.DELETE_MAILBOX.value:
            address = payload.get("address", "")
            if self._provider.mailbox_exists(address):
                self._provider.delete_mailbox(address)
        else:
            raise MailError(
                "mail_provisioning_failed", f"job_type {job.job_type} desconhecido"
            )
