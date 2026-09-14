"""Public products API: list site plans and catalog. Thin layer: validate → call service → return."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.products.public_org import resolve_products_org
from app.modules.products.public_service import ProductPublicService
from app.modules.products.schemas_public import (
    PaidTrafficPlanOut,
    ProductCatalogOut,
    ProductSiteOut,
    WaaSPlanOut,
)

router = APIRouter(prefix="/products", tags=["public-products"])


def get_product_public_service(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ProductPublicService:
    """Dependency: public products service."""
    return ProductPublicService(db)


@router.get("/waas", response_model=list[WaaSPlanOut])
async def list_products_waas(
    request: Request,
    service: Annotated[ProductPublicService, Depends(get_product_public_service)],
) -> list[WaaSPlanOut]:
    """Return WaaS USA plans (Starter $129, Business $199, Pro $299) by slug. No auth."""
    return await service.list_waas(org_id=resolve_products_org(request))


@router.get("/paid-traffic", response_model=list[PaidTrafficPlanOut])
async def list_products_paid_traffic(
    request: Request,
    service: Annotated[ProductPublicService, Depends(get_product_public_service)],
) -> list[PaidTrafficPlanOut]:
    """Return paid traffic plans (Start $97, Growth $197, Premium $397) by slug. No auth."""
    return await service.list_paid_traffic(org_id=resolve_products_org(request))


@router.get("/catalog", response_model=list[ProductCatalogOut])
async def list_products_catalog(
    request: Request,
    service: Annotated[ProductPublicService, Depends(get_product_public_service)],
    interval: str = Query(
        "all",
        description="Filter by plan interval: all, month (mensal), one_time (pagamento único)",
    ),
    locale: str | None = Query(None, description="Preferred locale hint (pt for Brazil)"),
) -> list[ProductCatalogOut]:
    """Return active products with their price plans. Use interval=one_time for pagamento único."""
    org_id = resolve_products_org(request, locale=locale)
    return await service.list_catalog(org_id=org_id, interval=interval)


@router.get("/sites", response_model=list[ProductSiteOut])
async def list_products_sites(
    request: Request,
    service: Annotated[ProductPublicService, Depends(get_product_public_service)],
) -> list[ProductSiteOut]:
    """Return site products (Essencial, Completo) for the landing. No auth."""
    return await service.list_sites(org_id=resolve_products_org(request))
