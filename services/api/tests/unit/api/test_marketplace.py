"""P1.2 marketplace: catálogo, compra, idempotência, segurança (14 testes)."""

import uuid

import pytest
from app.core.security import create_token_customer, hash_password
from app.models.customer import Customer
from app.models.customer_user import CustomerUser
from app.modules.billing.models import Contract, ContractItem, Invoice
from app.modules.fulfillment.models import Fulfillment
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


def _ctok(cu: CustomerUser) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_token_customer(cu.id)}"}


async def _br_customer(db: AsyncSession):
    suffix = uuid.uuid4().hex[:8]
    cust = Customer(
        org_id="innexar-br",
        name="BR",
        email=f"br-{suffix}@teste.innexar",
        currency="BRL",
        locale="pt-BR",
    )
    db.add(cust)
    await db.flush()
    cu = CustomerUser(
        customer_id=cust.id,
        email=cust.email,
        password_hash=hash_password("x"),
        email_verified=True,
    )
    db.add(cu)
    await db.flush()
    return cust, cu


async def _product(db: AsyncSession, org: str, name: str, **kw):
    from app.modules.billing.models import Product

    tag = uuid.uuid4().hex[:6]
    p = Product(
        org_id=org,
        name=f"{name} {tag}",
        is_active=True,
        portal_sellable=True,
        **kw,
    )
    db.add(p)
    await db.flush()
    return p, tag


async def _plan(
    db: AsyncSession,
    product_id: int,
    amount: float,
    currency: str,
    billing_type: str = "recurring",
):
    from app.modules.billing.models import PricePlan

    pl = PricePlan(
        product_id=product_id,
        name="Mensal",
        interval="monthly",
        amount=amount,
        currency=currency,
        billing_type=billing_type,
    )
    db.add(pl)
    await db.flush()
    return pl


async def _buy(
    client: AsyncClient,
    cu: CustomerUser,
    product_id: int,
    plan_id: int,
    qty: int = 1,
    key: str | None = None,
    extra: dict | None = None,
):
    body = {"product_id": product_id, "price_plan_id": plan_id, "quantity": qty}
    if key:
        body["idempotency_key"] = key
    if extra:
        body.update(extra)
    return await client.post("/api/portal/purchases", headers=_ctok(cu), json=body)


@pytest.mark.asyncio
async def test_1_br_catalog_brl(
    client: AsyncClient, db_session: AsyncSession, billing_enabled: None
):
    cust, cu = await _br_customer(db_session)
    p, _ = await _product(
        db_session, "innexar-br", "Mail BR", slug=None, category="email"
    )
    await _plan(db_session, p.id, 25.0, "BRL")
    r = await client.get("/api/portal/catalog", headers=_ctok(cu))
    assert r.status_code == 200
    names = [x["name"] for x in r.json()]
    assert any("Mail BR" in n for n in names)
    item = next(x for x in r.json() if "Mail BR" in x["name"])
    assert item["plans"][0]["currency"] == "BRL"


@pytest.mark.asyncio
async def test_2_usa_catalog_usd(
    client: AsyncClient, customer_and_user, billing_enabled: None
):
    _cust, cu = customer_and_user
    r = await client.get("/api/portal/catalog", headers=_ctok(cu))
    assert r.status_code == 200
    assert isinstance(r.json(), list)


@pytest.mark.asyncio
async def test_3_cross_tenant_price_blocked(
    client: AsyncClient,
    customer_and_user,
    billing_enabled: None,
    db_session: AsyncSession,
):
    _cust, cu = customer_and_user  # org innexar (USD)
    p, _ = await _product(db_session, "innexar-br", "BR Only")
    pl = await _plan(db_session, p.id, 25.0, "BRL")
    r = await _buy(client, cu, p.id, pl.id)
    assert r.status_code in (404, 422)


@pytest.mark.asyncio
async def test_4_custom_price_ignored(
    client: AsyncClient,
    customer_and_user,
    billing_enabled: None,
    db_session: AsyncSession,
):
    _cust, cu = customer_and_user
    p, _ = await _product(db_session, "innexar", "Fix Price")
    pl = await _plan(db_session, p.id, 100.0, "USD")
    r = await _buy(client, cu, p.id, pl.id, extra={"unit_amount": 1.0})
    assert r.status_code == 201, r.text
    item = (
        await db_session.execute(
            select(ContractItem).where(ContractItem.id == r.json()["contract_item_id"])
        )
    ).scalar_one()
    assert float(item.unit_amount) == 100.0


