"""Sync permanente provedor → local (Stripe + MP), sem rede (mocks)."""

from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from app.models.customer import Customer
from app.modules.billing.enums import InvoiceStatus, SubscriptionStatus
from app.modules.billing.external_sync import sync_external_billing
from app.modules.billing.models import Invoice, PricePlan, Product, Subscription
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


async def _setup(db: AsyncSession, tag: str, external_id: str):
    cust = Customer(org_id="innexar", name=f"S {tag}", email=f"s-{tag}@t.innexar")
    db.add(cust)
    await db.flush()
    prod = Product(org_id="innexar", name=f"PS {tag}", is_active=True)
    db.add(prod)
    await db.flush()
    plan = PricePlan(
        product_id=prod.id,
        name="M",
        interval="month",
        amount=100.0,
        currency="USD",
        billing_type="recurring",
    )
    db.add(plan)
    await db.flush()
    sub = Subscription(
        customer_id=cust.id,
        product_id=prod.id,
        price_plan_id=plan.id,
        status=SubscriptionStatus.ACTIVE.value,
        external_id=external_id,
        next_due_date=datetime.now(UTC) - timedelta(days=1),
    )
    db.add(sub)
    await db.flush()
    return cust, sub


def _stripe_invoice(sid: str, amount: int, created: datetime):
    d = MagicMock()
    d.to_dict.return_value = {
        "id": sid,
        "amount_paid": amount,
        "currency": "usd",
        "created": int(created.timestamp()),
        "lines": {"data": [{"description": "Business Website - Monthly"}]},
        "total_discount_amounts": [],
    }
    return d


@pytest.mark.asyncio
async def test_stripe_mirror_creates_silent_paid(db_session: AsyncSession):
    cust, sub = await _setup(db_session, "a", "sub_TEST123")
    created = datetime.now(UTC) - timedelta(days=2)
    page = MagicMock()
    page.data = [_stripe_invoice("in_TEST1", 19900, created)]
    page.has_more = False
    fake_sub = MagicMock()
    fake_sub.to_dict.return_value = {
        "status": "active",
        "customer": "cus_X",
        "current_period_end": int((datetime.now(UTC) + timedelta(days=28)).timestamp()),
    }
    with (
        patch(
            "app.providers.payments.stripe.stripe.Subscription.retrieve",
            return_value=fake_sub,
        ),
        patch("app.providers.payments.stripe.stripe.Invoice.list", return_value=page),
    ):
        out = await sync_external_billing(db_session)
    assert out["mirrored"] == 1
    inv = (
        await db_session.execute(
            select(Invoice).where(Invoice.external_id == "in_TEST1")
        )
    ).scalar_one()
    assert inv.status == InvoiceStatus.PAID.value
    assert float(inv.total) == 199.0
    # silencioso: sem notificação ao cliente
    from app.models.notification import Notification

    notes = (
        (
            await db_session.execute(
                select(Notification).where(Notification.customer_user_id.isnot(None))
            )
        )
        .scalars()
        .all()
    )
    assert notes == []


@pytest.mark.asyncio
async def test_stripe_mirror_idempotent(db_session: AsyncSession):
    cust, sub = await _setup(db_session, "b", "sub_TEST456")
    created = datetime.now(UTC) - timedelta(days=2)
    page = MagicMock()
    page.data = [_stripe_invoice("in_TEST2", 19900, created)]
    page.has_more = False
    fake_sub = MagicMock()
    fake_sub.to_dict.return_value = {
        "status": "active",
        "customer": "cus_X",
        "current_period_end": int((datetime.now(UTC) + timedelta(days=28)).timestamp()),
    }
    with (
        patch(
            "app.providers.payments.stripe.stripe.Subscription.retrieve",
            return_value=fake_sub,
        ),
        patch("app.providers.payments.stripe.stripe.Invoice.list", return_value=page),
    ):
        await sync_external_billing(db_session)
        out = await sync_external_billing(db_session)
    assert out["mirrored"] == 0
    n = (
        (
            await db_session.execute(
                select(Invoice).where(Invoice.external_id == "in_TEST2")
            )
        )
        .scalars()
        .all()
    )
    assert len(n) == 1


@pytest.mark.asyncio
async def test_stripe_divergence_notifies_staff_not_customer(
    db_session: AsyncSession,
    staff_user,
):
    cust, sub = await _setup(db_session, "c", "sub_TEST789")
    fake_sub = MagicMock()
    fake_sub.to_dict.return_value = {"status": "canceled", "customer": "cus_X"}
    with patch(
        "app.providers.payments.stripe.stripe.Subscription.retrieve",
        return_value=fake_sub,
    ):
        out = await sync_external_billing(db_session)
    assert out.get("divergent") == 1
    await db_session.refresh(sub)
    assert sub.status == SubscriptionStatus.ACTIVE.value  # não altera sozinho
    from app.models.notification import Notification

    staff_notes = (
        (
            await db_session.execute(
                select(Notification).where(Notification.user_id.isnot(None))
            )
        )
        .scalars()
        .all()
    )
    assert len(staff_notes) >= 1


@pytest.mark.asyncio
async def test_mp_mirror_and_next_due(db_session: AsyncSession):
    cust, sub = await _setup(db_session, "d", "123456789")
    paid_at = datetime.now(UTC) - timedelta(days=5)
    pays = [
        {
            "id": "pay-mp-1",
            "status": "approved",
            "transaction_amount": 150.0,
            "currency_id": "BRL",
            "date_approved": paid_at.isoformat(),
            "payer": {"email": cust.email},
        }
    ]
    with (
        patch(
            "app.providers.payments.mercadopago._get_access_token",
            return_value="tk",
        ),
        patch(
            "app.providers.payments.mercadopago.MercadoPagoProvider.get_preapproval",
            return_value={"status": "authorized"},
        ),
        patch(
            "app.providers.payments.mercadopago.MercadoPagoProvider.search_payments",
            return_value=pays,
        ),
    ):
        out = await sync_external_billing(db_session)
    assert out["mirrored"] == 1
    inv = (
        await db_session.execute(
            select(Invoice).where(Invoice.external_id == "mp-pay-mp-1")
        )
    ).scalar_one()
    assert inv.status == InvoiceStatus.PAID.value
    assert inv.currency == "BRL"
    await db_session.refresh(sub)
    assert sub.next_due_date is not None


@pytest.mark.asyncio
async def test_generate_skips_stripe_billed(db_session: AsyncSession):
    from app.modules.billing.recurring_ops import generate_recurring_invoices

    cust, sub = await _setup(db_session, "e", "sub_TESTSKIP")
    n = await generate_recurring_invoices(db_session)
    assert n == 0
    invs = (
        (
            await db_session.execute(
                select(Invoice).where(Invoice.customer_id == cust.id)
            )
        )
        .scalars()
        .all()
    )
    assert invs == []
