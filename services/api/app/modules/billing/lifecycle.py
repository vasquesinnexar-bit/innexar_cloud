"""Ciclo de vida financeiro: past_due → grace → suspend → reactivate + reconciliação.

Tudo idempotente (re-execução segura). Timezone: UTC interno; período de cobrança
no timezone do contrato (default por org).
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import log_audit
from app.models.customer import Customer
from app.models.customer_user import CustomerUser
from app.modules.billing import policy as billing_policy
from app.modules.billing.enums import (
    ContractStatus,
    InvoiceStatus,
    SubscriptionStatus,
)
from app.modules.billing.models import Contract, Invoice, Subscription
from app.modules.billing.notify_templates import render
from app.modules.mail.enums import MailServiceStatus, MailboxStatus
from app.modules.mail.models import EmailMailbox, Service
from app.modules.notifications.service import (
    create_notification_and_maybe_send_email,
)

logger = logging.getLogger(__name__)

ORG_TIMEZONES = {"innexar-br": "America/Sao_Paulo", "innexar": "America/New_York"}


def contract_tz(contract_org: str, contract_tz: str | None = None) -> ZoneInfo:
    try:
        return ZoneInfo(contract_tz or ORG_TIMEZONES.get(contract_org, "UTC"))
    except ZoneInfoNotFoundError:
        return ZoneInfo("UTC")


def _locale_for(customer: Customer) -> str:
    loc = (customer.locale or "").strip()
    if loc in ("pt-BR", "en-US"):
        return loc
    return "pt-BR" if (customer.country or "").upper() == "BR" else "en-US"


def _money(total: float, currency: str, locale: str) -> str:
    symbol = {"BRL": "R$", "USD": "US$"}.get((currency or "USD").upper(), "")
    return f"{symbol} {float(total):.2f}".strip()


async def _customer_users(db: AsyncSession, customer_id: int) -> list[CustomerUser]:
    rows = (
        await db.execute(
            select(CustomerUser).where(CustomerUser.customer_id == customer_id)
        )
    ).scalars().all()
    return list(rows)


async def notify_customer(
    db: AsyncSession,
    customer: Customer,
    key: str,
    *,
    background_tasks=None,
    org_id: str = "innexar",
    **kwargs,
) -> int:
    """Notificação in_app (+email quando configurado) para todos os usuários do cliente."""
    locale = _locale_for(customer)
    title, body = render(key, locale, name=customer.name, **kwargs)
    users = await _customer_users(db, customer.id)
    if not users:
        return 0
    sent = 0
    for cu in users:
        if background_tasks is not None:
            await create_notification_and_maybe_send_email(
                db, background_tasks, customer_user_id=cu.id, channel="in_app+email",
                title=title, body=body, recipient_email=cu.email, org_id=org_id,
                email_locale=locale,
            )
        else:
            # CLI: cria in_app e envia e-mail direto (sem BackgroundTasks)
            from app.models.notification import Notification
            from app.providers.email.loader import get_email_provider

            db.add(Notification(customer_user_id=cu.id, channel="in_app",
                                title=title, body=body))
            provider = await get_email_provider(db, org_id=org_id)
            if provider and cu.email:
                try:
                    provider.send(cu.email, title, body, body)
                except Exception:  # noqa: BLE001
                    logger.warning("falha ao enviar email p/ %s", cu.email)
        sent += 1
    await db.flush()
    return sent


async def _reminded(inv: Invoice, key: str) -> bool:
    return bool((inv.reminders_sent or {}).get(key))


async def _mark_reminded(db: AsyncSession, inv: Invoice, key: str) -> None:
    inv.reminders_sent = {**(inv.reminders_sent or {}), key: True}
    await db.flush()


async def mark_past_due(db: AsyncSession, *, background_tasks=None) -> int:
    """PENDING vencidas → PAST_DUE + aviso. Idempotente."""
    now = datetime.now(UTC)
    rows = (
        await db.execute(
            select(Invoice, Customer).join(
                Customer, Customer.id == Invoice.customer_id
            ).where(
                Invoice.status == InvoiceStatus.PENDING.value,
                Invoice.due_date < now,
            )
        )
    ).all()
    count = 0
    for inv, cust in rows:
        inv.status = InvoiceStatus.PAST_DUE.value
        await log_audit(
            db, entity="invoice", entity_id=str(inv.id), action="invoice_past_due",
            actor_type="system", actor_id="lifecycle",
            payload={"due_date": inv.due_date.isoformat()},
        )
        await notify_customer(
            db, cust, "invoice_overdue", background_tasks=background_tasks,
            org_id=cust.org_id,
            id=inv.id, total=_money(inv.total, inv.currency, _locale_for(cust)),
            due=inv.due_date.date().isoformat(),
        )
        count += 1
    await db.flush()
    return count


async def send_reminders(db: AsyncSession, *, background_tasks=None) -> int:
    """Lembretes antes/depois do vencimento conforme policy (sem duplicar)."""
    now = datetime.now(UTC)
    rows = (
        await db.execute(
            select(Invoice, Customer).join(
                Customer, Customer.id == Invoice.customer_id
            ).where(
                Invoice.status.in_([
                    InvoiceStatus.PENDING.value, InvoiceStatus.PAST_DUE.value]),
            )
        )
    ).all()
    sent = 0
    for inv, cust in rows:
        pol = await billing_policy.resolve_policy(db, org_id=cust.org_id)
        total = _money(inv.total, inv.currency, _locale_for(cust))
        due = inv.due_date.date().isoformat()
        days = (inv.due_date.date() - now.date()).days
        if days > 0:
            for d in pol["reminder_days_before"]:
                key = f"before_{d}"
                if days <= d and not await _reminded(inv, key):
                    k = "invoice_due_today" if days == 0 else "invoice_due_soon"
                    await notify_customer(
                        db, cust, k, background_tasks=background_tasks,
                        org_id=cust.org_id, id=inv.id, total=total, due=due,
                        days=days,
                    )
                    await _mark_reminded(db, inv, key)
                    sent += 1
        elif days == 0 and not await _reminded(inv, "today"):
            await notify_customer(
                db, cust, "invoice_due_today", background_tasks=background_tasks,
                org_id=cust.org_id, id=inv.id, total=total, due=due, days=0,
            )
            await _mark_reminded(db, inv, "today")
            sent += 1
        else:
            overdue_days = -days
            for d in pol["reminder_days_after"]:
                key = f"after_{d}"
                if overdue_days >= d and not await _reminded(inv, key):
                    await notify_customer(
                        db, cust, "invoice_overdue",
                        background_tasks=background_tasks, org_id=cust.org_id,
                        id=inv.id, total=total, due=due,
                    )
                    await _mark_reminded(db, inv, key)
                    sent += 1
                    break
    await db.flush()
    return sent


async def suspend_overdue(db: AsyncSession, *, background_tasks=None) -> int:
    """PAST_DUE além de suspend_after_days → suspende Service/Contract (sem destruir)."""
    now = datetime.now(UTC)
    rows = (
        await db.execute(
            select(Invoice, Customer).join(
                Customer, Customer.id == Invoice.customer_id
            ).where(Invoice.status == InvoiceStatus.PAST_DUE.value)
        )
    ).all()
    count = 0
    for inv, cust in rows:
        pol = await billing_policy.resolve_policy(db, org_id=cust.org_id)
        overdue_days = (now.date() - inv.due_date.date()).days
        if overdue_days < pol["suspend_after_days"]:
            if overdue_days >= max(pol["suspend_after_days"] - 2, 0):
                key = "susp_warn"
                if not await _reminded(inv, key):
                    await notify_customer(
                        db, cust, "service_suspension_warning",
                        background_tasks=background_tasks, org_id=cust.org_id,
                        days=pol["suspend_after_days"] - overdue_days, id=inv.id,
                    )
                    await _mark_reminded(db, inv, key)
            continue
        # Suspende services de e-mail do cliente (desabilita caixas, preserva dados).
        from app.modules.mail.provider import DockerMailserverProvider

        provider = DockerMailserverProvider()
        suspended_here = 0
        services = (
            await db.execute(
                select(Service).where(
                    Service.customer_id == cust.id,
                    Service.status == "active",
                )
            )
        ).scalars().all()
        for svc in services:
            boxes = (
                await db.execute(
                    select(EmailMailbox).where(
                        EmailMailbox.service_id == svc.id,
                        EmailMailbox.status == "active",
                    )
                )
            ).scalars().all()
            for box in boxes:
                try:
                    provider.disable_mailbox(box.address)
                except Exception:  # noqa: BLE001
                    logger.warning("falha ao suspender %s", box.address)
                box.status = "disabled"
            svc.status = "suspended"
            svc.suspended_at = now
            suspended_here += 1
            await log_audit(
                db, entity="service", entity_id=str(svc.id),
                action="service_suspended", actor_type="system",
                actor_id="lifecycle", payload={"invoice_id": inv.id},
            )
            from app.modules.fulfillment.facade import (
                sync_service_event as _sync_fulfillment,
            )

            await _sync_fulfillment(db, contract_item_id=None,
                                    service_id=svc.id, suspended=True,
                                    actor_type="system", actor_id="lifecycle")
        contracts = (
            await db.execute(
                select(Contract).where(
                    Contract.customer_id == cust.id,
                    Contract.status == "active",
                )
            )
        ).scalars().all()
        for contract in contracts:
            contract.status = "suspended"
            await log_audit(
                db, entity="contract", entity_id=str(contract.id),
                action="contract_suspended", actor_type="system",
                actor_id="lifecycle", payload={"invoice_id": inv.id},
            )
        # Só notifica suspensão se algo foi efetivamente suspenso.
        # Fase 4: hosting (docker stop reversível, preserva tudo).
        from app.modules.hosting.enums import HostingServiceStatus
        from app.modules.hosting.models import HostingService
        from app.modules.hosting.provider import DockerHostingProvider

        hprovider = DockerHostingProvider()
        hosting_suspended = 0
        hservices = (
            await db.execute(
                select(HostingService).where(
                    HostingService.customer_id == cust.id,
                    HostingService.status == HostingServiceStatus.ACTIVE.value,
                )
            )
        ).scalars().all()
        for hsvc in hservices:
            try:
                if hsvc.container_name:
                    hprovider.stop(hsvc.container_name)
                hsvc.status = HostingServiceStatus.SUSPENDED.value
                hosting_suspended += 1
                await log_audit(
                    db, entity="hosting_service", entity_id=str(hsvc.id),
                    action="hosting_suspended", actor_type="system",
                    actor_id="lifecycle", payload={"invoice_id": inv.id},
                )
                from app.modules.fulfillment.facade import (
                    sync_service_event as _sync_fulfillment,
                )

                await _sync_fulfillment(
                    db, contract_item_id=hsvc.contract_item_id,
                    service_id=None, suspended=True,
                    actor_type="system", actor_id="lifecycle")
                await notify_customer(
                    db, cust, "hosting_suspended",
                    background_tasks=background_tasks, org_id=cust.org_id,
                    domain=hsvc.primary_domain or hsvc.container_name or "",
                )
            except Exception:  # noqa: BLE001
                logger.warning("falha ao suspender hosting %s", hsvc.id)
        if suspended_here or contracts or hosting_suspended:
            if not hosting_suspended:
                await notify_customer(
                    db, cust, "service_suspended", background_tasks=background_tasks,
                    org_id=cust.org_id, id=inv.id,
                )
            count += 1
    await db.flush()
    return count


async def reactivate_customer(
    db: AsyncSession, customer_id: int, *, background_tasks=None
) -> int:
    """Pagamento confirmado: reativa services/contratos suspensos (idempotente)."""
    cust = (
        await db.execute(select(Customer).where(Customer.id == customer_id))
    ).scalar_one_or_none()
    if not cust:
        return 0
    from app.modules.mail.provider import DockerMailserverProvider

    provider = DockerMailserverProvider()
    reactivated = 0
    services = (
        await db.execute(
            select(Service).where(
                Service.customer_id == customer_id,
                Service.status == "suspended",
            )
        )
    ).scalars().all()
    for svc in services:
        boxes = (
            await db.execute(
                select(EmailMailbox).where(
                    EmailMailbox.service_id == svc.id,
                    EmailMailbox.status == "disabled",
                )
            )
        ).scalars().all()
        for box in boxes:
            try:
                provider.enable_mailbox(box.address)
            except Exception:  # noqa: BLE001
                logger.warning("falha ao reativar %s", box.address)
                continue
            box.status = "active"
        svc.status = "active"
        svc.suspended_at = None
        svc.activated_at = datetime.now(UTC)
        await log_audit(
            db, entity="service", entity_id=str(svc.id),
            action="service_reactivated", actor_type="system",
            actor_id="lifecycle",
        )
        from app.modules.fulfillment.facade import (
            sync_service_event as _sync_fulfillment,
        )

        await _sync_fulfillment(db, contract_item_id=None,
                                service_id=svc.id, suspended=False,
                                actor_type="system", actor_id="lifecycle")
        reactivated += 1
    contracts = (
        await db.execute(
            select(Contract).where(
                Contract.customer_id == customer_id,
                Contract.status == "suspended",
            )
        )
    ).scalars().all()
    for contract in contracts:
        contract.status = "active"
    mail_reactivated = reactivated
    # Fase 4: reativa hosting suspenso (docker start, idempotente).
    from app.modules.hosting.enums import HostingServiceStatus
    from app.modules.hosting.models import HostingService
    from app.modules.hosting.provider import DockerHostingProvider

    hprovider = DockerHostingProvider()
    hservices = (
        await db.execute(
            select(HostingService).where(
                HostingService.customer_id == customer_id,
                HostingService.status == HostingServiceStatus.SUSPENDED.value,
            )
        )
    ).scalars().all()
    for hsvc in hservices:
        try:
            if hsvc.container_name:
                hprovider.start(hsvc.container_name)
        except Exception:  # noqa: BLE001
            logger.warning("falha ao reativar hosting %s", hsvc.id)
            continue
        hsvc.status = HostingServiceStatus.ACTIVE.value
        await log_audit(
            db, entity="hosting_service", entity_id=str(hsvc.id),
            action="hosting_reactivated", actor_type="system",
            actor_id="lifecycle",
        )
        from app.modules.fulfillment.facade import (
            sync_service_event as _sync_fulfillment,
        )

        await _sync_fulfillment(
            db, contract_item_id=hsvc.contract_item_id,
            service_id=None, suspended=False,
            actor_type="system", actor_id="lifecycle")
        reactivated += 1
        await notify_customer(
            db, cust, "hosting_reactivated", background_tasks=background_tasks,
            org_id=cust.org_id,
            domain=hsvc.primary_domain or hsvc.container_name or "",
        )
    if mail_reactivated:
        await notify_customer(
            db, cust, "service_reactivated", background_tasks=background_tasks,
            org_id=cust.org_id,
        )
    await db.flush()
    return reactivated


async def reconcile(db: AsyncSession) -> dict:
    """Compara pendentes com o provider oficial; corrige divergências."""
    from app.modules.billing.models import PaymentAttempt
    from app.providers.payments.mercadopago import MercadoPagoProvider
    from app.providers.payments.stripe import StripeProvider

    fixed = {"invoices_paid": 0, "attempts_failed": 0, "checked": 0}
    attempts = (
        await db.execute(
            select(PaymentAttempt).where(PaymentAttempt.status == "pending")
        )
    ).scalars().all()
    for att in attempts:
        fixed["checked"] += 1
        inv = await db.get(Invoice, att.invoice_id)
        if not inv:
            continue
        if att.provider == "mercadopago" and att.external_id:
            pay = MercadoPagoProvider().get_payment(att.external_id)
            if not pay:
                continue
            st = (pay.get("status") or "").lower()
            if st == "approved" and inv.status != "paid":
                inv.status = InvoiceStatus.PAID.value
                inv.paid_at = datetime.now(UTC)
                att.status = "approved"
                att.paid_at = datetime.now(UTC)
                fixed["invoices_paid"] += 1
                await reactivate_customer(db, inv.customer_id)
            elif st in ("expired", "cancelled", "rejected", "refunded",
                        "charged_back"):
                att.status = "failed" if st != "refunded" else "refunded"
                att.failure_code = f"mp:{st}"
                fixed["attempts_failed"] += 1
        elif att.provider == "stripe" and att.external_id:
            try:
                sess = StripeProvider().get_checkout_session(att.external_id)
            except Exception:  # noqa: BLE001
                continue
            if sess.get("payment_status") == "paid" and inv.status != "paid":
                inv.status = InvoiceStatus.PAID.value
                inv.paid_at = datetime.now(UTC)
                att.status = "approved"
                att.paid_at = datetime.now(UTC)
                fixed["invoices_paid"] += 1
                await reactivate_customer(db, inv.customer_id)
    await db.flush()
    return fixed
