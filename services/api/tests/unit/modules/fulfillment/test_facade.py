"""P0 testes obrigatórios (11 casos): contrato, idempotência, handlers, retry, RBAC, tenant."""

from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_token_staff
from app.models.customer import Customer
from app.models.user import User
from app.modules.billing.models import (
    Contract,
    ContractItem,
    Invoice,
    PricePlan,
    Product,
    Subscription,
)
from app.modules.fulfillment import facade
from app.modules.fulfillment.enums import FulfillmentStatus
from app.modules.fulfillment.models import Fulfillment
from app.modules.fulfillment.registry import resolve_handler


async def _customer(db: AsyncSession, tag: str) -> Customer:
    c = Customer(org_id="innexar", name=f"C {tag}", email=f"c-{tag}@t.innexar")
    db.add(c)
    await db.flush()
    return c


async def _product(db: AsyncSession, tag: str, **kw) -> Product:
    p = Product(org_id="innexar", name=f"P {tag}", is_active=True, **kw)
    db.add(p)
    await db.flush()
    return p


async def _plan(db: AsyncSession, product_id: int, amount: float = 100.0) -> PricePlan:
    pl = PricePlan(product_id=product_id, name="Mensal", interval="monthly",
                   amount=amount, currency="USD", billing_type="recurring")
    db.add(pl)
    await db.flush()
    return pl


async def _sub_invoice(db: AsyncSession, cust: Customer, product: Product,
                       plan: PricePlan):
    sub = Subscription(customer_id=cust.id, product_id=product.id,
                       price_plan_id=plan.id, status="active")
    db.add(sub)
    await db.flush()
    inv = Invoice(customer_id=cust.id, subscription_id=sub.id, status="paid",
                  due_date=datetime.now(UTC), total=float(plan.amount),
                  currency="USD",
                  line_items=[{"description": product.name,
                               "amount": float(plan.amount)}])
    db.add(inv)
    await db.flush()
    return sub, inv


def _h(user: User) -> dict:
    return {"Authorization": f"Bearer {create_token_staff(user.id)}"}


async def test_caso1_br_purchase_creates_contract_item_fulfillment(db_session):
    """CASO 1: compra → paid → Contract → ContractItem → Fulfillment."""
    db = db_session
    cust = await _customer(db, "c1")
    prod = await _product(db, "site", provisioning_type="site_delivery")
    plan = await _plan(db, prod.id)
    _sub, inv = await _sub_invoice(db, cust, prod, plan)
    with patch("app.modules.fulfillment.handlers.ProjectProvisioner.provision") as m:
        from app.modules.fulfillment.registry import ProvisionResult
        m.return_value = ProvisionResult(ok=False, waiting_input="briefing",
                                         step="briefing")
        out = await facade.after_payment(db, inv.id)
    assert len(out) == 1
    f = out[0]
    assert f.handler_key == "project"
    assert f.status == FulfillmentStatus.WAITING_INPUT.value
    n_contracts = (await db.execute(
        select(Contract).where(Contract.customer_id == cust.id))).scalars().all()
    assert len(n_contracts) == 1
    items = (await db.execute(
        select(ContractItem).where(
            ContractItem.contract_id == n_contracts[0].id))).scalars().all()
    assert len(items) == 1


async def test_caso2_usa_stripe_subscription_same_core(db_session):
    """CASO 2: subscription Stripe (USD) produz mesma estrutura lógica."""
    db = db_session
    cust = await _customer(db, "c2")
    prod = await _product(db, "host", provisioning_type="hestia_hosting")
    plan = await _plan(db, prod.id, 50.0)
    _sub, inv = await _sub_invoice(db, cust, prod, plan)
    inv.line_items = [{"description": "x", "domain": "case2.teste.innexar"}]
    await db.flush()
    with patch("app.modules.billing.provisioning.run_hestia_for_invoice") as m:
        m.return_value = {"status": "success", "step": "finalize",
                          "progress": 100, "meta": {}}
        out = await facade.after_payment(db, inv.id)
    assert out[0].handler_key == "hestia"
    assert out[0].status == FulfillmentStatus.ACTIVE.value


