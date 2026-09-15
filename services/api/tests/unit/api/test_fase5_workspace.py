"""Fase 5A: audit/search/notifications workspace (sqlite)."""

import pytest
from app.core.security import create_token_staff
from app.models.user import User
from httpx import AsyncClient


def _h(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_token_staff(user.id)}"}


@pytest.mark.asyncio
async def test_audit_list_empty(client: AsyncClient, staff_user: User):
    r = await client.get("/api/workspace/audit", headers=_h(staff_user))
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.asyncio
async def test_audit_filter_q(client: AsyncClient, staff_user: User):
    r = await client.get("/api/workspace/audit?q=zzz-nao-existe", headers=_h(staff_user))
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.asyncio
async def test_notifications_empty(client: AsyncClient, staff_user: User):
    r = await client.get("/api/workspace/notifications", headers=_h(staff_user))
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.asyncio
async def test_search_short_query(client: AsyncClient, staff_user: User):
    r = await client.get("/api/workspace/search?q=a", headers=_h(staff_user))
    assert r.status_code == 200
    assert r.json() == {}


@pytest.mark.asyncio
async def test_search_finds_customer(client: AsyncClient, staff_user: User):
    h = _h(staff_user)
    c = await client.post("/api/workspace/customers", headers=h,
                          json={"name": "Busca Total", "email": "busca-total@teste.innexar"})
    assert c.status_code == 201
    r = await client.get("/api/workspace/search?q=busca-total", headers=h)
    assert r.status_code == 200
    assert any(x["type"] == "customer" for x in r.json().get("customers", []))
    await client.delete(f"/api/workspace/customers/{c.json()['id']}", headers=h)
