"""Fase 3: policy, lifecycle, idempotência, capabilities (sqlite, sem provider real)."""

from datetime import UTC, datetime, timedelta

import pytest
from app.models.customer import Customer
from app.modules.billing import capabilities, lifecycle, pay_methods
from app.modules.billing.enums import InvoiceStatus
from app.modules.billing.models import (
    BillingPolicy,
    Contract,
    ContractItem,
    Invoice,
    PricePlan,
    Product,
)
from sqlalchemy.ext.asyncio import AsyncSession


async def _customer(db, email="f3@example.com", org="innexar"):
    c = Customer(
        org_id=org, name="F3", email=email, currency="BRL", country="BR", locale="pt-BR"
    )
    db.add(c)
    await db.flush()
    return c


async def _invoice(db, customer, **kw):
    kw.setdefault("due_date", datetime.now(UTC) + timedelta(days=5))
    inv = Invoice(
        customer_id=customer.id, status="pending", total=100.0, currency="BRL", **kw
    )
    db.add(inv)
    await db.flush()
    return inv


@pytest.mark.asyncio
async def test_policy_resolution_order(db_session: AsyncSession):
    from app.modules.billing import policy as pol

    assert (await pol.resolve_policy(db_session))["grace_period_days"] == 7
    db_session.add(
        BillingPolicy(
            scope="org", scope_ref="innexar", grace_period_days=3, suspend_after_days=10
        )
    )
    await db_session.flush()
    eff = await pol.resolve_policy(db_session, org_id="innexar")
    assert eff["grace_period_days"] == 3
    assert eff["reminder_days_before"] == [3, 1]


@pytest.mark.asyncio
async def test_capabilities():
    assert capabilities.supports("mercadopago", "pix")
    assert capabilities.supports("mercadopago", "boleto")
    assert not capabilities.supports("stripe", "pix")
    assert not capabilities.supports("stripe", "boleto")
    assert capabilities.supports("stripe", "card")
    assert set(capabilities.available_methods("mercadopago", "BRL")) == {
        "pix",
        "boleto",
        "card",
        "checkout_link",
        "subscription",
    }
    assert "pix" not in capabilities.available_methods("stripe", "USD")
    assert "pix" not in capabilities.available_methods("mercadopago", "USD")


@pytest.mark.asyncio
async def test_past_due_and_reminders(db_session: AsyncSession):
    c = await _customer(db_session)
    inv = await _invoice(db_session, c, due_date=datetime.now(UTC) - timedelta(days=2))
    n = await lifecycle.mark_past_due(db_session)
    assert n == 1
    assert inv.status == InvoiceStatus.PAST_DUE.value
    # segunda execução não duplica
    assert await lifecycle.mark_past_due(db_session) == 0
    # lembrete de atraso (policy global after=[1,3,5])
    s = await lifecycle.send_reminders(db_session)
    assert s == 1
    assert await lifecycle.send_reminders(db_session) == 0


@pytest.mark.asyncio
async def test_suspend_reactivate_cycle(db_session: AsyncSession):
    from app.modules.mail.models import EmailDomain, EmailMailbox, Service

    c = await _customer(db_session, email="susp@example.com")
    inv = await _invoice(db_session, c, due_date=datetime.now(UTC) - timedelta(days=20))
    inv.status = InvoiceStatus.PAST_DUE.value
    svc = Service(
        customer_id=c.id,
        org_id="innexar",
        service_type="professional_email",
        status="active",
    )
    db_session.add(svc)
    await db_session.flush()
    d = EmailDomain(
        customer_id=c.id,
        org_id="innexar",
        domain="x.com",
        status="active",
        service_id=svc.id,
    )
    db_session.add(d)
    await db_session.flush()
    db_session.add(
        EmailMailbox(
            customer_id=c.id,
            org_id="innexar",
            service_id=svc.id,
            email_domain_id=d.id,
            address="a@x.com",
            local_part="a",
            status="active",
            external_id="a@x.com",
        )
    )
    ct = Contract(customer_id=c.id, org_id="innexar", status="active")
    db_session.add(ct)
    await db_session.flush()
    # provider fake: evita docker
    import app.modules.mail.provider as prov_mod

    class FakeMP:
        def disable_mailbox(self, address):
            pass

        def enable_mailbox(self, address):
            pass

    orig = prov_mod.DockerMailserverProvider
    prov_mod.DockerMailserverProvider = FakeMP
    try:
        assert await lifecycle.suspend_overdue(db_session) == 1
        assert svc.status == "suspended"
        assert ct.status == "suspended"
        # re-execução não duplica suspensão (já não está active)
        assert await lifecycle.suspend_overdue(db_session) == 0
        assert await lifecycle.reactivate_customer(db_session, c.id) == 1
        assert svc.status == "active"
        assert ct.status == "active"
    finally:
        prov_mod.DockerMailserverProvider = orig