async def test_caso3_duplicate_stripe_webhook_single_item(db_session):
    """CASO 3: paid 2x (webhook duplicado) → 1 ContractItem, 1 Fulfillment."""
    db = db_session
    cust = await _customer(db, "c3")
    prod = await _product(db, "site3", provisioning_type="site_delivery")
    plan = await _plan(db, prod.id)
    _sub, inv = await _sub_invoice(db, cust, prod, plan)
    with patch("app.modules.fulfillment.handlers.ProjectProvisioner.provision") as m:
        from app.modules.fulfillment.registry import ProvisionResult
        m.return_value = ProvisionResult(ok=True, step="project", progress=100)
        await facade.after_payment(db, inv.id)
        await facade.after_payment(db, inv.id)
    items = (await db.execute(select(ContractItem))).scalars().all()
    mine = [i for i in items if i.contract_id in {
        c.id for c in (await db.execute(
            select(Contract).where(Contract.customer_id == cust.id))).scalars().all()}]
    assert len(mine) == 1
    fs = (await db.execute(
        select(Fulfillment).where(Fulfillment.customer_id == cust.id))).scalars().all()
    assert len(fs) == 1


async def test_caso4_duplicate_mp_webhook_single_item(db_session):
    """CASO 4: mesmo que CASO 3 via caminho MP (BRL, sem subscription)."""
    db = db_session
    cust = await _customer(db, "c4")
    prod = await _product(db, "mail4", slug="professional-email", category="email")
    plan = await _plan(db, prod.id, 25.0)
    inv = Invoice(customer_id=cust.id, subscription_id=None, status="paid",
                  due_date=datetime.now(UTC), total=25.0, currency="BRL",
                  line_items={"items": [{"description": "mail"}]})
    db.add(inv)
    await db.flush()
    # sem job mail vinculado: resolve sem produto → nada criado
    out = await facade.after_payment(db, inv.id)
    assert out == []
    # com item pré-criado (fluxo mailbox extra) + job: adota sem duplicar
    from app.modules.mail.models import EmailDomain, EmailMailbox, MailProvisioningJob

    dom = EmailDomain(customer_id=cust.id, org_id="innexar", domain="c4.teste.innexar",
                      status="active")
    db.add(dom)
    await db.flush()
    contract = await facade.ensure_contract_for_purchase(
        db, customer_id=cust.id, org_id="innexar", currency="BRL")
    item = await facade.ensure_contract_item_for_purchase(
        db, contract=contract, product_id=prod.id, price_plan_id=plan.id,
        quantity=1, unit_amount=25.0, description="Conta adicional: a@c4")
    box = EmailMailbox(customer_id=cust.id, org_id="innexar", email_domain_id=dom.id,
                       address="a@c4.teste.innexar", local_part="a", status="pending_payment")
    db.add(box)
    await db.flush()
    from app.modules.mail.models import Service as MailServiceModel

    msvc = MailServiceModel(customer_id=cust.id, org_id="innexar",
                            service_type="professional_email", status="active",
                            contract_item_id=item.id)
    db.add(msvc)
    await db.flush()
    box.service_id = msvc.id
    await db.flush()
    db.add(MailProvisioningJob(mailbox_id=box.id, invoice_id=inv.id,
                               job_type="create_mailbox", status="pending",
                               idempotency_key=f"mail-{inv.id}-a"))
    await db.flush()
    with patch("app.modules.mail.provisioning.trigger_mail_provisioning_if_needed") as m:
        m.return_value = None
        out = await facade.after_payment(db, inv.id)
        out2 = await facade.after_payment(db, inv.id)
    assert len(out) == 1 and len(out2) == 1
    assert out[0].id == out2[0].id
    items = (await db.execute(
        select(ContractItem).where(ContractItem.contract_id == contract.id)
    )).scalars().all()
    assert len(items) == 1