@pytest.mark.asyncio
async def test_5_purchase_creates_all(
    client: AsyncClient,
    customer_and_user,
    billing_enabled: None,
    db_session: AsyncSession,
):
    cust, cu = customer_and_user
    p, _ = await _product(db_session, "innexar", "Full Flow")
    pl = await _plan(db_session, p.id, 50.0, "USD")
    r = await _buy(client, cu, p.id, pl.id, qty=2, key=f"k5-{uuid.uuid4().hex[:8]}")
    assert r.status_code == 201, r.text
    j = r.json()
    assert j["total"] == 100.0 and j["currency"] == "USD"
    assert j["reused"] is False
    contract = await db_session.get(Contract, j["contract_id"])
    assert contract.source == "portal"
    item = await db_session.get(ContractItem, j["contract_item_id"])
    assert item.source == "portal" and item.quantity == 2
    inv = await db_session.get(Invoice, j["invoice_id"])
    assert inv.status == "pending"
    assert any(
        isinstance(x, dict) and x.get("contract_item_id") == item.id
        for x in (inv.line_items or [])
    )


@pytest.mark.asyncio
async def test_6_double_submit_single_set(
    client: AsyncClient,
    customer_and_user,
    billing_enabled: None,
    db_session: AsyncSession,
):
    cust, cu = customer_and_user
    p, _ = await _product(db_session, "innexar", "Dedupe")
    pl = await _plan(db_session, p.id, 30.0, "USD")
    key = f"k6-{uuid.uuid4().hex[:8]}"
    r1 = await _buy(client, cu, p.id, pl.id, key=key)
    r2 = await _buy(client, cu, p.id, pl.id, key=key)
    assert r1.status_code == 201 and r2.status_code == 201
    assert r2.json()["reused"] is True
    assert r1.json()["invoice_id"] == r2.json()["invoice_id"]
    n = (
        (
            await db_session.execute(
                select(Invoice).where(
                    Invoice.customer_id == cust.id,
                    Invoice.idempotency_key == key,
                )
            )
        )
        .scalars()
        .all()
    )
    assert len(n) == 1


@pytest.mark.asyncio
async def test_7_payment_creates_fulfillment(
    client: AsyncClient,
    customer_and_user,
    billing_enabled: None,
    db_session: AsyncSession,
):
    from app.modules.fulfillment.facade import after_payment

    cust, cu = customer_and_user
    p, _ = await _product(
        db_session,
        "innexar",
        "Mail Flow",
        category="email",
        fulfillment_handler="mail",
        fulfillment_strategy="guided",
    )
    pl = await _plan(db_session, p.id, 25.0, "USD")
    r = await _buy(client, cu, p.id, pl.id, key=f"k7-{uuid.uuid4().hex[:8]}")
    assert r.status_code == 201
    fs0 = (
        (
            await db_session.execute(
                select(Fulfillment).where(Fulfillment.customer_id == cust.id)
            )
        )
        .scalars()
        .all()
    )
    assert fs0 == []
    # sem domínio: WAITING_INPUT
    await after_payment(db_session, r.json()["invoice_id"])
    await db_session.commit()
    fs = (
        (
            await db_session.execute(
                select(Fulfillment).where(Fulfillment.customer_id == cust.id)
            )
        )
        .scalars()
        .all()
    )
    assert len(fs) == 1


@pytest.mark.asyncio
async def test_8_unpaid_no_provisioning(
    client: AsyncClient,
    customer_and_user,
    billing_enabled: None,
    db_session: AsyncSession,
):
    cust, cu = customer_and_user
    p, _ = await _product(db_session, "innexar", "Quiet")
    pl = await _plan(db_session, p.id, 10.0, "USD")
    r = await _buy(client, cu, p.id, pl.id, key=f"k8-{uuid.uuid4().hex[:8]}")
    assert r.status_code == 201
    fs = (
        (
            await db_session.execute(
                select(Fulfillment).where(Fulfillment.customer_id == cust.id)
            )
        )
        .scalars()
        .all()
    )
    assert fs == []


@pytest.mark.asyncio
async def test_9_project_on_payment(
    client: AsyncClient,
    customer_and_user,
    billing_enabled: None,
    db_session: AsyncSession,
):
    from app.modules.fulfillment.facade import after_payment
    from app.modules.projects.models import Project

    cust, cu = customer_and_user
    p, _ = await _product(
        db_session, "innexar", "Site Flow", provisioning_type="site_delivery"
    )
    pl = await _plan(db_session, p.id, 500.0, "USD", billing_type="recurring")
    r = await _buy(client, cu, p.id, pl.id, key=f"k9-{uuid.uuid4().hex[:8]}")
    assert r.status_code == 201
    await after_payment(db_session, r.json()["invoice_id"])
    await db_session.commit()
    projs = (
        (
            await db_session.execute(
                select(Project).where(Project.customer_id == cust.id)
            )
        )
        .scalars()
        .all()
    )
    assert len(projs) == 1