@pytest.mark.asyncio
async def test_contract_generation_idempotent(db_session: AsyncSession):
    from app.jobs import contract_billing

    c = await _customer(db_session, email="gen@example.com")
    p = Product(
        org_id="innexar",
        name="E-mail",
        slug="professional-email",
        category="email",
        is_active=True,
    )
    db_session.add(p)
    await db_session.flush()
    plan = PricePlan(
        product_id=p.id, name="Mensal", interval="monthly", amount=25.0, currency="BRL"
    )
    db_session.add(plan)
    await db_session.flush()
    ct = Contract(
        customer_id=c.id,
        org_id="innexar",
        status="active",
        currency="BRL",
        billing_interval="monthly",
        billing_day=1,
    )
    db_session.add(ct)
    await db_session.flush()
    db_session.add(
        ContractItem(
            contract_id=ct.id,
            product_id=p.id,
            price_plan_id=plan.id,
            quantity=2,
            unit_amount=25.0,
        )
    )
    await db_session.flush()
    r1 = await contract_billing.generate(db_session)
    assert r1["created"] == 1
    r2 = await contract_billing.generate(db_session)
    assert r2["created"] == 0


@pytest.mark.asyncio
async def test_pix_boleto_fake_provider(db_session: AsyncSession, monkeypatch):
    from app.providers.payments import mercadopago as mp_mod

    c = await _customer(db_session, email="pay@example.com")
    inv = await _invoice(db_session, c)

    def fake_pix(**kw):
        assert kw["payment_method_id"] == "pix" if "payment_method_id" in kw else True
        return {
            "id": "pay123",
            "point_of_interaction": {
                "transaction_data": {"qr_code": "000201", "qr_code_base64": "aGVsbG8="}
            },
            "date_of_expiration": "2099-09-15T12:00:00.000-04:00",
        }

    async def _noop(*a, **k):
        return None

    monkeypatch.setattr(
        mp_mod.MercadoPagoProvider, "create_pix", lambda self, **kw: fake_pix(**kw)
    )
    # força provider MP independente de env
    monkeypatch.setattr(pay_methods, "get_payment_provider", _noop_provider)
    view = await pay_methods.create_pix_charge(
        db_session, invoice_id=inv.id, customer_id=c.id
    )
    assert view["status"] == "pending"
    assert view["meta"]["copy_paste"] == "000201"
    assert view["external_id"] == "pay123"
    # idempotência: segunda chamada reusa
    view2 = await pay_methods.create_pix_charge(
        db_session, invoice_id=inv.id, customer_id=c.id
    )
    assert view2["id"] == view["id"]


async def _noop_provider(
    db, customer_id, org_id, currency, mode="test", billing_provider=None
):
    from app.providers.payments.mercadopago import MercadoPagoProvider

    return MercadoPagoProvider(access_token="TEST")


@pytest.mark.asyncio
async def test_boleto_requires_doc(db_session: AsyncSession):
    c = await _customer(db_session, email="bol@example.com")
    inv = await _invoice(db_session, c)
    with pytest.raises(Exception) as e:
        await pay_methods.create_boleto_charge(
            db_session, invoice_id=inv.id, customer_id=c.id
        )
    assert "CPF" in str(e.value) or "payer_data_missing" in str(e.value)


@pytest.mark.asyncio
async def test_refund_missing_invoice(db_session: AsyncSession):
    with pytest.raises(pay_methods.PayMethodError):
        await pay_methods.create_refund(db_session, invoice_id=999999)