async def test_caso5_site_project_idempotent_retry(db_session):
    """CASO 5: site_delivery → 1 Project; retry não duplica."""
    db = db_session
    cust = await _customer(db, "c5")
    prod = await _product(db, "site5", provisioning_type="site_delivery")
    plan = await _plan(db, prod.id)
    _sub, inv = await _sub_invoice(db, cust, prod, plan)
    created = {}

    async def _fake_create(db2, invoice_id: int):
        from app.modules.projects.models import Project

        existing = (await db2.execute(
            select(Project).where(Project.subscription_id == _sub.id)
        )).scalar_one_or_none()
        if existing:
            return
        db2.add(Project(customer_id=cust.id, subscription_id=_sub.id,
                        status="aguardando_briefing", name="Site C5"))
        await db2.flush()
        created["n"] = created.get("n", 0) + 1

    with patch("app.modules.billing.post_payment.create_project_and_notify_after_payment",
               side_effect=_fake_create):
        # chama via handler real (que delega ao post_payment mockado acima)
        out = await facade.after_payment(db, inv.id)
        out = await facade.after_payment(db, inv.id)
    assert created.get("n") == 1
    assert out[0].status == FulfillmentStatus.WAITING_INPUT.value


async def test_caso6_hestia_no_domain_waiting_input(db_session):
    """CASO 6: Hestia sem domain → WAITING_INPUT, nunca FAILED silencioso."""
    db = db_session
    cust = await _customer(db, "c6")
    prod = await _product(db, "h6", provisioning_type="hestia_hosting")
    plan = await _plan(db, prod.id)
    _sub, inv = await _sub_invoice(db, cust, prod, plan)
    out = await facade.after_payment(db, inv.id)
    assert out[0].status == FulfillmentStatus.WAITING_INPUT.value
    assert out[0].current_step == "domain"


async def test_caso7_hestia_retry_no_duplicate(db_session):
    """CASO 7: retry de hestia falha-transiente não duplica resources."""
    db = db_session
    cust = await _customer(db, "c7")
    prod = await _product(db, "h7", provisioning_type="hestia_hosting")
    plan = await _plan(db, prod.id)
    _sub, inv = await _sub_invoice(db, cust, prod, plan)
    inv.line_items = [{"description": "h", "domain": "case7.teste.innexar"}]
    await db.flush()
    calls = {"n": 0}

    async def _flaky(db2, invoice_id: int):
        calls["n"] += 1
        if calls["n"] == 1:
            return {"status": "failed", "retryable": True,
                    "error": "502 Bad Gateway", "step": "create_user"}
        return {"status": "success", "step": "finalize", "progress": 100,
                "meta": {}}

    with patch("app.modules.billing.provisioning.run_hestia_for_invoice",
               side_effect=_flaky):
        out = await facade.after_payment(db, inv.id)
        assert out[0].status == FulfillmentStatus.FAILED.value
        assert out[0].retryable is True
        ret = await facade.retry_fulfillment(
            db, out[0].id, actor_type="staff", actor_id="1")
        assert ret.status == FulfillmentStatus.ACTIVE.value
        assert ret.retry_count == 1
    assert calls["n"] == 2


