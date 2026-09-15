"""Fase 1 Core: Customer regional fields + Contracts API."""

import pytest
from app.core.security import create_token_staff
from app.models.user import User
from app.modules.customers.schemas import CustomerCreate
from app.modules.customers.service import CustomerService
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


def _staff_headers(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_token_staff(user.id)}"}


@pytest.mark.asyncio
async def test_create_customer_br_defaults(db_session: AsyncSession) -> None:
    svc = CustomerService(db_session)
    resp = await svc.create_customer(
        CustomerCreate(name="BR", email="br1@example.com"), org_id="innexar-br"
    )
    assert resp.country == "BR"
    assert resp.locale == "pt-BR"
    assert resp.currency == "BRL"
    assert resp.billing_provider is None


@pytest.mark.asyncio
async def test_create_customer_us_defaults_and_explicit(
    db_session: AsyncSession,
) -> None:
    svc = CustomerService(db_session)
    resp = await svc.create_customer(
        CustomerCreate(
            name="US",
            email="us1@example.com",
            billing_provider="stripe",
            tax_id="12-3456789",
            company="Acme LLC",
        ),
        org_id="innexar",
    )
    assert (resp.country, resp.locale, resp.currency) == ("US", "en-US", "USD")
    assert resp.billing_provider == "stripe"
    assert resp.company == "Acme LLC"


@pytest.mark.asyncio
async def test_customer_create_rejects_bad_provider(db_session: AsyncSession) -> None:
    svc = CustomerService(db_session)
    with pytest.raises(ValueError):
        CustomerCreate(name="X", email="x@example.com", billing_provider="paypal")
    assert svc is not None


@pytest.mark.asyncio
async def test_contracts_crud(
    client: AsyncClient, staff_user: User, billing_enabled: None
) -> None:
    h = _staff_headers(staff_user)
    c = await client.post(
        "/api/workspace/customers",
        headers=h,
        json={
            "name": "Contrato SA",
            "email": "contrato@example.com",
            "country": "BR",
            "currency": "BRL",
            "billing_provider": "mercadopago",
        },
    )
    assert c.status_code == 201, c.text
    cid = c.json()["id"]
    assert c.json()["billing_provider"] == "mercadopago"

    r = await client.post(
        "/api/workspace/billing/contracts",
        headers=h,
        json={
            "customer_id": cid,
            "items": [
                {"description": "E-mail 3 contas", "quantity": 3, "unit_amount": 25}
            ],
        },
    )
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["status"] == "pending"
    assert data["currency"] == "BRL"  # herdada do customer
    assert len(data["items"]) == 1

    g = await client.get(f"/api/workspace/billing/contracts/{data['id']}", headers=h)
    assert g.status_code == 200

    p = await client.patch(
        f"/api/workspace/billing/contracts/{data['id']}",
        headers=h,
        json={"status": "active", "billing_provider": "stripe"},
    )
    assert p.status_code == 200
    assert p.json()["status"] == "active"
    assert p.json()["billing_provider"] == "stripe"

    bad = await client.patch(
        f"/api/workspace/billing/contracts/{data['id']}",
        headers=h,
        json={"status": "inexistente"},
    )
    assert bad.status_code == 422
