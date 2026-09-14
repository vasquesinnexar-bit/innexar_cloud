"""Unit tests for CustomerService."""

import pytest
from app.models.customer import Customer
from app.models.customer_user import CustomerUser
from app.models.notification import Notification
from app.modules.billing.models import PricePlan, Product, Subscription
from app.modules.customers.schemas import CustomerCreate, CustomerUpdate
from app.modules.customers.service import CustomerService
from app.modules.projects.models import Project
from app.modules.support.models import Ticket, TicketMessage
from app.repositories.billing_repository import BillingRepository
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_list_customers_empty(db_session: AsyncSession) -> None:
    """List when no customers returns empty list."""
    svc = CustomerService(db_session)
    result = await svc.list_customers()
    assert result == []


@pytest.mark.asyncio
async def test_create_customer(db_session: AsyncSession) -> None:
    """Create customer returns CustomerResponse."""
    svc = CustomerService(db_session)
    body = CustomerCreate(name="New", email="new@example.com")
    resp = await svc.create_customer(body)
    assert resp.name == "New"
    assert resp.email == "new@example.com"
    assert resp.id is not None
    assert resp.has_portal_access is False


@pytest.mark.asyncio
async def test_create_customer_duplicate_email_raises(db_session: AsyncSession) -> None:
    """Create with existing email raises ValueError."""
    svc = CustomerService(db_session)
    body = CustomerCreate(name="A", email="dup@example.com")
    await svc.create_customer(body)
    with pytest.raises(ValueError, match="already exists"):
        await svc.create_customer(body)


@pytest.mark.asyncio
async def test_get_customer_not_found(db_session: AsyncSession) -> None:
    """Get non-existent customer returns None."""
    svc = CustomerService(db_session)
    assert await svc.get_customer(999) is None


@pytest.mark.asyncio
async def test_update_customer_not_found(db_session: AsyncSession) -> None:
    """Update non-existent customer returns None."""
    svc = CustomerService(db_session)
    result = await svc.update_customer(999, CustomerUpdate(name="X"))
    assert result is None


@pytest.mark.asyncio
async def test_delete_customer_not_found(db_session: AsyncSession) -> None:
    """Delete non-existent customer returns False."""
    svc = CustomerService(db_session)
    assert await svc.delete_customer(999) is False


@pytest.mark.asyncio
async def test_delete_customer_with_project_and_subscription(
    db_session: AsyncSession,
) -> None:
    """Delete customer removes project first, then billing, then customer (no FK errors)."""
    cust = Customer(org_id="innexar", name="WithProj", email="wp@example.com")
    db_session.add(cust)
    await db_session.flush()
    prod = Product(name="P", is_active=True)
    db_session.add(prod)
    await db_session.flush()
    plan = PricePlan(
        product_id=prod.id, name="Plan", interval="monthly", amount=1, currency="BRL"
    )
    db_session.add(plan)
    await db_session.flush()

    br = BillingRepository(db_session)
    sub = Subscription(
        customer_id=cust.id,
        product_id=prod.id,
        price_plan_id=plan.id,
        status="inactive",
    )
    br.add_subscription(sub)
    await br.update_subscription(sub)

    proj = Project(
        org_id="innexar",
        customer_id=cust.id,
        name="Site",
        subscription_id=sub.id,
    )
    db_session.add(proj)
    await db_session.flush()

    svc = CustomerService(db_session)
    assert await svc.delete_customer(cust.id) is True

    r = await db_session.execute(select(Customer).where(Customer.id == cust.id))
    assert r.scalar_one_or_none() is None
    r2 = await db_session.execute(select(Project).where(Project.customer_id == cust.id))
    assert r2.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_delete_customer_removes_notifications_for_portal_users(
    db_session: AsyncSession,
) -> None:
    """Notifications reference customer_users without CASCADE; delete them before users."""
    cust = Customer(org_id="innexar", name="NotifCust", email="nc@example.com")
    db_session.add(cust)
    await db_session.flush()
    cu = CustomerUser(
        customer_id=cust.id,
        email="portal_nc@example.com",
        password_hash="hash",
    )
    db_session.add(cu)
    await db_session.flush()
    db_session.add(
        Notification(
            customer_user_id=cu.id,
            channel="in_app",
            title="Hello",
        )
    )
    await db_session.flush()

    svc = CustomerService(db_session)
    assert await svc.delete_customer(cust.id) is True

    r = await db_session.execute(
        select(Notification).where(Notification.customer_user_id == cu.id)
    )
    assert r.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_delete_customer_removes_support_tickets(
    db_session: AsyncSession,
) -> None:
    """support_tickets.customer_id is NOT NULL; delete tickets before customer row."""
    cust = Customer(org_id="innexar", name="TicketCust", email="tc@example.com")
    db_session.add(cust)
    await db_session.flush()
    ticket = Ticket(
        org_id="innexar",
        customer_id=cust.id,
        subject="Help",
        status="open",
    )
    db_session.add(ticket)
    await db_session.flush()
    db_session.add(
        TicketMessage(
            ticket_id=ticket.id,
            author_type="customer",
            body="msg",
        )
    )
    await db_session.flush()

    svc = CustomerService(db_session)
    assert await svc.delete_customer(cust.id) is True

    r = await db_session.execute(select(Ticket).where(Ticket.id == ticket.id))
    assert r.scalar_one_or_none() is None