@pytest.mark.asyncio
async def test_10_email_waits_domain(
    client: AsyncClient,
    customer_and_user,
    billing_enabled: None,
    db_session: AsyncSession,
):
    from app.modules.fulfillment.facade import after_payment

    cust, cu = customer_and_user
    p, _ = await _product(
        db_session,
        "innexar",
        "Mail NoDom",
        category="email",
        fulfillment_handler="mail",
        fulfillment_strategy="guided",
    )
    pl = await _plan(db_session, p.id, 25.0, "USD")
    r = await _buy(client, cu, p.id, pl.id, key=f"k10-{uuid.uuid4().hex[:8]}")
    assert r.status_code == 201
    await after_payment(db_session, r.json()["invoice_id"])
    await db_session.commit()
    fs = (
        (
            await db_session.execute(
                select(Fulfillment).where(Fulfillment.customer_id == cust.id)
            )
        )
        .scalars()
        .all()
    )
    assert len(fs) == 1
    assert fs[0].status == "waiting_input"
    assert fs[0].current_step == "domain"


@pytest.mark.asyncio
async def test_11_product_without_price_not_sellable(
    client: AsyncClient,
    customer_and_user,
    billing_enabled: None,
    db_session: AsyncSession,
):
    cust, cu = customer_and_user
    p, tag = await _product(db_session, "innexar", f"NoPrice {uuid.uuid4().hex[:6]}")
    r = await client.get("/api/portal/catalog", headers=_ctok(cu))
    assert all(tag not in x["name"] for x in r.json())
    # plano de outra moeda não serve
    pl = await _plan(db_session, p.id, 25.0, "BRL")
    r2 = await _buy(client, cu, p.id, pl.id)
    assert r2.status_code == 422


@pytest.mark.asyncio
async def test_12_sellable_false_hidden(
    client: AsyncClient,
    customer_and_user,
    billing_enabled: None,
    db_session: AsyncSession,
):
    from app.modules.billing.models import Product

    cust, cu = customer_and_user
    tag = uuid.uuid4().hex[:6]
    p = Product(
        org_id="innexar",
        name=f"Hidden {tag}",
        is_active=True,
        portal_sellable=False,
    )
    db_session.add(p)
    await db_session.flush()
    from app.modules.billing.models import PricePlan

    pl = PricePlan(
        product_id=p.id,
        name="M",
        interval="monthly",
        amount=10.0,
        currency="USD",
        billing_type="recurring",
    )
    db_session.add(pl)
    await db_session.flush()
    r = await client.get("/api/portal/catalog", headers=_ctok(cu))
    assert all(tag not in x["name"] for x in r.json())
    r2 = await _buy(client, cu, p.id, pl.id)
    assert r2.status_code == 404


@pytest.mark.asyncio
async def test_13_idor_invoice_blocked(
    client: AsyncClient, db_session: AsyncSession, billing_enabled: None
):
    from app.models.customer import Customer

    cust_a = Customer(
        org_id="innexar", name="A", email=f"a-{uuid.uuid4().hex[:6]}@t.in"
    )
    cust_b = Customer(
        org_id="innexar", name="B", email=f"b-{uuid.uuid4().hex[:6]}@t.in"
    )
    db_session.add_all([cust_a, cust_b])
    await db_session.flush()
    for cust in (cust_a, cust_b):
        cu = CustomerUser(
            customer_id=cust.id,
            email=cust.email,
            password_hash=hash_password("x"),
            email_verified=True,
        )
        db_session.add(cu)
    await db_session.flush()
    p, _ = await _product(db_session, "innexar", "IDOR Inv")
    pl = await _plan(db_session, p.id, 10.0, "USD")
    cu_a = (
        await db_session.execute(
            select(CustomerUser).where(CustomerUser.customer_id == cust_a.id)
        )
    ).scalar_one()
    cu_b = (
        await db_session.execute(
            select(CustomerUser).where(CustomerUser.customer_id == cust_b.id)
        )
    ).scalar_one()
    r = await _buy(client, cu_a, p.id, pl.id, key=f"k13-{uuid.uuid4().hex[:8]}")
    inv_id = r.json()["invoice_id"]
    rb = await client.get(f"/api/portal/invoices/{inv_id}", headers=_ctok(cu_b))
    assert rb.status_code == 404


