"""Workspace fulfillment endpoints: central de provisionamento (P0)."""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import log_audit
from app.core.database import get_db
from app.core.rbac import RequirePermission
from app.models.customer import Customer
from app.models.user import User
from app.modules.billing.dependencies import require_billing_enabled
from app.modules.billing.models import ContractItem, Product
from app.modules.fulfillment import facade
from app.modules.fulfillment.models import Fulfillment
from app.modules.fulfillment.schemas import FulfillmentAction, FulfillmentResponse

router = APIRouter()

READ = RequirePermission("provisioning.read")
RETRY = RequirePermission("provisioning.retry")
MANAGE = RequirePermission("provisioning.manage")


async def _to_response(db: AsyncSession, f: Fulfillment) -> dict:
    cust = await db.get(Customer, f.customer_id)
    product = await db.get(Product, f.product_id) if f.product_id else None
    return {
        "id": f.id, "org_id": f.org_id, "customer_id": f.customer_id,
        "customer_name": cust.name if cust else None,
        "contract_id": f.contract_id, "contract_item_id": f.contract_item_id,
        "product_id": f.product_id,
        "product_name": product.name if product else None,
        "invoice_id": f.invoice_id, "subscription_id": f.subscription_id,
        "service_id": f.service_id, "project_id": f.project_id,
        "strategy": f.strategy, "handler_key": f.handler_key,
        "status": f.status, "current_step": f.current_step,
        "progress": f.progress, "last_error": f.last_error,
        "retryable": f.retryable, "retry_count": f.retry_count,
        "next_retry_at": f.next_retry_at, "started_at": f.started_at,
        "completed_at": f.completed_at, "created_at": f.created_at,
        "updated_at": f.updated_at,
    }


@router.get("/fulfillments", response_model=list[FulfillmentResponse])
async def list_fulfillments(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(READ)],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
    status: str | None = None,
    handler: str | None = None,
    customer_id: int | None = None,
    product_id: int | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
):
    from app.core.router_org import router_org_list_filter

    of = router_org_list_filter(org_id)
    q = select(Fulfillment).order_by(Fulfillment.id.desc())
    if of is not None:
        q = q.where(Fulfillment.org_id == of)
    if status:
        q = q.where(Fulfillment.status == status)
    if handler:
        q = q.where(Fulfillment.handler_key == handler)
    if customer_id is not None:
        q = q.where(Fulfillment.customer_id == customer_id)
    if product_id is not None:
        q = q.where(Fulfillment.product_id == product_id)
    if date_from is not None:
        q = q.where(Fulfillment.created_at >= date_from)
    if date_to is not None:
        q = q.where(Fulfillment.created_at <= date_to)
    rows = (await db.execute(q.limit(200))).scalars().all()
    return [await _to_response(db, f) for f in rows]


@router.get("/fulfillments/{fulfillment_id}", response_model=FulfillmentResponse)
async def get_fulfillment(
    fulfillment_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(READ)],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
):
    from app.core.router_org import router_org_list_filter

    of = router_org_list_filter(org_id)
    q = select(Fulfillment).where(Fulfillment.id == fulfillment_id)
    if of is not None:
        q = q.where(Fulfillment.org_id == of)
    f = (await db.execute(q)).scalar_one_or_none()
    if not f:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Fulfillment não encontrado")
    out = await _to_response(db, f)
    item = await db.get(ContractItem, f.contract_item_id)
    out["contract_item"] = {
        "id": item.id, "description": item.description,
        "quantity": item.quantity,
        "unit_amount": float(item.unit_amount) if item.unit_amount is not None else None,
    } if item else None
    return out


@router.get("/customers/{customer_id}/fulfillments",
            response_model=list[FulfillmentResponse])
async def customer_fulfillments(
    customer_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(READ)],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
):
    from app.core.router_org import router_org_list_filter

    of = router_org_list_filter(org_id)
    q = select(Fulfillment).where(Fulfillment.customer_id == customer_id)
    if of is not None:
        q = q.where(Fulfillment.org_id == of)
    rows = (await db.execute(
        q.order_by(Fulfillment.id.desc()).limit(100))).scalars().all()
    return [await _to_response(db, f) for f in rows]


@router.post("/fulfillments/{fulfillment_id}/retry",
             response_model=FulfillmentResponse)
async def retry_fulfillment(
    fulfillment_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(RETRY)],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
):
    from app.core.router_org import router_org_write

    org = router_org_write(current, org_id)
    f = await db.get(Fulfillment, fulfillment_id)
    if not f or f.org_id != org:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Fulfillment não encontrado")
    out = await facade.retry_fulfillment(
        db, fulfillment_id, actor_type="staff", actor_id=str(current.id))
    await db.commit()
    if not out:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Fulfillment não encontrado")
    return await _to_response(db, out)


@router.post("/fulfillments/{fulfillment_id}/resolve",
             response_model=FulfillmentResponse)
async def resolve_fulfillment(
    fulfillment_id: int,
    body: FulfillmentAction,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(MANAGE)],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
):
    from app.core.router_org import router_org_write

    org = router_org_write(current, org_id)
    f = await db.get(Fulfillment, fulfillment_id)
    if not f or f.org_id != org:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Fulfillment não encontrado")
    out = await facade.resolve_fulfillment(
        db, fulfillment_id, note=body.note,
        actor_type="staff", actor_id=str(current.id))
    await db.commit()
    return await _to_response(db, out)


@router.post("/fulfillments/{fulfillment_id}/cancel",
             response_model=FulfillmentResponse)
async def cancel_fulfillment(
    fulfillment_id: int,
    body: FulfillmentAction,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(MANAGE)],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
):
    from app.core.router_org import router_org_write

    org = router_org_write(current, org_id)
    f = await db.get(Fulfillment, fulfillment_id)
    if not f or f.org_id != org:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Fulfillment não encontrado")
    out = await facade.cancel_fulfillment(
        db, fulfillment_id, note=body.note,
        actor_type="staff", actor_id=str(current.id))
    await db.commit()
    return await _to_response(db, out)


@router.get("/fulfillments/{fulfillment_id}/audit")
async def fulfillment_audit(
    fulfillment_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(READ)],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
):
    from app.core.router_org import router_org_list_filter
    from app.models.audit_log import AuditLog

    of = router_org_list_filter(org_id)
    q = select(AuditLog).where(
        AuditLog.entity == "fulfillment",
        AuditLog.entity_id == str(fulfillment_id))
    if of is not None:
        q = q.where(AuditLog.org_id == of)
    rows = (await db.execute(
        q.order_by(AuditLog.id.desc()).limit(100))).scalars().all()
    await log_audit(db, entity="fulfillment", entity_id=str(fulfillment_id),
                    action="fulfillment_audit_viewed",
                    actor_type="staff", actor_id=str(current.id),
                    org_id=of or "innexar")
    return [{"id": r.id, "action": r.action, "actor_type": r.actor_type,
             "actor_id": r.actor_id, "created_at": r.created_at,
             "payload": r.payload} for r in rows]
