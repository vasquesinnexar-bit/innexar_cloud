"""Workspace billing: contracts CRUD (Fase 1 — relação comercial).

Contract = o que foi vendido. Service (provisionado) entra na Fase 2 (Mail).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.audit import log_audit
from app.core.database import get_db
from app.core.rbac import RequirePermission
from app.core.router_org import router_org_list_filter, router_org_write
from app.models.customer import Customer
from app.models.user import User
from app.modules.billing.dependencies import require_billing_enabled
from app.modules.billing.models import Contract, ContractItem
from app.modules.billing.schemas import InvoiceResponse
from app.modules.billing.schemas_contracts import (
    ContractCreate,
    ContractInvoiceCreate,
    ContractItemCreate,
    ContractItemUpdate,
    ContractResponse,
    ContractUpdate,
)
from app.modules.fulfillment.models import Fulfillment

router = APIRouter()


def _to_response(c: Contract) -> ContractResponse:
    return ContractResponse(
        id=c.id,
        customer_id=c.customer_id,
        org_id=str(c.org_id),
        status=str(c.status),
        currency=c.currency,
        billing_provider=c.billing_provider,
        notes=c.notes,
        starts_at=c.starts_at,
        ends_at=c.ends_at,
        billing_interval=c.billing_interval,
        billing_day=c.billing_day,
        due_days=c.due_days,
        timezone=c.timezone,
        credit_balance=float(c.credit_balance or 0),
        created_at=c.created_at,
        items=[
            {
                "id": i.id,
                "product_id": i.product_id,
                "price_plan_id": i.price_plan_id,
                "subscription_id": i.subscription_id,
                "description": i.description,
                "quantity": i.quantity,
                "unit_amount": (
                    float(i.unit_amount) if i.unit_amount is not None else None
                ),
            }
            for i in (c.items or [])
        ],
    )


@router.get("/contracts", response_model=list[ContractResponse])
async def list_contracts(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(RequirePermission("billing:read"))],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
    customer_id: int | None = None,
    status_: str | None = None,
):
    org_filter = router_org_list_filter(org_id)
    q = (
        select(Contract)
        .options(selectinload(Contract.items))
        .order_by(Contract.id.desc())
    )
    if org_filter is not None:
        q = q.where(Contract.org_id == org_filter)
    if customer_id is not None:
        q = q.where(Contract.customer_id == customer_id)
    if status_:
        q = q.where(Contract.status == status_.strip().lower())
    rows = (await db.execute(q)).scalars().all()
    return [_to_response(c) for c in rows]


@router.post("/contracts", response_model=ContractResponse, status_code=201)
async def create_contract(
    body: ContractCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(RequirePermission("billing:write"))],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
):
    org = router_org_write(current, org_id)
    cust = (
        await db.execute(
            select(Customer).where(
                Customer.id == body.customer_id, Customer.org_id == org
            )
        )
    ).scalar_one_or_none()
    if not cust:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Customer não encontrado na org")
    contract = Contract(
        customer_id=body.customer_id,
        org_id=org,
        source="workspace",
        currency=body.currency or cust.currency,
        billing_provider=body.billing_provider,
        notes=body.notes,
        starts_at=body.starts_at,
        ends_at=body.ends_at,
        billing_interval=(body.billing_interval or "monthly"),
        billing_day=body.billing_day,
        due_days=body.due_days,
        timezone=body.timezone,
        credit_balance=body.credit_balance or 0,
    )
    db.add(contract)
    await db.flush()
    for item in body.items:
        db.add(
            ContractItem(
                contract_id=contract.id,
                source="workspace",
                product_id=item.product_id,
                price_plan_id=item.price_plan_id,
                subscription_id=item.subscription_id,
                description=item.description,
                quantity=item.quantity or 1,
                unit_amount=item.unit_amount,
            )
        )
    await db.flush()
    await db.refresh(contract, attribute_names=["items"])
    return _to_response(contract)


@router.get("/contracts/{contract_id}", response_model=ContractResponse)
async def get_contract(
    contract_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(RequirePermission("billing:read"))],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
):
    org_filter = router_org_list_filter(org_id)
    q = (
        select(Contract)
        .options(selectinload(Contract.items))
        .where(Contract.id == contract_id)
    )
    if org_filter is not None:
        q = q.where(Contract.org_id == org_filter)
    c = (await db.execute(q)).scalar_one_or_none()
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Contract não encontrado")
    return _to_response(c)


@router.patch("/contracts/{contract_id}", response_model=ContractResponse)
async def update_contract(
    contract_id: int,
    body: ContractUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(RequirePermission("billing:write"))],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
):
    org_filter = router_org_list_filter(org_id)
    q = (
        select(Contract)
        .options(selectinload(Contract.items))
        .where(Contract.id == contract_id)
    )
    if org_filter is not None:
        q = q.where(Contract.org_id == org_filter)
    c = (await db.execute(q)).scalar_one_or_none()
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Contract não encontrado")
    if body.status is not None:
        c.status = body.status
    if body.currency is not None:
        c.currency = body.currency or None
    if body.billing_provider is not None:
        c.billing_provider = body.billing_provider or None
    if body.notes is not None:
        c.notes = body.notes or None
    if body.billing_interval is not None:
        c.billing_interval = body.billing_interval.strip().lower() or None
    if body.billing_day is not None:
        c.billing_day = body.billing_day
    if body.due_days is not None:
        c.due_days = body.due_days
    if body.timezone is not None:
        c.timezone = body.timezone.strip() or None
    if body.credit_balance is not None:
        c.credit_balance = body.credit_balance
    if body.ends_at is not None:
        c.ends_at = body.ends_at
    await db.flush()
    return _to_response(c)


@router.post(
    "/contracts/{contract_id}/items", response_model=ContractResponse, status_code=201
)
async def add_contract_item(
    contract_id: int,
    body: ContractItemCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(RequirePermission("billing:write"))],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
):
    org_filter = router_org_list_filter(org_id)
    q = (
        select(Contract)
        .options(selectinload(Contract.items))
        .where(Contract.id == contract_id)
    )
    if org_filter is not None:
        q = q.where(Contract.org_id == org_filter)
    c = (await db.execute(q)).scalar_one_or_none()
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Contract não encontrado")
    db.add(
        ContractItem(
            contract_id=c.id,
            source="workspace",
            product_id=body.product_id,
            price_plan_id=body.price_plan_id,
            subscription_id=body.subscription_id,
            description=body.description,
            quantity=body.quantity or 1,
            unit_amount=body.unit_amount,
        )
    )
    await db.flush()
    await db.refresh(c, attribute_names=["items"])
    return _to_response(c)


async def _get_contract(db: AsyncSession, contract_id: int, org_filter: str | None):
    q = (
        select(Contract)
        .options(selectinload(Contract.items))
        .where(Contract.id == contract_id)
    )
    if org_filter is not None:
        q = q.where(Contract.org_id == org_filter)
    return (await db.execute(q)).scalar_one_or_none()


@router.patch("/contracts/items/{item_id}", response_model=ContractResponse)
async def update_contract_item(
    item_id: int,
    body: ContractItemUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(RequirePermission("billing:write"))],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
):
    org_filter = router_org_list_filter(org_id)
    q = select(ContractItem).where(ContractItem.id == item_id)
    if org_filter is not None:
        q = q.join(Contract, Contract.id == ContractItem.contract_id).where(
            Contract.org_id == org_filter
        )
    item = (await db.execute(q)).scalar_one_or_none()
    if not item:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item não encontrado")
    if body.product_id is not None:
        item.product_id = body.product_id
    if body.price_plan_id is not None:
        item.price_plan_id = body.price_plan_id
    if body.subscription_id is not None:
        item.subscription_id = body.subscription_id
    if body.description is not None:
        item.description = body.description
    if body.quantity is not None:
        item.quantity = body.quantity or 1
    if body.unit_amount is not None:
        item.unit_amount = body.unit_amount
    await db.flush()
    c = await _get_contract(db, item.contract_id, org_filter)
    await log_audit(
        db,
        entity="contract_item",
        entity_id=str(item.id),
        action="contract_item_updated",
        actor_type="staff",
        actor_id=str(current.id),
        org_id=c.org_id if c else (org_filter or "innexar"),
    )
    await db.flush()
    return _to_response(c)


@router.delete("/contracts/items/{item_id}", response_model=ContractResponse)
async def delete_contract_item(
    item_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(RequirePermission("billing:write"))],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
):
    org_filter = router_org_list_filter(org_id)
    q = select(ContractItem).where(ContractItem.id == item_id)
    if org_filter is not None:
        q = q.join(Contract, Contract.id == ContractItem.contract_id).where(
            Contract.org_id == org_filter
        )
    item = (await db.execute(q)).scalar_one_or_none()
    if not item:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item não encontrado")
    blocking = (
        await db.execute(
            select(Fulfillment.id).where(
                Fulfillment.contract_item_id == item.id,
                Fulfillment.status.in_(["active", "provisioning", "queued"]),
            )
        )
    ).first()
    if blocking:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Item possui fulfillment ativo; cancele o fulfillment antes",
        )
    contract_id = item.contract_id
    await db.delete(item)
    await db.flush()
    await log_audit(
        db,
        entity="contract_item",
        entity_id=str(item_id),
        action="contract_item_deleted",
        actor_type="staff",
        actor_id=str(current.id),
        org_id=org_filter or "innexar",
    )
    await db.flush()
    c = await _get_contract(db, contract_id, org_filter)
    return _to_response(c)


@router.post(
    "/contracts/{contract_id}/invoice",
    response_model=InvoiceResponse,
    status_code=201,
)
async def create_invoice_from_contract(
    contract_id: int,
    body: ContractInvoiceCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(RequirePermission("billing:write"))],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
):
    """Fatura a partir dos itens do contrato (preço = qty × unit_amount)."""
    from app.modules.billing.contract_invoicing import (
        ContractBillingError,
    )
    from app.modules.billing.contract_invoicing import (
        create_invoice_from_contract as _invoice_from_contract,
    )

    org_filter = router_org_list_filter(org_id)
    c = await _get_contract(db, contract_id, org_filter)
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Contract não encontrado")
    try:
        inv = await _invoice_from_contract(
            db,
            c,
            due_date=body.due_date,
            subscription_id=body.subscription_id,
            actor_type="staff",
            actor_id=str(current.id),
        )
    except ContractBillingError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, e.detail) from e
    return inv