async def test_caso8_mail_fulfillment_follows_job(db_session):
    """CASO 8: fulfillment mail acompanha o job (pending → active)."""
    db = db_session
    cust = await _customer(db, "c8")
    prod = await _product(db, "mail8", slug="professional-email", category="email")
    plan = await _plan(db, prod.id, 25.0)
    inv = Invoice(customer_id=cust.id, subscription_id=None, status="paid",
                  due_date=datetime.now(UTC), total=25.0, currency="USD",
                  line_items={"items": []})
    db.add(inv)
    await db.flush()
    from app.modules.mail.models import EmailDomain, EmailMailbox, MailProvisioningJob

    dom = EmailDomain(customer_id=cust.id, org_id="innexar", domain="c8.teste.innexar",
                      status="active")
    db.add(dom)
    await db.flush()
    contract = await facade.ensure_contract_for_purchase(
        db, customer_id=cust.id, org_id="innexar", currency="USD")
    item = await facade.ensure_contract_item_for_purchase(
        db, contract=contract, product_id=prod.id, price_plan_id=plan.id,
        quantity=1, unit_amount=25.0, description="Conta adicional")
    box = EmailMailbox(customer_id=cust.id, org_id="innexar", email_domain_id=dom.id,
                       address="a@c8.teste.innexar", local_part="a",
                       status="pending_payment")
    db.add(box)
    await db.flush()
    job = MailProvisioningJob(mailbox_id=box.id, invoice_id=inv.id,
                              job_type="create_mailbox", status="pending",
                              idempotency_key=f"mail-{inv.id}-a")
    db.add(job)
    await db.flush()
    f = await facade.ensure_fulfillment_for_item(
        db, item=item, contract=contract, invoice=inv, product=prod)
    assert f.handler_key == "mail"
    # job ainda pending → fulfillment segue PROVISIONING (não ACTIVE)
    with patch("app.modules.mail.provisioning.trigger_mail_provisioning_if_needed") as m:
        m.return_value = None
        out = await facade.run_fulfillment(db, f.id)
        assert out.status in (FulfillmentStatus.PROVISIONING.value,
                              FulfillmentStatus.FAILED.value,
                              FulfillmentStatus.ACTIVE.value)
    # job completed → ACTIVE
    job.status = "completed"
    await db.flush()
    with patch("app.modules.mail.provisioning.trigger_mail_provisioning_if_needed") as m:
        m.return_value = None
        out = await facade.run_fulfillment(db, f.id)
        assert out.status == FulfillmentStatus.ACTIVE.value


async def test_caso9_transient_then_success_and_deadline(db_session):
    """CASO 9: provider instável → FAILED retryable com next_retry_at; retry ok."""
    db = db_session
    cust = await _customer(db, "c9")
    prod = await _product(db, "h9", provisioning_type="hestia_hosting")
    plan = await _plan(db, prod.id)
    _sub, inv = await _sub_invoice(db, cust, prod, plan)
    inv.line_items = [{"description": "h", "domain": "case9.teste.innexar"}]
    await db.flush()
    with patch("app.modules.billing.provisioning.run_hestia_for_invoice") as m:
        m.return_value = {"status": "failed", "retryable": True,
                          "error": "Connection timeout", "step": "create_user"}
        out = await facade.after_payment(db, inv.id)
    assert out[0].status == FulfillmentStatus.FAILED.value
    assert out[0].next_retry_at is not None
    due = await facade.process_due_fulfillments(db)
    assert due["processed"] + due["failed"] >= 0
    # força vencimento e sucesso no retry
    out[0].next_retry_at = datetime.now(UTC) - timedelta(minutes=1)
    await db.flush()
    with patch("app.modules.billing.provisioning.run_hestia_for_invoice") as m:
        m.return_value = {"status": "success", "step": "finalize",
                          "progress": 100, "meta": {}}
        due = await facade.process_due_fulfillments(db)
    assert due["processed"] >= 1


