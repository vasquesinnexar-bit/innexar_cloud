"""Fase 2: MailService com provider fake (sem Docker, sqlite em memória)."""

import pytest
from app.models.customer import Customer
from app.modules.billing.models import Contract, ContractItem, PricePlan, Product
from app.modules.mail.enums import MailboxStatus
from app.modules.mail.models import EmailDomain
from app.modules.mail.service import MailError, MailService
from sqlalchemy.ext.asyncio import AsyncSession


class FakeProvider:
    name = "fake"

    def __init__(self):
        self.boxes: dict[str, dict] = {}
        self.domains = {"cliente.com.br"}

    def list_mailboxes(self):
        from app.modules.mail.provider import MailboxInfo

        return [
            MailboxInfo(address=a, used="0", quota=v.get("quota") or "~", pct="0")
            for a, v in self.boxes.items()
        ]

    def mailbox_exists(self, address):
        return address.lower() in self.boxes

    def create_mailbox(self, address, password):
        if self.mailbox_exists(address):
            raise AssertionError("exists")
        self.boxes[address.lower()] = {"quota": None, "disabled": False}

    def change_password(self, address, password):
        assert self.mailbox_exists(address)

    def delete_mailbox(self, address):
        self.boxes.pop(address.lower(), None)

    def set_quota(self, address, quota):
        self.boxes[address.lower()]["quota"] = quota

    def disable_mailbox(self, address):
        self.boxes[address.lower()]["disabled"] = True

    def enable_mailbox(self, address):
        self.boxes[address.lower()]["disabled"] = False

    def list_aliases(self):
        return []

    def list_domains(self):
        return sorted(self.domains)


async def _customer(db, **kw):
    c = Customer(org_id="innexar", name="C", email=kw.pop("email", "c@example.com"),
                 currency="BRL", **kw)
    db.add(c)
    await db.flush()
    return c


async def _email_setup(db, customer, contracted=3, price=25.0):
    p = Product(org_id="innexar", name="E-mail Profissional", slug="professional-email",
                category="email", is_active=True)
    db.add(p)
    await db.flush()
    plan = PricePlan(product_id=p.id, name="Mensal", interval="monthly",
                     amount=price, currency="BRL")
    db.add(plan)
    await db.flush()
    ct = Contract(customer_id=customer.id, org_id="innexar", status="active")
    db.add(ct)
    await db.flush()
    db.add(ContractItem(contract_id=ct.id, product_id=p.id, price_plan_id=plan.id,
                        quantity=contracted, unit_amount=price))
    d = EmailDomain(customer_id=customer.id, org_id="innexar",
                    domain="cliente.com.br", status="active")
    db.add(d)
    await db.flush()
    return d


@pytest.mark.asyncio
async def test_create_list_mailbox(db_session: AsyncSession):
    svc = MailService(db_session, provider=FakeProvider())
    c = await _customer(db_session)
    await _email_setup(db_session, c)
    m = await svc.create_mailbox(
        customer_id=c.id, org_id="innexar", domain="cliente.com.br",
        local_part="contato", display_name=None, password="SenhaForte1",
        quota="2G", actor_type="staff", actor_id="1")
    assert m.address == "contato@cliente.com.br"
    boxes = await svc.list_mailboxes(c.id, "innexar")
    assert [b.address for b in boxes] == ["contato@cliente.com.br"]
    ent = await svc.entitlement(c.id, "innexar")
    assert (ent["contracted"], ent["used"], ent["available"]) == (3, 1, 2)
    assert ent["unit_price"] == 25.0


@pytest.mark.asyncio
async def test_duplicate_and_limit(db_session: AsyncSession):
    svc = MailService(db_session, provider=FakeProvider())
    c = await _customer(db_session, email="d@example.com")
    await _email_setup(db_session, c, contracted=1)
    await svc.create_mailbox(customer_id=c.id, org_id="innexar",
        domain="cliente.com.br", local_part="a", display_name=None,
        password="SenhaForte1", quota=None, actor_type="staff", actor_id="1")
    with pytest.raises(MailError) as e:
        await svc.create_mailbox(customer_id=c.id, org_id="innexar",
            domain="cliente.com.br", local_part="a", display_name=None,
            password="SenhaForte1", quota=None, actor_type="staff", actor_id="1")
    assert e.value.code == "mailbox_limit_reached"
    with pytest.raises(MailError):
        await svc.create_mailbox(customer_id=c.id, org_id="innexar",
            domain="cliente.com.br", local_part="###", display_name=None,
            password="SenhaForte1", quota=None, actor_type="staff", actor_id="1")


