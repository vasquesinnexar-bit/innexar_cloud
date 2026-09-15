"""P1: itens de contrato (PATCH/DELETE) + fatura a partir do contrato."""

import pytest
from app.core.security import create_token_staff
from app.models.user import User
from app.modules.fulfillment.models import Fulfillment  # noqa: F401 (registra metadata)
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


def _h(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_token_staff(user.id)}"}


async def _customer(client: AsyncClient, h: dict, tag: str) -> int:
    r = await client.post(
        "/api/workspace/customers",
        headers=h,
        json={"name": f"P1 {tag}", "email": f"p1-{tag}@teste.innexar"},
    )
    assert r.status_code == 201
    return r.json()["id"]


@pytest.mark.asyncio
async def test_item_crud_and_invoice_from_contract(
    client: AsyncClient,
    staff_user: User,
    billing_enabled: None,
    db_session: AsyncSession,
):
    h = _h(staff_user)
    cid = await _customer(client, h, "a")
    co = await client.post(
        "/api/workspace/billing/contracts",
        headers=h,
        json={"customer_id": cid, "currency": "BRL", "billing_interval": "monthly"},
    )
    assert co.status_code == 201
    coid = co.json()["id"]

    it = await client.post(
        f"/api/workspace/billing/contracts/{coid}/items",
        headers=h,
        json={"description": "Consultoria", "quantity": 2, "unit_amount": 400.0},
    )
    assert it.status_code == 201
    assert len(it.json()["items"]) == 1
    iid = it.json()["items"][0]["id"]

    pa = await client.patch(
        f"/api/workspace/billing/contracts/items/{iid}",
        headers=h,
        json={"quantity": 3},
    )
    assert pa.status_code == 200
    assert pa.json()["items"][0]["quantity"] == 3

    # sem preço → 422
    it2 = await client.post(
        f"/api/workspace/billing/contracts/{coid}/items",
        headers=h,
        json={"description": "Sem preço"},
    )
    assert it2.status_code == 201
    bad = await client.post(
        f"/api/workspace/billing/contracts/{coid}/invoice", headers=h, json={}
    )
    assert bad.status_code == 422

    # remove o sem-preço e fatura: 3 x 400 = 1200 BRL
    iid2 = it2.json()["items"][-1]["id"]
    de = await client.delete(
        f"/api/workspace/billing/contracts/items/{iid2}", headers=h
    )
    assert de.status_code == 200
    assert len(de.json()["items"]) == 1
    iv = await client.post(
        f"/api/workspace/billing/contracts/{coid}/invoice", headers=h, json={}
    )
    assert iv.status_code == 201
    assert iv.json()["total"] == 1200.0
    assert iv.json()["currency"] == "BRL"
    assert len(iv.json()["line_items"]) == 1

    # guarda: fulfillment ativo bloqueia delete (409)
    db_session.add(
        Fulfillment(
            org_id="innexar",
            customer_id=cid,
            contract_id=coid,
            contract_item_id=iid,
            handler_key="manual",
            status="active",
            idempotency_key=f"p1-{iid}",
        )
    )
    await db_session.commit()
    g = await client.delete(f"/api/workspace/billing/contracts/items/{iid}", headers=h)
    assert g.status_code == 409

    # cleanup
    await db_session.execute(
        text(f"DELETE FROM fulfillment_fulfillments WHERE customer_id={cid}")
    )
    await db_session.execute(
        text(f"DELETE FROM billing_invoices WHERE customer_id={cid}")
    )
    await db_session.execute(
        text(f"DELETE FROM billing_contract_items WHERE contract_id={coid}")
    )
    await db_session.execute(text(f"DELETE FROM billing_contracts WHERE id={coid}"))
    await db_session.commit()
    assert (
        await client.delete(f"/api/workspace/customers/{cid}", headers=h)
    ).status_code == 204