@pytest.mark.asyncio
async def test_14_idor_items_scoped(
    client: AsyncClient, db_session: AsyncSession, billing_enabled: None
):
    from app.models.customer import Customer

    cust_a = Customer(
        org_id="innexar", name="A2", email=f"a2-{uuid.uuid4().hex[:6]}@t.in"
    )
    cust_b = Customer(
        org_id="innexar", name="B2", email=f"b2-{uuid.uuid4().hex[:6]}@t.in"
    )
    db_session.add_all([cust_a, cust_b])
    await db_session.flush()
    for cust in (cust_a, cust_b):
        db_session.add(
            CustomerUser(
                customer_id=cust.id,
                email=cust.email,
                password_hash=hash_password("x"),
                email_verified=True,
            )
        )
    await db_session.flush()
    p, _ = await _product(db_session, "innexar", "IDOR Items")
    pl = await _plan(db_session, p.id, 10.0, "USD")
    cu_a = (
        await db_session.execute(
            select(CustomerUser).where(CustomerUser.customer_id == cust_a.id)
        )
    ).scalar_one()
    cu_b = (
        await db_session.execute(
            select(CustomerUser).where(CustomerUser.customer_id == cust_b.id)
        )
    ).scalar_one()
    await _buy(client, cu_a, p.id, pl.id, key=f"k14-{uuid.uuid4().hex[:8]}")
    rb = await client.get("/api/portal/purchases", headers=_ctok(cu_b))
    assert rb.status_code == 200
    assert rb.json() == []


@pytest.mark.asyncio
async def test_overview_hosting_and_setup_flag(
    client: AsyncClient, db_session: AsyncSession, billing_enabled: None
):
    """Overview inclui hosting sem ContractItem + marca setup (is_setup)."""
    from app.modules.billing.models import Contract, ContractItem
    from app.modules.hosting.models import HostingService

    cust, cu = await _br_customer(db_session)
    p, _ = await _product(db_session, "innexar-br", "Mail Ov", category="email")
    setup = await _plan(db_session, p.id, 100.0, "BRL", billing_type="one_time")
    monthly = await _plan(db_session, p.id, 25.0, "BRL", billing_type="recurring")
    ct = Contract(
        customer_id=cust.id,
        org_id="innexar-br",
        status="pending",
        currency="BRL",
        source="workspace",
    )
    db_session.add(ct)
    await db_session.flush()
    for plan, amount in ((setup, 100.0), (monthly, 25.0)):
        db_session.add(
            ContractItem(
                contract_id=ct.id,
                product_id=p.id,
                price_plan_id=plan.id,
                quantity=1,
                unit_amount=amount,
                source="workspace",
            )
        )
    db_session.add(
        HostingService(
            customer_id=cust.id,
            server_id=None,
            org_id="innexar-br",
            runtime_type="docker",
            container_name="t-web",
            project_name="tproj",
            primary_domain="t.example.com",
            environment="production",
            path_mode="container",
            status="active",
        )
    )
    await db_session.flush()
    r = await client.get("/api/portal/services/overview", headers=_ctok(cu))
    assert r.status_code == 200
    data = r.json()
    by_plan = {i["unit_amount"]: i for i in data["items"]}
    assert by_plan[100.0]["is_setup"] is True
    assert by_plan[25.0]["is_setup"] is False
    assert [h["primary_domain"] for h in data["hosting_services"]] == ["t.example.com"]


@pytest.mark.asyncio
async def test_overview_tenant_isolation(
    client: AsyncClient, db_session: AsyncSession, billing_enabled: None
):
    """Hosting de outro cliente nunca aparece no overview."""
    from app.modules.hosting.models import HostingService

    cust_a, cu_a = await _br_customer(db_session)
    cust_b, cu_b = await _br_customer(db_session)
    db_session.add(
        HostingService(
            customer_id=cust_b.id,
            server_id=None,
            org_id="innexar-br",
            runtime_type="docker",
            container_name="b-web",
            project_name="bproj",
            primary_domain="b.example.com",
            environment="production",
            path_mode="container",
            status="active",
        )
    )
    await db_session.flush()
    r = await client.get("/api/portal/services/overview", headers=_ctok(cu_a))
    assert r.status_code == 200
    assert r.json()["hosting_services"] == []
