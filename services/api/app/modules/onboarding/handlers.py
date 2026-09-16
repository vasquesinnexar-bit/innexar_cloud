"""Onboarding handlers (P1.3): e-mail completo, website, manual."""

from __future__ import annotations

import logging
import re

from sqlalchemy import select

from app.modules.onboarding.enums import OnboardingType
from app.modules.onboarding.registry import StepDef, StepResult, register

logger = logging.getLogger(__name__)

DOMAIN_RE = re.compile(r"^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$")
LOCAL_PART_RE = re.compile(r"^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$")
CHALLENGE_HOST = "_innexar-verification"


def _norm_domain(raw: str) -> str:
    return (raw or "").strip().lower().rstrip(".")


class ProfessionalEmailOnboarding:
    """E-mail profissional: domínio → DNS → contas → ativo."""

    type = OnboardingType.PROFESSIONAL_EMAIL.value

    def steps(self) -> list[StepDef]:
        return [
            StepDef("domain", 1, required=True),
            StepDef("dns_discovery", 2, required=True, auto=True),
            StepDef("dns_setup", 3, required=True),
            StepDef("dns_verification", 4, required=True),
            StepDef("mailbox_setup", 5, required=True),
            StepDef("provisioning", 6, required=True, auto=True),
            StepDef("validation", 7, required=True, auto=True),
        ]

    async def submit(self, db, session, step_key, data, *, actor_type, actor_id):
        if step_key == "domain":
            return await self._submit_domain(
                db, session, data, actor_type=actor_type, actor_id=actor_id
            )
        if step_key == "dns_setup":
            return await self._submit_dns_setup(
                db, session, data, actor_type=actor_type, actor_id=actor_id
            )
        if step_key == "dns_verification":
            return await self._run_verification(db, session)
        if step_key == "mailbox_setup":
            return await self._submit_mailboxes(
                db, session, data, actor_type=actor_type, actor_id=actor_id
            )
        return StepResult(ok=False, error="etapa automática ou desconhecida")

    async def auto_run(self, db, session, step_key: str) -> StepResult:
        if step_key == "dns_discovery":
            return await self._run_discovery(db, session)
        if step_key == "dns_verification":
            return await self._run_verification(db, session)
        if step_key == "provisioning":
            return await self._run_provisioning(db, session)
        if step_key == "validation":
            return await self._run_validation(db, session)
        return StepResult(ok=True)

    # -- domain ---------------------------------------------------------
    async def _submit_domain(self, db, session, data, *, actor_type, actor_id):
        from app.modules.mail.models import EmailDomain
        from app.modules.mail.service import MailService
        from app.modules.onboarding.service import verification_token

        raw = (data or {}).get("domain", "")
        domain = _norm_domain(raw)
        if "@" in raw or not DOMAIN_RE.match(domain):
            return StepResult(ok=False, error="Domínio inválido (ex.: empresa.com.br)")
        existing = (
            (await db.execute(select(EmailDomain).where(EmailDomain.domain == domain)))
            .scalars()
            .first()
        )
        if existing and existing.customer_id != session.customer_id:
            return StepResult(ok=False, error="Domínio já vinculado a outro cliente")
        if existing and existing.customer_id == session.customer_id:
            return StepResult(
                ok=True,
                step_data={"domain": domain, "ownership": "linked"},
            )
        proof = await self._ownership_proof(db, session.customer_id, domain)
        if proof[0] == "denied":
            return StepResult(ok=False, error=proof[1])
        token = None
        if proof[0] == "challenge":
            token = verification_token(session.customer_id, domain)
        svc = MailService(db)
        try:
            await svc.claim_domain(
                customer_id=session.customer_id,
                org_id=session.org_id,
                domain=domain,
                actor_type=actor_type,
                actor_id=actor_id,
            )
        except Exception as e:  # noqa: BLE001
            return StepResult(ok=False, error=str(e)[:300])
        return StepResult(
            ok=True,
            step_data={
                "domain": domain,
                "ownership": proof[0],
                "ownership_detail": proof[1],
                "challenge_host": (f"{CHALLENGE_HOST}.{domain}" if token else None),
                "challenge_value": token,
            },
        )

    async def _ownership_proof(self, db, customer_id: int, domain: str):
        """Prova de controle sem assumir: MX próprio, TXT challenge ou vínculo staff."""
        from app.modules.mail.models import EmailDomain

        linked = (
            (
                await db.execute(
                    select(EmailDomain).where(
                        EmailDomain.domain == domain,
                        EmailDomain.customer_id == customer_id,
                    )
                )
            )
            .scalars()
            .first()
        )
        if linked:
            return ("linked", "domínio já vinculado a este cliente")
        other = (
            (await db.execute(select(EmailDomain).where(EmailDomain.domain == domain)))
            .scalars()
            .first()
        )
        if other:
            return ("denied", "Domínio já vinculado a outro cliente")
        try:
            import dns.resolver

            res = dns.resolver.Resolver()
            res.lifetime = res.timeout = 8
            mx = sorted(
                str(r.exchange).rstrip(".").lower() for r in res.resolve(domain, "MX")
            )
            if f"mail.{domain}" in mx or "mail.innexar.com.br" in mx:
                return ("mx", "MX já aponta para a Innexar")
            try:
                txts = [
                    "".join(
                        p.decode() if isinstance(p, bytes) else str(p)
                        for p in r.strings
                    )
                    for r in res.resolve(f"{CHALLENGE_HOST}.{domain}", "TXT")
                ]
            except Exception:  # noqa: BLE001 (sem challenge = segue fluxo)
                txts = []
            if any("innexar-verification=" in t for t in txts):
                return ("challenge-ok", "challenge TXT encontrado")
        except Exception:  # noqa: BLE001 (DNS ausente = challenge)
            pass
        return ("challenge", "adicione o TXT de verificação")

    async def check_challenge(self, db, domain: str, token: str) -> bool:
        if not token:
            return False
        try:
            import dns.resolver

            res = dns.resolver.Resolver()
            res.lifetime = res.timeout = 8
            txts = [
                "".join(
                    p.decode() if isinstance(p, bytes) else str(p) for p in r.strings
                )
                for r in res.resolve(f"{CHALLENGE_HOST}.{domain}", "TXT")
            ]
            return token in "".join(txts)
        except Exception:  # noqa: BLE001
            return False

        # -- discovery / verification ----------------------------------------

    async def _domain_from_steps(self, db, session) -> str | None:
        from sqlalchemy import select as _select

        from app.modules.onboarding.models import OnboardingStep

        row = (
            (
                await db.execute(
                    _select(OnboardingStep).where(
                        OnboardingStep.onboarding_id == session.id,
                        OnboardingStep.step_key == "domain",
                    )
                )
            )
            .scalars()
            .first()
        )
        if row and isinstance(row.data, dict):
            return row.data.get("domain")
        return None

    async def _run_discovery(self, db, session) -> StepResult:
        from app.modules.onboarding import dns_discovery

        domain = await self._domain_from_steps(db, session)
        if not domain:
            return StepResult(ok=False, error="domínio ausente")
        result = dns_discovery.discover(domain)
        return StepResult(ok=True, step_data=result)

    async def _submit_dns_setup(
        self, db, session, data, *, actor_type, actor_id
    ) -> StepResult:
        method = ((data or {}).get("method") or "manual").strip().lower()
        if method not in ("manual", "cloudflare"):
            return StepResult(ok=False, error="method deve ser manual|cloudflare")
        return StepResult(ok=True, step_data={"method": method})

    async def _run_verification(self, db, session) -> StepResult:
        from sqlalchemy import select as _select

        from app.modules.mail.service import check_domain_dns
        from app.modules.onboarding.models import OnboardingStep

        domain = await self._domain_from_steps(db, session)
        if not domain:
            return StepResult(ok=False, error="domínio ausente")
        row = (
            (
                await db.execute(
                    _select(OnboardingStep).where(
                        OnboardingStep.onboarding_id == session.id,
                        OnboardingStep.step_key == "domain",
                    )
                )
            )
            .scalars()
            .first()
        )
        data = dict((row.data or {}) if row else {})
        if (
            data.get("ownership") == "challenge"
            and data.get("challenge_value")
            and await self.check_challenge(db, domain, data["challenge_value"])
        ):
            data["ownership"] = "challenge-ok"
            data["challenge_value"] = None
            data["challenge_host"] = None
            if row:
                row.data = data
                await db.flush()
        result = check_domain_dns(domain)
        checks = dict(result.get("checks", {}) or {})
        all_ok = bool(checks.pop("all_ok", False))
        if all_ok:
            return StepResult(ok=True, step_data={"checks": checks})
        missing = sorted(k for k, v in checks.items() if not v.get("ok"))
        return StepResult(
            ok=False,
            error=f"DNS pendente: {', '.join(missing) or 'verificar'}",
        )

    # -- mailboxes ---------------------------------------------------------
    async def _submit_mailboxes(
        self, db, session, data, *, actor_type, actor_id
    ) -> StepResult:
        from app.modules.mail.service import MailService

        domain = await self._domain_from_steps(db, session)
        if not domain:
            return StepResult(ok=False, error="domínio ausente")
        requested = (data or {}).get("mailboxes") or []
        if not isinstance(requested, list) or not requested:
            return StepResult(
                ok=False, error="informe ao menos 1 conta (decisão: mín. 1)"
            )
        svc = MailService(db)
        try:
            ent = await svc.entitlement(session.customer_id, session.org_id)
        except Exception as e:  # noqa: BLE001
            return StepResult(ok=False, error=f"entitlement indisponível: {e}")
        contracted = int(ent.get("contracted") or 0)
        used = int(ent.get("used") or 0)
        if used + len(requested) > contracted:
            return StepResult(
                ok=False,
                error=f"limite: {contracted} contratadas, {used} em uso",
            )
        created = []
        for entry in requested:
            if not isinstance(entry, dict):
                return StepResult(ok=False, error="conta inválida")
            local = (entry.get("local_part") or "").strip().lower()
            password = entry.get("password") or ""
            if not LOCAL_PART_RE.match(local):
                return StepResult(ok=False, error=f"conta inválida: {local}")
            if len(password) < 8:
                return StepResult(
                    ok=False,
                    error=f"defina uma senha segura para {local} (mín. 8)",
                )
            try:
                m = await svc.create_mailbox(
                    customer_id=session.customer_id,
                    org_id=session.org_id,
                    domain=domain,
                    local_part=local,
                    display_name=(entry.get("display_name") or "").strip() or None,
                    password=password,
                    quota=entry.get("quota"),
                    actor_type=actor_type,
                    actor_id=actor_id,
                )
            except Exception as e:  # noqa: BLE001 (ex.: duplicada, limite)
                return StepResult(ok=False, error=str(e)[:300])
            created.append(m.address if hasattr(m, "address") else local)
        return StepResult(ok=True, step_data={"mailboxes": created})

    # -- provisioning / validation ------------------------------------------
    async def _run_provisioning(self, db, session) -> StepResult:
        from app.modules.mail.service import MailService

        svc = MailService(db)
        try:
            usage = svc.mailbox_usage()
        except Exception as e:  # noqa: BLE001
            return StepResult(ok=False, error=f"provider indisponível: {e}")
        domain = await self._domain_from_steps(db, session)
        boxes = (
            (await db.execute(select_box_query(session.customer_id, domain)))
            .scalars()
            .all()
            if domain
            else []
        )
        missing = [
            b.address
            for b in boxes
            if (b.address or "").lower() not in {k.lower() for k in usage}
        ]
        if missing:
            return StepResult(
                ok=False,
                error=f"caixas ausentes no provedor: {', '.join(missing[:5])}",
            )
        return StepResult(ok=True, step_data={"verified": len(boxes)})

    async def _run_validation(self, db, session) -> StepResult:
        from app.modules.mail.models import EmailMailbox
        from app.modules.mail.models import Service as MailServiceModel
        from app.modules.mail.service import check_domain_dns

        domain = await self._domain_from_steps(db, session)
        if not domain:
            return StepResult(ok=False, error="domínio ausente")
        dns = check_domain_dns(domain)
        checks = dict(dns.get("checks", {}) or {})
        if not checks.pop("all_ok", False):
            return StepResult(ok=False, error="DNS ainda inválido")
        active = (
            await db.execute(
                select(EmailMailbox.id).where(
                    EmailMailbox.customer_id == session.customer_id,
                    EmailMailbox.status == "active",
                )
            )
        ).first()
        if not active:
            return StepResult(ok=False, error="nenhuma mailbox ativa")
        svc = (
            (
                await db.execute(
                    select(MailServiceModel).where(
                        MailServiceModel.customer_id == session.customer_id,
                        MailServiceModel.status == "pending",
                    )
                )
            )
            .scalars()
            .first()
        )
        if svc:
            from app.core.datetime_utils import utc_now
            from app.modules.mail.enums import MailServiceStatus

            svc.status = MailServiceStatus.ACTIVE.value
            svc.activated_at = utc_now()
            await db.flush()
        return StepResult(ok=True, step_data={"domain": domain})


