"""Workspace billing: products CRUD. Thin layer: validate → call service → return response."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.core.rbac import RequirePermission
from app.core.router_org import router_org_list_filter, router_org_write
from app.models.user import User
from app.modules.billing.dependencies import (
    get_billing_workspace_service,
    require_billing_enabled,
)
from app.modules.billing.schemas import (
    PricePlanResponse,
    ProductCreate,
    ProductResponse,
    ProductUpdate,
    ProductWithPlansResponse,
)
from app.modules.billing.workspace_service import BillingWorkspaceService

router = APIRouter()


@router.get(
    "/products", response_model=list[ProductResponse] | list[ProductWithPlansResponse]
)
async def list_products(
    service: Annotated[BillingWorkspaceService, Depends(get_billing_workspace_service)],
    current: Annotated[User, Depends(RequirePermission("billing:read"))],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
    with_plans: bool = False,
):
    result = await service.list_products(
        router_org_list_filter(org_id), with_plans=with_plans
    )
    if not with_plans:
        return [ProductResponse.model_validate(p) for p in result]
    return [
        ProductWithPlansResponse(
            **ProductResponse.model_validate(d["product"]).model_dump(),
            price_plans=[PricePlanResponse.model_validate(pp) for pp in d["plans"]],
        )
        for d in result
    ]


@router.post("/products", response_model=ProductResponse, status_code=201)
async def create_product(
    body: ProductCreate,
    service: Annotated[BillingWorkspaceService, Depends(get_billing_workspace_service)],
    current: Annotated[User, Depends(RequirePermission("billing:write"))],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
):
    p = await service.create_product(body, router_org_write(current, org_id))
    return ProductResponse.model_validate(p)


@router.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: int,
    service: Annotated[BillingWorkspaceService, Depends(get_billing_workspace_service)],
    current: Annotated[User, Depends(RequirePermission("billing:read"))],
    __: Annotated[None, Depends(require_billing_enabled)],
):
    p = await service.get_product(product_id, org_id=None)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return ProductResponse.model_validate(p)


@router.patch("/products/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: int,
    body: ProductUpdate,
    service: Annotated[BillingWorkspaceService, Depends(get_billing_workspace_service)],
    current: Annotated[User, Depends(RequirePermission("billing:write"))],
    __: Annotated[None, Depends(require_billing_enabled)],
):
    p = await service.update_product(product_id, body, org_id=None)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return ProductResponse.model_validate(p)
