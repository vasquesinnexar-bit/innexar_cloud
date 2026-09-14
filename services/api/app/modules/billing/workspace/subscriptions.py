"""Workspace billing: subscriptions CRUD and link-hestia. Thin: validate → service → response."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.router_org import router_org_list_filter, router_org_write
from app.core.rbac import RequirePermission
from app.models.customer import Customer
from app.models.user import User
from app.modules.billing.dependencies import (
    get_billing_workspace_service,
    require_billing_enabled,
)
from app.modules.billing.models import PricePlan, Product, Subscription
from app.modules.billing.schemas import (
    LinkHestiaBody,
    LinkHestiaResponse,
    SubscriptionCreate,
    SubscriptionResponse,
    SubscriptionUpdate,
)
from app.modules.billing.workspace_service import BillingWorkspaceService

router = APIRouter()


async def _subscriptions_to_responses(
    db: AsyncSession, subs: list[Subscription]
) -> list[SubscriptionResponse]:
    if not subs:
        return []
    cust_ids = {s.customer_id for s in subs}
    prod_ids = {s.product_id for s in subs}
    plan_ids = {s.price_plan_id for s in subs}
    customers = {
        c.id: c
        for c in (
            await db.execute(select(Customer).where(Customer.id.in_(cust_ids)))
        ).scalars().all()
    }
    products = {
        p.id: p
        for p in (
            await db.execute(select(Product).where(Product.id.in_(prod_ids)))
        ).scalars().all()
    }
    plans = {
        p.id: p
        for p in (
            await db.execute(select(PricePlan).where(PricePlan.id.in_(plan_ids)))
        ).scalars().all()
    }
    out: list[SubscriptionResponse] = []
    for s in subs:
        cust = customers.get(s.customer_id)
        prod = products.get(s.product_id)
        plan = plans.get(s.price_plan_id)
        out.append(
            SubscriptionResponse(
                id=s.id,
                customer_id=s.customer_id,
                product_id=s.product_id,
                price_plan_id=s.price_plan_id,
                status=s.status,
                start_date=s.start_date,
                end_date=s.end_date,
                next_due_date=s.next_due_date,
                created_at=s.created_at,
                updated_at=s.updated_at,
                customer_name=cust.name if cust else None,
                org_id=cust.org_id if cust else None,
                product_name=prod.name if prod else None,
                plan_amount=float(plan.amount) if plan else None,
                plan_currency=plan.currency if plan else None,
            )
        )
    return out


@router.get("/subscriptions", response_model=list[SubscriptionResponse])
async def list_subscriptions(
    service: Annotated[BillingWorkspaceService, Depends(get_billing_workspace_service)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(RequirePermission("billing:read"))],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
    customer_id: int | None = None,
):
    subs = await service.list_subscriptions(
        router_org_list_filter(org_id), customer_id=customer_id
    )
    return await _subscriptions_to_responses(db, subs)


@router.post("/subscriptions", response_model=SubscriptionResponse, status_code=201)
async def create_subscription(
    body: SubscriptionCreate,
    service: Annotated[BillingWorkspaceService, Depends(get_billing_workspace_service)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(RequirePermission("billing:write"))],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
):
    try:
        sub = await service.create_subscription(
            body,
            actor_id=str(current.id),
            org_id=router_org_write(current, org_id),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return (await _subscriptions_to_responses(db, [sub]))[0]


@router.patch("/subscriptions/{subscription_id}", response_model=SubscriptionResponse)
async def update_subscription(
    subscription_id: int,
    body: SubscriptionUpdate,
    service: Annotated[BillingWorkspaceService, Depends(get_billing_workspace_service)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(RequirePermission("billing:write"))],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
):
    sub = await service.update_subscription(
        subscription_id,
        body,
        org_id=router_org_list_filter(org_id),
    )
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return (await _subscriptions_to_responses(db, [sub]))[0]


@router.post(
    "/subscriptions/{subscription_id}/cancel",
    response_model=SubscriptionResponse,
)
async def cancel_subscription(
    subscription_id: int,
    service: Annotated[BillingWorkspaceService, Depends(get_billing_workspace_service)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(RequirePermission("billing:write"))],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
):
    """Cancel subscription manually (staff). Stops future billing in workspace."""
    sub = await service.cancel_subscription(
        subscription_id,
        org_id=router_org_list_filter(org_id),
        actor_id=str(current.id),
    )
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return (await _subscriptions_to_responses(db, [sub]))[0]


@router.post(
    "/subscriptions/{subscription_id}/link-hestia",
    response_model=LinkHestiaResponse,
    status_code=status.HTTP_201_CREATED,
)
async def link_hestia_user(
    subscription_id: int,
    body: LinkHestiaBody,
    service: Annotated[BillingWorkspaceService, Depends(get_billing_workspace_service)],
    current: Annotated[User, Depends(RequirePermission("billing:write"))],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
):
    """Link an existing Hestia user to a subscription (creates ProvisioningRecord only)."""
    try:
        rec = await service.link_hestia_user(
            subscription_id, body, router_org_list_filter(org_id)
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    if not rec:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return LinkHestiaResponse(ok=True, provisioning_record_id=rec.id)
