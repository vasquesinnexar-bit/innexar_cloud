"""Fase 3: webhooks — duplicado, fora de ordem, desconhecido, refund, falha (sem rede)."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select
from app.models.customer import Customer
from app.modules.billing.enums import InvoiceStatus
from app.modules.billing.models import Invoice, Refund
from app.modules.billing.webhook_ops import process_webhook
from app.providers.payments.base import WebhookResult
from sqlalchemy.ext.asyncio import AsyncSession


async def _customer_invoice(db, email="wh@example.com"):
    c = Customer(org_id="innexar", name="W", email=email, currency="USD")
    db.add(c)
    await db.flush()
    inv = Invoice(customer_id=c.id, status="pending",
                  due_date=datetime.now(UTC) + timedelta(days=5),
                  total=50.0, currency="USD")
    db.add(inv)
    await db.flush()
    return c, inv


@pytest.mark.asyncio
async def test_stripe_paid_then_duplicate(db_session: AsyncSession, monkeypatch):
    import app.providers.payments.stripe as st_mod

    c, inv = await _customer_invoice(db_session)

    def fake_construct(body, sig, secret):
        return {"id": "evt_dup1", "type": "checkout.session.completed",
                "data": {"object": {"metadata": {"invoice_id": str(inv.id)}}}}

    monkeypatch.setattr(st_mod.stripe.Webhook, "construct_event", fake_construct)
    ok1, _, paid1 = await process_webhook(db_session, "stripe", b"{}", {})
    ok2, msg2, paid2 = await process_webhook(db_session, "stripe", b"{}", {})
    assert ok1 and paid1 == inv.id
    assert ok2 and msg2 == "already_processed" and paid2 is None
    assert inv.status == InvoiceStatus.PAID.value


@pytest.mark.asyncio
async def test_stripe_out_of_order_failed_after_paid(db_session: AsyncSession,
                                                     monkeypatch):
    import app.providers.payments.stripe as st_mod

    c, inv = await _customer_invoice(db_session, email="oo@example.com")
    calls = {"n": 0}

    def fake_construct(body, sig, secret):
        calls["n"] += 1
        if calls["n"] == 1:
            return {"id": "evt_ord1", "type": "checkout.session.completed",
                    "data": {"object": {"metadata": {"invoice_id": str(inv.id)}}}}
        return {"id": "evt_ord2", "type": "invoice.payment_failed",
                "data": {"object": {"subscription_details": {
                    "metadata": {"invoice_id": str(inv.id)}}}}}

    monkeypatch.setattr(st_mod.stripe.Webhook, "construct_event", fake_construct)
    await process_webhook(db_session, "stripe", b"{}", {})
    # falha tardia NÃO reabre fatura paga (comportamento atual preservado)
    ok, _, _ = await process_webhook(db_session, "stripe", b"{}", {})
    assert ok
    assert inv.status == InvoiceStatus.PAID.value


@pytest.mark.asyncio
async def test_stripe_unknown_invoice(db_session: AsyncSession, monkeypatch):
    import app.providers.payments.stripe as st_mod

    def fake_construct(body, sig, secret):
        return {"id": "evt_unk1", "type": "checkout.session.completed",
                "data": {"object": {"metadata": {"invoice_id": "987654321"}}}}

    monkeypatch.setattr(st_mod.stripe.Webhook, "construct_event", fake_construct)
    ok, msg, paid = await process_webhook(db_session, "stripe", b"{}", {})
    assert ok and paid is None


@pytest.mark.asyncio
async def test_stripe_refunded(db_session: AsyncSession, monkeypatch):
    import app.providers.payments.stripe as st_mod

    c, inv = await _customer_invoice(db_session, email="rf@example.com")
    inv.status = InvoiceStatus.PAID.value
    await db_session.flush()

    def fake_construct(body, sig, secret):
        return {"id": "evt_ref1", "type": "charge.refunded",
                "data": {"object": {"metadata": {"invoice_id": str(inv.id)}}}}

    monkeypatch.setattr(st_mod.stripe.Webhook, "construct_event", fake_construct)
    ok, _, _ = await process_webhook(db_session, "stripe", b"{}", {})
    assert ok
    assert inv.status == InvoiceStatus.REFUNDED.value
    rows = (await db_session.execute(
        select(Refund).where(Refund.invoice_id == inv.id))).scalars().all()
    assert len(rows) == 1 and rows[0].provider == "stripe"


@pytest.mark.asyncio
async def test_mp_expired_fails_attempt(db_session: AsyncSession, monkeypatch):
    from app.modules.billing.models import PaymentAttempt
    import app.providers.payments.mercadopago as mp_mod

    c, inv = await _customer_invoice(db_session, email="mpx@example.com")
    att = PaymentAttempt(invoice_id=inv.id, provider="mercadopago",
                         external_id="mp_9", status="pending", method="pix",
                         amount=10.0)
    db_session.add(att)
    await db_session.flush()

    orig = mp_mod.MercadoPagoProvider.handle_webhook

    def fake_handle(self, body, headers):
        return WebhookResult(processed=True, invoice_id=inv.id,
                             message="mp_9", event_action="payment_failed")

    monkeypatch.setattr(mp_mod.MercadoPagoProvider, "handle_webhook", fake_handle)
    ok, _, paid = await process_webhook(db_session, "mercadopago", b"{}", {})
    assert ok and paid is None
    assert att.status == "failed"
    assert inv.status != InvoiceStatus.PAID.value
