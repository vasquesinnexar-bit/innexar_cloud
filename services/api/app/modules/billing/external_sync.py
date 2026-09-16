"""Sincronização permanente provedor → local (Stripe + Mercado Pago).

Regras:
- Provedor é a verdade sobre PAGAMENTO (valores reais, com cupom/desconto).
- Espelhos são silenciosos: sem notificação ao cliente, sem fulfillment,
  sem contrato (são registros, não eventos de venda).
- Idempotência por external_id (nunca duplica).
- Divergência de status (ex.: cancelado no provedor) → notifica staff,
  nunca altera sozinho.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import log_audit
from app.core.datetime_utils import utc_now
from app.modules.billing.enums import InvoiceStatus, SubscriptionStatus
from app.modules.billing.models import Invoice, Subscription

logger = logging.getLogger(__name__)

MIRROR_LOOKBACK_DAYS = 120


async def _mirror_paid_invoice(
    db: AsyncSession,
    *,
    customer_id: int,
    subscription_id: int | None,
    total: float,
    currency: str,
    paid_at: datetime,
    external_id: str,
    description: str,
    provider: str,
) -> Invoice | None:
    """Cria espelho paid silencioso. Retorna None se já espelhado."""
    existing = (
        await db.execute(select(Invoice).where(Invoice.external_id == external_id))
    ).scalar_one_or_none()
    if existing:
        return None
    inv = Invoice(
        customer_id=customer_id,
        subscription_id=subscription_id,
        status=InvoiceStatus.PAID.value,
        due_date=paid_at,
        paid_at=paid_at,
        total=round(total, 2),
        currency=currency,
        line_items=[
            {
                "description": description,
                "amount": round(total, 2),
                "provider": provider,
                "mirror": True,
            }
        ],
        external_id=external_id,
    )
    db.add(inv)
    await db.flush()
    await log_audit(
        db,
        entity="invoice",
        entity_id=str(inv.id),
        action="mirrored_external_payment",
        actor_type="system",
        actor_id="external-sync",
        payload={"provider": provider, "external_id": external_id},
    )
    await db.flush()
    return inv


async def _notify_staff(db, org_id: str, title: str, body: str) -> None:
    try:
        from app.models.notification import Notification
        from app.repositories.notification_repository import NotificationRepository
        from app.repositories.user_repository import UserRepository

        users = await UserRepository(db).list_by_org_id(org_id)
        repo = NotificationRepository(db)
        for user in users:
            repo.add(
                Notification(
                    user_id=user.id,
                    customer_user_id=None,
                    channel="in_app",
                    title=title,
                    body=body,
                )
            )
        await repo.flush()
    except Exception:  # noqa: BLE001 (sync nunca quebra por notificação)
        logger.exception("external-sync staff notify failed")


async def _sync_stripe_subscription(db, sub: Subscription) -> dict:
    """Espelha faturas pagas do Stripe + avança next_due. Retorna contadores."""
    from app.providers.payments.stripe import StripeProvider, stripe

    StripeProvider()
    result = {"mirrored": 0, "checked": 0}
    try:
        remote = stripe.Subscription.retrieve(sub.external_id)
    except Exception as e:  # noqa: BLE001
        logger.warning("stripe sub %s unreachable: %s", sub.external_id, e)
        return result
    rd = remote.to_dict()
    if (rd.get("status") or "") not in ("active", "trialing"):
        cust = await _customer_of(db, sub.customer_id)
        await _notify_staff(
            db,
            cust.org_id if cust else "innexar",
            "Assinatura divergente no Stripe",
            f"Sub local #{sub.id} ativa, mas no Stripe está {rd.get('status')}.",
        )
        result["divergent"] = True
        return result
    period_end = rd.get("current_period_end")
    if period_end:

        nxt = datetime.fromtimestamp(period_end, tz=UTC)
        if not sub.next_due_date or nxt > sub.next_due_date.replace(tzinfo=UTC):
            sub.next_due_date = nxt
            await db.flush()
    since = int((utc_now() - timedelta(days=MIRROR_LOOKBACK_DAYS)).timestamp())
    kwargs: dict = {"customer": rd.get("customer"), "limit": 100, "status": "paid"}
    if kwargs["customer"] is None:
        return result
    page = stripe.Invoice.list(**kwargs)
    seen = 0
    while True:
        for inv in page.data:
            d = inv.to_dict()
            if d.get("created", 0) < since:
                continue
            result["checked"] += 1
            lines = (d.get("lines") or {}).get("data") or [{}]
            desc = (lines[0].get("description") or "Mensalidade")[:120]
            disc = d.get("total_discount_amounts") or []
            if disc:
                desc += f" (cupom {disc[0].get('amount', 0) / 100:.0f})"
            created = datetime.fromtimestamp(d["created"], tz=UTC)
            mirrored = await _mirror_paid_invoice(
                db,
                customer_id=sub.customer_id,
                subscription_id=sub.id,
                total=(d.get("amount_paid") or 0) / 100,
                currency=(d.get("currency") or "usd").upper(),
                paid_at=created,
                external_id=d["id"],
                description=desc,
                provider="stripe",
            )
            if mirrored:
                result["mirrored"] += 1
            seen += 1
            if seen > 500:
                break
        if not page.has_more or seen > 500:
            break
        page = stripe.Invoice.list(starting_after=page.data[-1]["id"], **kwargs)
    await db.flush()
    return result


async def _customer_of(db, customer_id: int):
    from app.models.customer import Customer

    return await db.get(Customer, customer_id)


async def _sync_mp_subscription(db, sub: Subscription) -> dict:
    """Espelha pagamentos MP aprovados + avança next_due. Retorna contadores."""
    from app.providers.payments.mercadopago import MercadoPagoProvider

    provider = MercadoPagoProvider()
    result = {"mirrored": 0, "checked": 0}
    if not provider._access_token:
        return result
    try:
        preapp = provider.get_preapproval(sub.external_id or "")
    except Exception as e:  # noqa: BLE001
        logger.warning("MP preapproval %s unreachable: %s", sub.external_id, e)
        return result
    if not preapp or (preapp.get("status") or "").lower() not in (
        "authorized",
        "active",
    ):
        cust = await _customer_of(db, sub.customer_id)
        await _notify_staff(
            db,
            cust.org_id if cust else "innexar",
            "Assinatura divergente no Mercado Pago",
            f"Sub local #{sub.id} ativa, mas preapproval está "
            f"{(preapp or {}).get('status')}.",
        )
        result["divergent"] = True
        return result
    cust = await _customer_of(db, sub.customer_id)
    email = None
    if cust:
        from sqlalchemy import select as _select

        from app.models.customer_user import CustomerUser

        cu = (
            (
                await db.execute(
                    _select(CustomerUser).where(CustomerUser.customer_id == cust.id)
                )
            )
            .scalars()
            .first()
        )
        email = cu.email if cu else cust.email
    if not email:
        return result
    since = (utc_now() - timedelta(days=MIRROR_LOOKBACK_DAYS)).strftime("%Y-%m-%d")
    until = utc_now().strftime("%Y-%m-%d")
    pays = provider.search_payments(
        payer_email=email,
        date_from=f"{since}T00:00:00.000-00:00",
        date_to=f"{until}T23:59:59.999-00:00",
    )
    latest = None
    for pay in pays:
        result["checked"] += 1
        pid = str(pay.get("id"))
        amount = float(pay.get("transaction_amount") or 0)
        currency = (pay.get("currency_id") or "BRL").upper()
        date_str = pay.get("date_approved") or pay.get("date_created") or ""
        try:
            paid_at = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            continue
        mirrored = await _mirror_paid_invoice(
            db,
            customer_id=sub.customer_id,
            subscription_id=sub.id,
            total=amount,
            currency=currency,
            paid_at=paid_at,
            external_id=f"mp-{pid}",
            description=f"Mensalidade (espelho Mercado Pago {pid})",
            provider="mercadopago",
        )
        if mirrored:
            result["mirrored"] += 1
        if latest is None or paid_at > latest:
            latest = paid_at
    if latest and (
        not sub.next_due_date
        or latest + timedelta(days=30)
        > (
            sub.next_due_date.replace(tzinfo=UTC)
            if sub.next_due_date.tzinfo is None
            else sub.next_due_date
        )
    ):
        sub.next_due_date = latest + timedelta(days=30)
        await db.flush()
    await db.flush()
    return result


async def sync_external_billing(db: AsyncSession) -> dict:
    """Sincroniza assinaturas com cobrança externa (Stripe + MP). Idempotente."""
    subs = (
        (
            await db.execute(
                select(Subscription).where(
                    Subscription.status == SubscriptionStatus.ACTIVE.value,
                    Subscription.external_id.isnot(None),
                )
            )
        )
        .scalars()
        .all()
    )
    total = {"subscriptions": len(subs), "mirrored": 0, "checked": 0, "divergent": 0}
    for sub in subs:
        try:
            if (sub.external_id or "").startswith("sub_"):
                r = await _sync_stripe_subscription(db, sub)
            else:
                r = await _sync_mp_subscription(db, sub)
            total["mirrored"] += r.get("mirrored", 0)
            total["checked"] += r.get("checked", 0)
            total["divergent"] += 1 if r.get("divergent") else 0
            await db.commit()
        except Exception:  # noqa: BLE001 (uma sub nunca trava o lote)
            logger.exception("external-sync failed sub %s", sub.id)
            await db.rollback()
    return total
