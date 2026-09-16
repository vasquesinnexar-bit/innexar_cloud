"""P1.3 onboarding engine: 20 casos (unit + API). Sem rede (mocks)."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from app.core.security import create_token_customer
from app.models.customer_user import CustomerUser
from app.models.user import User
from app.modules.fulfillment.enums import FulfillmentStatus
from app.modules.fulfillment.models import Fulfillment
from app.modules.onboarding import service as onboarding
from app.modules.onboarding.enums import OnboardingStatus
from app.modules.onboarding.models import OnboardingSession
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


async def _fulfillment(db: AsyncSession, customer_id: int, handler: str = "mail"):
    f = Fulfillment(
        org_id="innexar",
        customer_id=customer_id,
        contract_id=1,
        contract_item_id=1,
        handler_key=handler,
        status=FulfillmentStatus.WAITING_INPUT.value,
        current_step="domain",
        idempotency_key=f"t-{customer_id}-{handler}",
    )
    db.add(f)
    await db.flush()
    return f


async def _session(db, customer_id, type="professional_email", fulfillment_id=None):
    return await onboarding.ensure_session(
        db,
        customer_id=customer_id,
        org_id="innexar",
        type=type,
        fulfillment_id=fulfillment_id,
        actor_type="system",
        actor_id=None,
    )


@pytest.mark.asyncio
async def test_01_payment_creates_onboarding(db_session: AsyncSession):
    f = await _fulfillment(db_session, 1001)
    from app.modules.fulfillment import facade

    await facade._ensure_onboarding(db_session, f, actor_type="system", actor_id=None)
    s = await onboarding.get_active_session(
        db_session, customer_id=1001, fulfillment_id=f.id
    )
    assert s is not None and s.type == "professional_email"


@pytest.mark.asyncio
async def test_02_duplicate_webhook_single_session(db_session: AsyncSession):
    f = await _fulfillment(db_session, 1002)
    from app.modules.fulfillment import facade

    await facade._ensure_onboarding(db_session, f, actor_type="system", actor_id=None)
    await facade._ensure_onboarding(db_session, f, actor_type="system", actor_id=None)
    rows = (
        (
            await db_session.execute(
                select(OnboardingSession).where(
                    OnboardingSession.fulfillment_id == f.id
                )
            )
        )
        .scalars()
        .all()
    )
    assert len(rows) == 1


@pytest.mark.asyncio
async def test_03_resume_same_step(db_session: AsyncSession):
    s = await _session(db_session, 1003)
    assert s.current_step == "domain"
    again = await onboarding.get_active_session(db_session, customer_id=1003)
    assert again and again.id == s.id and again.current_step == "domain"


@pytest.mark.asyncio
async def test_04_resume_after_login(db_session: AsyncSession):
    s = await _session(db_session, 1004)
    await db_session.commit()
    again = await onboarding.get_active_session(db_session, customer_id=1004)
    assert again and again.id == s.id


@pytest.mark.asyncio
async def test_05_invalid_domain_rejected(db_session: AsyncSession):
    s = await _session(db_session, 1005)
    out = await onboarding.submit_step(
        db_session,
        s.id,
        "domain",
        {"domain": "not-an-email@x"},
        actor_type="customer",
        actor_id="1",
    )
    steps = await onboarding._steps_map(db_session, s)
    assert steps["domain"].status != "completed"
    assert out.status == OnboardingStatus.WAITING_CUSTOMER.value


@pytest.mark.asyncio
async def test_06_other_tenant_domain_rejected(db_session: AsyncSession):
    from app.modules.mail.models import EmailDomain

    db_session.add(
        EmailDomain(
            customer_id=9999,
            org_id="innexar",
            domain="alheio.teste.innexar",
            status="active",
        )
    )
    await db_session.flush()
    s = await _session(db_session, 1006)
    out = await onboarding.submit_step(
        db_session,
        s.id,
        "domain",
        {"domain": "alheio.teste.innexar"},
        actor_type="customer",
        actor_id="1",
    )
    steps = await onboarding._steps_map(db_session, s)
    assert steps["domain"].status != "completed"
    assert "outro cliente" in (out.last_error or "")


@pytest.mark.asyncio
async def test_07_ns_detects_cloudflare():
    from app.modules.onboarding import dns_discovery

    with patch.object(
        dns_discovery, "_resolve", return_value=["carl.ns.cloudflare.com"]
    ):
        assert (
            dns_discovery.detect_dns_provider(["carl.ns.cloudflare.com"])
            == "Cloudflare"
        )


@pytest.mark.asyncio
async def test_08_unknown_dns_provider():
    from app.modules.onboarding import dns_discovery

    assert dns_discovery.detect_dns_provider(["ns1.provedor-xyz.net"]) is None
    assert dns_discovery.detect_dns_provider([]) is None


@pytest.mark.asyncio
async def test_09_existing_mx_detected():
    from app.modules.onboarding import dns_discovery

    assert (
        dns_discovery.detect_mail_provider(["aspmx.l.google.com"]) == "Google Workspace"
    )
    assert dns_discovery.detect_mail_provider(["mail.empresa.com.br"]) == "Outro"
    assert dns_discovery.detect_mail_provider([]) is None


@pytest.mark.asyncio
async def test_10_existing_spf_conflict():
    from app.modules.onboarding import dns_apply

    existing = [
        {
            "id": "1",
            "type": "TXT",
            "name": "empresa.com.br",
            "content": "v=spf1 include:_spf.google.com ~all",
        }
    ]
    desired = dns_apply.desired_records("empresa.com.br", None)
    preview = dns_apply.build_preview(existing, desired, "empresa.com.br")
    kinds = {c["type"] for c in preview["conflicts"]}
    assert "TXT" in kinds


@pytest.mark.asyncio
async def test_11_dns_partial_blocked(db_session: AsyncSession):
    s = await _session(db_session, 1011)
    await onboarding.submit_step(
        db_session,
        s.id,
        "domain",
        {"domain": "pendente.teste.innexar"},
        actor_type="customer",
        actor_id="1",
    )
    fake_checks = {
        "mx": {"ok": True},
        "spf": {"ok": False},
        "dkim": {"ok": False},
        "dmarc": {"ok": True},
    }
    with patch(
        "app.modules.mail.service.check_domain_dns",
        return_value={"domain": "x", "checks": {**fake_checks, "all_ok": False}},
    ):
        out = await onboarding.submit_step(
            db_session,
            s.id,
            "dns_verification",
            {},
            actor_type="customer",
            actor_id="1",
        )
    assert out.status != OnboardingStatus.COMPLETED.value
    steps = await onboarding._steps_map(db_session, s)
    assert steps["dns_verification"].status != "completed"


@pytest.mark.asyncio
async def test_12_verified_auto_resume(db_session: AsyncSession):
    s = await _session(db_session, 1012)
    await onboarding.submit_step(
        db_session,
        s.id,
        "domain",
        {"domain": "ok.teste.innexar"},
        actor_type="customer",
        actor_id="1",
    )
    good = {
        "mx": {"ok": True},
        "spf": {"ok": True},
        "dkim": {"ok": True},
        "dmarc": {"ok": True},
    }
    with patch(
        "app.modules.mail.service.check_domain_dns",
        return_value={"domain": "x", "checks": {**good, "all_ok": True}},
    ):
        await onboarding.submit_step(
            db_session,
            s.id,
            "dns_verification",
            {},
            actor_type="customer",
            actor_id="1",
        )
    steps = await onboarding._steps_map(db_session, s)
    assert steps["dns_verification"].status == "completed"


@pytest.mark.asyncio
async def test_13_mailbox_counts(db_session: AsyncSession):
    from app.modules.mail.models import EmailDomain, EmailMailbox
    from app.modules.onboarding.handlers import ProfessionalEmailOnboarding

    s = await _session(db_session, 1013)
    dom = EmailDomain(
        customer_id=1013, org_id="innexar", domain="cx.teste.innexar", status="active"
    )
    db_session.add(dom)
    await db_session.flush()
    for local in ("a", "b"):
        db_session.add(
            EmailMailbox(
                customer_id=1013,
                org_id="innexar",
                email_domain_id=dom.id,
                address=f"{local}@cx.teste.innexar",
                local_part=local,
                status="active",
            )
        )
    await db_session.flush()
    # registra domínio na sessão (ownership: já vinculado ao cliente)
    await onboarding.submit_step(
        db_session,
        s.id,
        "domain",
        {"domain": "cx.teste.innexar"},
        actor_type="customer",
        actor_id="1",
    )
    handler = ProfessionalEmailOnboarding()
    fake_svc = MagicMock()
    fake_svc.entitlement = AsyncMock(
        return_value={"contracted": 3, "used": 2, "available": 1}
    )

    async def _fake_create(**kw):
        m = MagicMock()
        m.address = f"{kw['local_part']}@cx.teste.innexar"
        return m

    fake_svc.create_mailbox = _fake_create
    with patch("app.modules.mail.service.MailService", return_value=fake_svc):
        ok = await handler._submit_mailboxes(
            db_session,
            s,
            {"mailboxes": [{"local_part": "c", "password": "Segura123"}]},
            actor_type="customer",
            actor_id="1",
        )
        assert ok.ok is True
        bad = await handler._submit_mailboxes(
            db_session,
            s,
            {
                "mailboxes": [
                    {"local_part": "c", "password": "Segura123"},
                    {"local_part": "d", "password": "Segura123"},
                ]
            },
            actor_type="customer",
            actor_id="1",
        )
        assert bad.ok is False


@pytest.mark.asyncio
async def test_14_entitlement_exceeded_rejected(db_session: AsyncSession):
    from app.modules.mail.models import EmailDomain
    from app.modules.onboarding.handlers import ProfessionalEmailOnboarding

    s = await _session(db_session, 1014)
    db_session.add(
        EmailDomain(
            customer_id=1014,
            org_id="innexar",
            domain="lim.teste.innexar",
            status="active",
        )
    )
    await db_session.flush()
    await onboarding.submit_step(
        db_session,
        s.id,
        "domain",
        {"domain": "lim.teste.innexar"},
        actor_type="customer",
        actor_id="1",
    )
    handler = ProfessionalEmailOnboarding()
    fake_svc = MagicMock()
    fake_svc.entitlement = AsyncMock(
        return_value={"contracted": 1, "used": 1, "available": 0}
    )
    with patch("app.modules.mail.service.MailService", return_value=fake_svc):
        out = await handler._submit_mailboxes(
            db_session,
            s,
            {"mailboxes": [{"local_part": "x", "password": "Segura123"}]},
            actor_type="customer",
            actor_id="1",
        )
    assert out.ok is False and "limite" in (out.error or "")


@pytest.mark.asyncio
async def test_15_provisioning_success_active(db_session: AsyncSession):
    from app.modules.mail.models import EmailDomain, EmailMailbox
    from app.modules.onboarding.handlers import ProfessionalEmailOnboarding

    s = await _session(db_session, 1015)
    dom = EmailDomain(
        customer_id=1015, org_id="innexar", domain="ok2.teste.innexar", status="active"
    )
    db_session.add(dom)
    await db_session.flush()
    db_session.add(
        EmailMailbox(
            customer_id=1015,
            org_id="innexar",
            email_domain_id=dom.id,
            address="a@ok2.teste.innexar",
            local_part="a",
            status="active",
        )
    )
    await db_session.flush()
    handler = ProfessionalEmailOnboarding()
    fake_svc = MagicMock()
    fake_svc.mailbox_usage = MagicMock(
        return_value={"a@ok2.teste.innexar": {"used": "1K"}}
    )
    with patch("app.modules.mail.service.MailService", return_value=fake_svc):
        out = await handler._run_provisioning(db_session, s)
    assert out.ok is True


@pytest.mark.asyncio
async def test_16_provider_failure_retryable(db_session: AsyncSession):
    from app.modules.onboarding.handlers import ProfessionalEmailOnboarding

    s = await _session(db_session, 1016)
    handler = ProfessionalEmailOnboarding()
    fake_svc = MagicMock()
    fake_svc.mailbox_usage = MagicMock(side_effect=RuntimeError("timeout"))
    with patch("app.modules.mail.service.MailService", return_value=fake_svc):
        out = await handler._run_provisioning(db_session, s)
    assert out.ok is False


@pytest.mark.asyncio
async def test_17_idor_blocked(
    client: AsyncClient, db_session: AsyncSession, billing_enabled: None
):
    from app.core.security import hash_password
    from app.models.customer import Customer

    async def _mk(tag: str):
        cust = Customer(org_id="innexar", name=tag, email=f"{tag}@t.innexar")
        db_session.add(cust)
        await db_session.flush()
        cu = CustomerUser(
            customer_id=cust.id,
            email=cust.email,
            password_hash=hash_password("x"),
            email_verified=True,
        )
        db_session.add(cu)
        await db_session.flush()
        return cust, cu

    cust_a, cu_a = await _mk("idor-a")
    _cust_b, cu_b = await _mk("idor-b")
    s = await _session(db_session, cust_a.id)
    ha = {"Authorization": f"Bearer {create_token_customer(cu_a.id)}"}
    hb = {"Authorization": f"Bearer {create_token_customer(cu_b.id)}"}
    assert (
        await client.get(f"/api/portal/onboarding/{s.id}", headers=ha)
    ).status_code == 200
    assert (
        await client.get(f"/api/portal/onboarding/{s.id}", headers=hb)
    ).status_code == 404
    assert (
        await client.post(
            f"/api/portal/onboarding/{s.id}/submit/domain",
            headers=hb,
            json={"data": {"domain": "x.teste.innexar"}},
        )
    ).status_code == 404


@pytest.mark.asyncio
async def test_18_cf_duplicate_apply_no_dupes():
    from app.modules.onboarding import dns_apply

    existing = [
        {
            "id": "1",
            "type": "MX",
            "name": "empresa.com.br",
            "content": "mail.empresa.com.br",
        },
        {
            "id": "2",
            "type": "TXT",
            "name": "empresa.com.br",
            "content": "v=spf1 mx a:mail.empresa.com.br ip4:1.2.3.4 -all",
        },
    ]
    desired = [
        {"type": "MX", "name": "@", "content": "mail.empresa.com.br", "priority": 10},
        {
            "type": "TXT",
            "name": "@",
            "content": "v=spf1 mx a:mail.empresa.com.br ip4:1.2.3.4 -all",
        },
    ]
    preview = dns_apply.build_preview(existing, desired, "empresa.com.br")
    assert preview["add"] == [] and len(preview["keep"]) == 2

    created = []

    class FakeCF:
        def list_dns_records(self, zone_id, rtype=None, name=None):
            return existing

        def create_dns_record(self, *a, **k):
            created.append(a)
            return {"id": "new"}

        def delete_dns_record(self, *a):
            return {}

    out = await dns_apply.apply_preview(
        FakeCF(), "z1", "empresa.com.br", preview, snapshot=existing
    )
    assert out["created"] == 0
    assert created == []


@pytest.mark.asyncio
async def test_19_briefing_advances(db_session: AsyncSession):
    from app.models.customer import Customer
    from app.modules.projects.models import Project

    cust = Customer(org_id="innexar", name="B19", email="b19@t.innexar")
    db_session.add(cust)
    await db_session.flush()
    proj = Project(customer_id=cust.id, name="Site", status="aguardando_briefing")
    db_session.add(proj)
    await db_session.flush()
    f = await _fulfillment(db_session, cust.id, handler="project")
    f.project_id = proj.id
    await db_session.flush()
    s = await _session(db_session, cust.id, type="website_project", fulfillment_id=f.id)
    await onboarding.complete_step_for_project(
        db_session, proj.id, actor_type="customer", actor_id="1"
    )
    assert s.status == "completed"
    await db_session.refresh(f)
    assert f.status == "manual_review"


@pytest.mark.asyncio
async def test_20_admin_created_same_onboarding(db_session: AsyncSession):
    s = await onboarding.ensure_session(
        db_session,
        customer_id=1020,
        org_id="innexar",
        type="professional_email",
        actor_type="staff",
        actor_id="9",
    )
    assert s.type == "professional_email"
    again = await onboarding.ensure_session(
        db_session,
        customer_id=1020,
        org_id="innexar",
        type="professional_email",
        actor_type="staff",
        actor_id="9",
    )
    assert again.id == s.id


@pytest.mark.asyncio
async def test_21_workspace_list_requires_perm(
    client: AsyncClient, db_session: AsyncSession, billing_enabled: None
):
    from app.core.security import create_token_staff, hash_password
    from app.models.permission import Permission
    from app.models.role import Role, role_permissions, user_roles
    from app.models.user import User
    from sqlalchemy import insert, select

    pread = (
        await db_session.execute(
            select(Permission).where(Permission.slug == "onboarding.read")
        )
    ).scalar_one_or_none()
    if pread is None:
        pread = Permission(slug="onboarding.read", description="read")
        db_session.add(pread)
        await db_session.flush()
    role = Role(org_id="innexar", name="Auditor21", slug="auditor21")
    db_session.add(role)
    await db_session.flush()
    await db_session.execute(
        insert(role_permissions).values(role_id=role.id, permission_id=pread.id)
    )
    user = User(
        email="auditor21@t.innexar",
        password_hash=hash_password("x"),
        role="auditor21",
        org_id="innexar",
    )
    db_session.add(user)
    await db_session.flush()
    await db_session.execute(
        insert(user_roles).values(user_id=user.id, role_id=role.id)
    )
    await db_session.commit()
    h = {"Authorization": f"Bearer {create_token_staff(user.id)}"}
    assert (
        await client.get("/api/workspace/onboardings", headers=h)
    ).status_code == 200
    assert (
        await client.post("/api/workspace/onboardings/999999/retry", headers=h)
    ).status_code == 403


@pytest.mark.asyncio
async def test_22_workspace_tenant_isolation(
    client: AsyncClient,
    staff_user: User,
    db_session: AsyncSession,
    billing_enabled: None,
):
    from app.core.security import create_token_staff

    s = await _session(db_session, 1022)
    s.org_id = "innexar-br"
    await db_session.flush()
    await db_session.commit()
    h = {"Authorization": f"Bearer {create_token_staff(staff_user.id)}"}
    assert (
        await client.get(f"/api/workspace/onboardings/{s.id}?org_id=innexar", headers=h)
    ).status_code == 404
    assert (
        await client.get(
            f"/api/workspace/onboardings/{s.id}?org_id=innexar-br", headers=h
        )
    ).status_code == 200


@pytest.mark.asyncio
async def test_23_next_action_shapes(
    client: AsyncClient,
    staff_user: User,
    db_session: AsyncSession,
    billing_enabled: None,
):
    from app.core.security import create_token_staff
    from app.modules.fulfillment.enums import FulfillmentStatus
    from app.modules.fulfillment.models import Fulfillment
    from app.modules.onboarding.service import next_action_for_fulfillment

    h = {"Authorization": f"Bearer {create_token_staff(staff_user.id)}"}
    f = Fulfillment(
        org_id="innexar",
        customer_id=1023,
        contract_id=1,
        contract_item_id=1,
        handler_key="mail",
        status=FulfillmentStatus.WAITING_INPUT.value,
        current_step="domain",
        idempotency_key="t23",
    )
    db_session.add(f)
    await db_session.flush()
    s = await _session(db_session, 1023)
    action = await next_action_for_fulfillment(db_session, f)
    assert action and action["type"] == "onboarding"
    assert action["href"] == "/services/email/setup"
    r = await client.get(f"/api/workspace/onboardings/{s.id}", headers=h)
    assert r.status_code == 200
