"""Webhook processing for Stripe and Mercado Pago."""

import hashlib
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import log_audit
from app.core.org import ORG_INNEXAR_US
from app.modules.billing._subscription_helpers import (
    set_subscription_next_due_if_recurring,
)
from app.modules.billing.enums import InvoiceStatus, SubscriptionStatus
from app.modules.billing.models import WebhookEvent
from app.modules.billing.overdue import reactivate_subscription_after_payment
from app.providers.payments.mercadopago import MercadoPagoProvider
from app.providers.payments.stripe import StripeProvider
from app.repositories.billing_repository import BillingRepository
from app.repositories.customer_repository import CustomerRepository


async def _org_for_invoice_customer(
    db: AsyncSession, billing_repo: BillingRepository, invoice_id: int
) -> str:
    inv = await billing_repo.get_invoice_by_id(invoice_id)
    if not inv:
        return ORG_INNEXAR_US
    customer = await CustomerRepository(db).get_by_id_with_users(
        inv.customer_id, org_id=None
    )
    if customer and customer.org_id:
        return str(customer.org_id)
    return ORG_INNEXAR_US


async def _mark_invoice_paid(
    db: AsyncSession,
    billing_repo: BillingRepository,
    invoice_id: int,
    event_id: str,
    provider: str,
) -> int | None:
    inv = await billing_repo.get_invoice_by_id(invoice_id)
    if not inv:
        return None
    inv.status = InvoiceStatus.PAID.value
    inv.paid_at = datetime.now(UTC)
    if inv.subscription_id:
        sub = await billing_repo.get_subscription_by_id(inv.subscription_id)
        if sub:
            sub.status = SubscriptionStatus.ACTIVE.value
            sub.start_date = sub.start_date or datetime.now(UTC)
            await set_subscription_next_due_if_recurring(db, sub)
            org_id = await _org_for_invoice_customer(db, billing_repo, invoice_id)
            await reactivate_subscription_after_payment(db, sub.id, org_id=org_id)
    await log_audit(
        db,
        entity="invoice",
        entity_id=str(inv.id),
        action="paid",
        actor_type="webhook",
        actor_id=event_id,
        payload={"provider": provider},
    )
    return inv.id


async def _cancel_subscription_for_invoice(
    db: AsyncSession,
    billing_repo: BillingRepository,
    invoice_id: int,
    event_id: str,
) -> None:
    inv = await billing_repo.get_invoice_by_id(invoice_id)
    if not inv or not inv.subscription_id:
        return
    sub = await billing_repo.get_subscription_by_id(inv.subscription_id)
    if not sub:
        return
    sub.status = SubscriptionStatus.CANCELED.value
    sub.end_date = datetime.now(UTC)
    sub.next_due_date = None
    await log_audit(
        db,
        entity="subscription",
        entity_id=str(sub.id),
        action="cancelled",
        actor_type="webhook",
        actor_id=event_id,
        payload={"provider": "stripe"},
    )


async def _fail_matching_attempt(
    db: AsyncSession,
    billing_repo: BillingRepository,
    invoice_id: int,
    provider: str,
    external_id: str | None,
    event_id: str,
) -> None:
    """Marca tentativa pendente como falha (PIX/boleto expirado etc.). Fase 3."""
    from app.modules.billing.models import PaymentAttempt

    q = select(PaymentAttempt).where(
        PaymentAttempt.invoice_id == invoice_id,
        PaymentAttempt.provider == provider,
        PaymentAttempt.status == "pending",
    )
    if external_id:
        q = q.where(PaymentAttempt.external_id == external_id)
    attempts = (await db.execute(q)).scalars().all()
    for att in attempts:
        att.status = "failed"
        att.failure_code = "provider_terminal_state"
    if attempts:
        await log_audit(
            db,
            entity="invoice",
            entity_id=str(invoice_id),
            action="payment_failed",
            actor_type="webhook",
            actor_id=event_id,
            payload={"provider": provider},
        )


async def _record_provider_refund(
    db: AsyncSession,
    billing_repo: BillingRepository,
    invoice_id: int,
    provider: str,
    event_id: str,
) -> None:
    """Registra reembolso vindo do provider (Fase 3)."""
    from app.modules.billing.models import Refund

    inv = await billing_repo.get_invoice_by_id(invoice_id)
    if not inv:
        return
    inv.status = InvoiceStatus.REFUNDED.value
    db.add(
        Refund(
            invoice_id=invoice_id,
            provider=provider,
            provider_refund_id=event_id,
            amount=float(inv.total),
            currency=inv.currency or "USD",
            status="approved",
            reason="provider webhook",
            actor_type="webhook",
            actor_id=event_id,
        )
    )
    await log_audit(
        db,
        entity="invoice",
        entity_id=str(invoice_id),
        action="refund_created",
        actor_type="webhook",
        actor_id=event_id,
        payload={"provider": provider},
    )