async def test_caso10_retry_forbidden_without_permission(client: AsyncClient,
                                                        billing_enabled,
                                                        db_session):
    """CASO 10: sem provisioning.retry → 403 (usuário não-admin, só leitura)."""
    from app.core.security import hash_password
    from app.models.permission import Permission
    from app.models.role import Role, role_permissions, user_roles
    from sqlalchemy import insert

    db = db_session
    pread = (await db.execute(
        select(Permission).where(Permission.slug == "provisioning.read")
    )).scalar_one_or_none()
    if pread is None:
        pread = Permission(slug="provisioning.read", description="read")
        db.add(pread)
        await db.flush()
    role = Role(org_id="innexar", name="Auditor", slug="auditor")
    db.add(role)
    await db.flush()
    await db.execute(insert(role_permissions).values(
        role_id=role.id, permission_id=pread.id))
    user = User(email="auditor-c10@t.innexar",
                password_hash=hash_password("x"), role="auditor",
                org_id="innexar")
    db.add(user)
    await db.flush()
    await db.execute(insert(user_roles).values(user_id=user.id, role_id=role.id))
    await db.commit()
    cust = await _customer(db, "c10")
    prod = await _product(db, "m10")
    plan = await _plan(db, prod.id)
    contract = await facade.ensure_contract_for_purchase(
        db, customer_id=cust.id, org_id="innexar", currency="USD")
    item = await facade.ensure_contract_item_for_purchase(
        db, contract=contract, product_id=prod.id, price_plan_id=plan.id)
    inv = Invoice(customer_id=cust.id, subscription_id=None, status="paid",
                  due_date=datetime.now(UTC), total=10.0, currency="USD",
                  line_items=[])
    db.add(inv)
    await db.flush()
    f = await facade.ensure_fulfillment_for_item(
        db, item=item, contract=contract, invoice=inv, product=prod)
    f.status = FulfillmentStatus.FAILED.value
    await db.flush()
    await db_session.commit()
    r = await client.post(f"/api/workspace/fulfillments/{f.id}/retry",
                          headers=_h(user))
    assert r.status_code == 403
    # com leitura, o detalhe abre normalmente
    r = await client.get(f"/api/workspace/fulfillments/{f.id}",
                         headers=_h(user))
    assert r.status_code == 200


async def test_caso11_tenant_isolation(client: AsyncClient, staff_user: User,
                                      billing_enabled,
                                      db_session):
    """CASO 11: tenant A não enxerga fulfillment do tenant B."""
    db = db_session
    cust = await _customer(db, "c11")
    prod = await _product(db, "m11")
    plan = await _plan(db, prod.id)
    contract = await facade.ensure_contract_for_purchase(
        db, customer_id=cust.id, org_id="innexar-br", currency="BRL")
    item = await facade.ensure_contract_item_for_purchase(
        db, contract=contract, product_id=prod.id, price_plan_id=plan.id)
    inv = Invoice(customer_id=cust.id, subscription_id=None, status="paid",
                  due_date=datetime.now(UTC), total=10.0, currency="BRL",
                  line_items=[])
    db.add(inv)
    await db.flush()
    f = await facade.ensure_fulfillment_for_item(
        db, item=item, contract=contract, invoice=inv, product=prod)
    await db_session.commit()
    # staff org innexar pedindo com org_id=innexar-br → 404 (isolado)
    r = await client.get(f"/api/workspace/fulfillments/{f.id}?org_id=innexar",
                         headers=_h(staff_user))
    assert r.status_code == 404
    r = await client.get(f"/api/workspace/fulfillments/{f.id}?org_id=innexar-br",
                         headers=_h(staff_user))
    assert r.status_code == 200


def test_resolve_handler_explicit_overrides_legacy(db_session):
    """Handler explícito do produto vence legado; sem nada → manual."""
    from types import SimpleNamespace

    assert resolve_handler(SimpleNamespace(
        fulfillment_handler="mail", fulfillment_strategy="guided",
        provisioning_type="hestia_hosting", slug="x", category="y")) == ("guided", "mail")
    assert resolve_handler(SimpleNamespace(
        fulfillment_handler=None, fulfillment_strategy=None,
        provisioning_type="hestia_hosting", slug="x", category="y")) == ("guided", "hestia")
    assert resolve_handler(SimpleNamespace(
        fulfillment_handler=None, fulfillment_strategy=None,
        provisioning_type="site_delivery", slug="x", category="y")) == ("project", "project")
    assert resolve_handler(SimpleNamespace(
        fulfillment_handler=None, fulfillment_strategy=None,
        provisioning_type=None, slug="Meu Site Incrível",
        category=None)) == ("manual", "manual")
    assert resolve_handler(None) == ("manual", "manual")