def select_box_query(customer_id: int, domain: str):
    from sqlalchemy import select as _select

    from app.modules.mail.models import EmailDomain, EmailMailbox

    return _select(EmailMailbox).where(
        EmailMailbox.customer_id == customer_id,
        EmailMailbox.email_domain_id.in_(
            _select(EmailDomain.id).where(
                EmailDomain.customer_id == customer_id,
                EmailDomain.domain == domain,
            )
        ),
    )


class WebsiteProjectOnboarding:
    """Projeto: briefing via fluxo existente; hook completa a etapa."""

    type = "website_project"

    def steps(self):
        from app.modules.onboarding.registry import StepDef

        return [StepDef("briefing", 1, required=True)]

    async def submit(self, db, session, step_key, data, *, actor_type, actor_id):
        from app.modules.onboarding.registry import StepResult

        return StepResult(ok=False, error="briefing pelo fluxo do Portal")


class ManualOnboarding:
    """Genérico mínimo (paid traffic etc.): coleta futura; concluível."""

    type = "manual"

    def steps(self):
        from app.modules.onboarding.registry import StepDef

        return [StepDef("details", 1, required=False)]

    async def submit(self, db, session, step_key, data, *, actor_type, actor_id):
        from app.modules.onboarding.registry import StepResult

        return StepResult(ok=True, step_data={"note": "manual"})


def register_all() -> None:

    register(ProfessionalEmailOnboarding.type, ProfessionalEmailOnboarding)
    register(WebsiteProjectOnboarding.type, WebsiteProjectOnboarding)
    register(ManualOnboarding.type, ManualOnboarding)