async def process_webhook(
    db: AsyncSession,
    provider: str,
    body: bytes,
    headers: dict[str, str],
) -> tuple[bool, str, int | None]:
    """Process webhook; idempotent via WebhookEvent. Returns (ok, message, paid_invoice_id or None)."""
    billing_repo = BillingRepository(db)
    event_id = ""
    if provider == "stripe":
        p = StripeProvider()
        result = p.handle_webhook(body, headers)
        if not result.processed:
            return False, result.message, None
        event_id = result.message.split("|")[0]
        if await billing_repo.get_webhook_event_by_provider_and_event_id(
            "stripe", result.message
        ):
            return True, "already_processed", None
        payload_hash = hashlib.sha256(body).hexdigest()
        ev = WebhookEvent(
            provider="stripe", event_id=result.message, payload_hash=payload_hash
        )
        billing_repo.add_webhook_event(ev)
        paid_invoice_id: int | None = None
        if result.invoice_id and result.event_action == "paid":
            paid_invoice_id = await _mark_invoice_paid(
                db, billing_repo, result.invoice_id, event_id, "stripe"
            )
        elif result.invoice_id and result.event_action == "cancelled":
            await _cancel_subscription_for_invoice(
                db, billing_repo, result.invoice_id, event_id
            )
        elif result.invoice_id and result.event_action == "payment_failed":
            inv = await billing_repo.get_invoice_by_id(result.invoice_id)
            if inv and inv.status not in (
                InvoiceStatus.PAID.value,
                InvoiceStatus.REFUNDED.value,
            ):
                inv.status = InvoiceStatus.FAILED.value
                await _fail_matching_attempt(
                    db,
                    billing_repo,
                    result.invoice_id,
                    "stripe",
                    external_id=None,
                    event_id=event_id,
                )
                await log_audit(
                    db,
                    entity="invoice",
                    entity_id=str(inv.id),
                    action="payment_failed",
                    actor_type="webhook",
                    actor_id=event_id,
                    payload={"provider": "stripe"},
                )
        elif result.invoice_id and result.event_action == "refunded":
            await _record_provider_refund(
                db, billing_repo, result.invoice_id, "stripe", event_id
            )
        await billing_repo.flush()
        return True, "ok", paid_invoice_id

    if provider == "mercadopago":
        p = MercadoPagoProvider()
        result = p.handle_webhook(body, headers)
        if not result.processed:
            return False, result.message, None
        event_id = result.message
        if await billing_repo.get_webhook_event_by_provider_and_event_id(
            "mercadopago", event_id
        ):
            return True, "already_processed", None
        payload_hash = hashlib.sha256(body).hexdigest()
        ev = WebhookEvent(
            provider="mercadopago",
            event_id=event_id,
            payload_hash=payload_hash,
        )
        billing_repo.add_webhook_event(ev)
        paid_invoice_id = None
        if result.mp_plan_id and result.mp_preapproval_id:
            link = await billing_repo.get_mp_subscription_checkout_by_plan_id(
                result.mp_plan_id
            )
            if link:
                inv = await billing_repo.get_invoice_by_id(link.invoice_id)
                if inv and inv.status != InvoiceStatus.PAID.value:
                    inv.status = InvoiceStatus.PAID.value
                    inv.paid_at = datetime.now(UTC)
                    paid_invoice_id = inv.id
                    if inv.subscription_id:
                        sub = await billing_repo.get_subscription_by_id(
                            inv.subscription_id
                        )
                        if sub:
                            sub.status = SubscriptionStatus.ACTIVE.value
                            sub.external_id = result.mp_preapproval_id
                            sub.start_date = sub.start_date or datetime.now(UTC)
                            await set_subscription_next_due_if_recurring(db, sub)
                            org_id = await _org_for_invoice_customer(
                                db, billing_repo, inv.id
                            )
                            await reactivate_subscription_after_payment(
                                db, sub.id, org_id=org_id
                            )
                    await log_audit(
                        db,
                        entity="invoice",
                        entity_id=str(inv.id),
                        action="paid",
                        actor_type="webhook",
                        actor_id=event_id,
                        payload={
                            "provider": "mercadopago",
                            "subscription": True,
                        },
                    )
        elif result.event_action == "payment_failed" and result.invoice_id:
            # PIX/boleto expirado ou recusado: falha a tentativa, nunca a fatura paga.
            await _fail_matching_attempt(
                db,
                billing_repo,
                result.invoice_id,
                "mercadopago",
                external_id=result.message,
                event_id=event_id,
            )
        elif result.invoice_id:
            paid_invoice_id = await _mark_invoice_paid(
                db, billing_repo, result.invoice_id, event_id, "mercadopago"
            )
        await billing_repo.flush()
        return True, "ok", paid_invoice_id

    return False, "unknown provider", None
