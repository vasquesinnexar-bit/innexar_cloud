"""Fase 4: hosting API — link, tenant isolation, jobs (sqlite; docker real p/ inspect)."""

import pytest
from app.core.security import create_token_staff
from app.models.user import User
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


def _staff_headers(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_token_staff(user.id)}"}


async def _mk_customer(client: AsyncClient, h: dict, email: str) -> int:
    r = await client.post(
        "/api/workspace/customers", headers=h, json={"name": "H", "email": email}
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


@pytest.mark.asyncio
async def test_link_and_list(
    client: AsyncClient, staff_user: User, billing_enabled: None
):
    h = _staff_headers(staff_user)
    cid = await _mk_customer(client, h, "host-a@teste.innexar")
    r = await client.post(
        "/api/workspace/hosting/services",
        headers=h,
        json={
            "customer_id": cid,
            "container_name": "innexar-mail-portal",
            "root_path": "/usr/share/nginx/html",
            "primary_domain": "mail.innexar.com.br",
        },
    )
    assert r.status_code == 201, r.text
    sid = r.json()["id"]
    lst = await client.get(
        "/api/workspace/hosting/services", headers=h, params={"customer_id": cid}
    )
    assert lst.status_code == 200 and len(lst.json()) == 1
    ov = await client.get(f"/api/workspace/hosting/services/{sid}/overview", headers=h)
    assert ov.status_code == 200
    assert ov.json()["runtime"] in (
        "online",
        "offline",
        "unknown",
        "degraded",
        "suspended",
    )
    assert "mail.innexar.com.br" in (ov.json().get("domains") or [])


@pytest.mark.asyncio
async def test_link_unknown_container_502(
    client: AsyncClient, staff_user: User, billing_enabled: None
):
    h = _staff_headers(staff_user)
    cid = await _mk_customer(client, h, "host-b@teste.innexar")
    r = await client.post(
        "/api/workspace/hosting/services",
        headers=h,
        json={
            "customer_id": cid,
            "container_name": "nao-existe-xyz",
            "root_path": "/app",
        },
    )
    assert r.status_code == 502


@pytest.mark.asyncio
async def test_idor(
    client: AsyncClient,
    staff_user: User,
    billing_enabled: None,
    db_session: AsyncSession,
):
    from app.core.security import hash_password
    from app.models.customer_user import CustomerUser

    h = _staff_headers(staff_user)
    cid_a = await _mk_customer(client, h, "host-idor-a@teste.innexar")
    cid_b = await _mk_customer(client, h, "host-idor-b@teste.innexar")
    r = await client.post(
        "/api/workspace/hosting/services",
        headers=h,
        json={
            "customer_id": cid_a,
            "container_name": "innexar-mail-portal",
            "root_path": "/usr/share/nginx/html",
        },
    )
    sid = r.json()["id"]
    # JWT do cliente B
    cu = CustomerUser(
        customer_id=cid_b,
        email="host-idor-b@teste.innexar",
        password_hash=hash_password("SenhaForte1"),
    )
    db_session.add(cu)
    await db_session.flush()
    from app.core.security import create_token_customer

    bh = {"Authorization": f"Bearer {create_token_customer(cu.id)}"}
    for method, url in [
        ("get", f"/api/portal/hosting/services/{sid}/overview"),
        ("get", f"/api/portal/hosting/services/{sid}/files?path=."),
        ("post", f"/api/portal/hosting/services/{sid}/restart"),
    ]:
        res = await client.request(method, url, headers=bh)
        assert res.status_code == 404, (method, url, res.status_code)
    mine = await client.get("/api/portal/hosting/services", headers=bh)
    assert mine.status_code == 200 and mine.json() == []