@pytest.mark.asyncio
async def test_tenant_isolation(db_session: AsyncSession):
    svc = MailService(db_session, provider=FakeProvider())
    a = await _customer(db_session, email="a@example.com")
    b = await _customer(db_session, email="b@example.com")
    await _email_setup(db_session, a)
    m = await svc.create_mailbox(customer_id=a.id, org_id="innexar",
        domain="cliente.com.br", local_part="x", display_name=None,
        password="SenhaForte1", quota=None, actor_type="staff", actor_id="1")
    with pytest.raises(MailError) as e:
        await svc.change_password(mailbox_id=m.id, customer_id=b.id,
            org_id="innexar", password="OutraSenha1",
            actor_type="customer", actor_id="9")
    assert e.value.code == "unauthorized_mailbox_access"


@pytest.mark.asyncio
async def test_password_quota_disable_enable_delete(db_session: AsyncSession):
    svc = MailService(db_session, provider=FakeProvider())
    c = await _customer(db_session, email="e@example.com")
    await _email_setup(db_session, c)
    m = await svc.create_mailbox(customer_id=c.id, org_id="innexar",
        domain="cliente.com.br", local_part="fin", display_name=None,
        password="SenhaForte1", quota=None, actor_type="staff", actor_id="1")
    with pytest.raises(MailError) as e:
        await svc.change_password(mailbox_id=m.id, customer_id=c.id,
            org_id="innexar", password="curta", actor_type="staff", actor_id="1")
    assert e.value.code == "invalid_email_password"
    await svc.change_password(mailbox_id=m.id, customer_id=c.id, org_id="innexar",
        password="NovaSenha22", actor_type="staff", actor_id="1")
    await svc.set_quota(mailbox_id=m.id, customer_id=c.id, org_id="innexar",
        quota="5G", actor_type="staff", actor_id="1")
    assert (await svc._require_mailbox(m.id, c.id, "innexar")).quota == "5G"
    await svc.set_disabled(mailbox_id=m.id, customer_id=c.id, org_id="innexar",
        disabled=True, actor_type="staff", actor_id="1")
    assert (await svc._require_mailbox(m.id, c.id, "innexar")).status == MailboxStatus.DISABLED.value
    await svc.set_disabled(mailbox_id=m.id, customer_id=c.id, org_id="innexar",
        disabled=False, actor_type="staff", actor_id="1")
    await svc.delete_mailbox(mailbox_id=m.id, customer_id=c.id, org_id="innexar",
        actor_type="staff", actor_id="1")
    assert await svc.list_mailboxes(c.id, "innexar") == []


@pytest.mark.asyncio
async def test_sync_and_jobs(db_session: AsyncSession):
    prov = FakeProvider()
    svc = MailService(db_session, provider=prov)
    c = await _customer(db_session, email="s@example.com")
    await _email_setup(db_session, c)
    prov.boxes["externo@cliente.com.br"] = {"quota": None, "disabled": False}
    rep = await svc.sync_domain(customer_id=c.id, org_id="innexar",
        domain="cliente.com.br", actor_type="staff", actor_id="1")
    assert rep["created"] == 1
    job = await svc.enqueue_job(job_type="create_mailbox", org_id="innexar",
        payload={"address": "job@cliente.com.br"}, idempotency_key="k1")
    job2 = await svc.enqueue_job(job_type="create_mailbox", org_id="innexar",
        payload={"address": "job@cliente.com.br"}, idempotency_key="k1")
    assert job.id == job2.id
    res = await svc.process_pending_jobs()
    assert res == {"done": 1, "failed": 0}
    assert prov.mailbox_exists("job@cliente.com.br")
