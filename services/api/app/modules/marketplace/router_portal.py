"""Portal marketplace: catálogo e compra scoped ao cliente logado (P1.2).

Nunca confia em customer_id/price/provider do browser: tudo deriva da sessão.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_customer import get_current_customer
from app.core.database import get_db
from app.models.customer import Customer
from app.models.customer_user import CustomerUser
from app.modules.billing.dependencies import require_billing_enabled
from app.modules.marketplace import service as marketplace
from app.modules.marketplace.schemas import (
    CatalogProduct,
    MyServicesResponse,
    PurchaseCreate,
    PurchaseResponse,
)

router = APIRouter()


def _http_error(e: marketplace.MarketplaceError) -> HTTPException:
    return HTTPException(
        e.status,
        detail={"code": e.code, "message": e.detail},
    )


async def _customer(db: AsyncSession, current: CustomerUser) -> Customer:
    cust = (
        await db.execute(select(Customer).where(Customer.id == current.customer_id))
    ).scalar_one_or_none()
    if not cust:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Customer não encontrado")
    return cust


@router.get("/catalog", response_model=list[CatalogProduct])
async def catalog(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[CustomerUser, Depends(get_current_customer)],
    _: Annotated[None, Depends(require_billing_enabled)],
):
    """Catálogo vendável p/ este cliente (org + moeda + portal_sellable)."""
    cust = await _customer(db, current)
    return await marketplace.list_catalog(db, cust)


@router.post("/purchases", response_model=PurchaseResponse, status_code=201)
async def purchase(
    body: PurchaseCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[CustomerUser, Depends(get_current_customer)],
    _: Annotated[None, Depends(require_billing_enabled)],
):
    """Contrata: valida no servidor, cria contrato/item/invoice. Idempotente."""
    cust = await _customer(db, current)
    try:
        out = await marketplace.purchase(
            db,
            cust,
            product_id=body.product_id,
            price_plan_id=body.price_plan_id,
            quantity=body.quantity,
            idempotency_key=body.idempotency_key,
            actor_id=str(current.id),
        )
    except marketplace.MarketplaceError as e:
        raise _http_error(e) from e
    await db.commit()
    return out


@router.get("/purchases", response_model=list[dict])
async def my_purchases(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[CustomerUser, Depends(get_current_customer)],
    _: Annotated[None, Depends(require_billing_enabled)],
):
    """Itens do cliente com invoice + fulfillment (base de Meus serviços)."""
    cust = await _customer(db, current)
    return await marketplace.list_my_purchases(db, cust)


@router.get("/services/overview", response_model=MyServicesResponse)
async def my_services(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[CustomerUser, Depends(get_current_customer)],
    _: Annotated[None, Depends(require_billing_enabled)],
):
    """Meus serviços: itens + domínios de e-mail + hosting + projetos."""
    from app.modules.hosting.models import HostingService
    from app.modules.mail.service import MailService
    from app.modules.projects.models import Project

    cust = await _customer(db, current)
    mail_svc = MailService(db)
    domains = await mail_svc.list_domains(cust.id, str(cust.org_id))
    items = await marketplace.list_my_purchases(db, cust)
    hosting_rows = (
        (
            await db.execute(
                select(HostingService)
                .where(HostingService.customer_id == cust.id)
                .order_by(HostingService.id)
            )
        )
        .scalars()
        .all()
    )
    project_rows = (
        (
            await db.execute(
                select(Project)
                .where(Project.customer_id == cust.id)
                .order_by(Project.id.desc())
            )
        )
        .scalars()
        .all()
    )
    return {
        "items": items,
        "email_domains": [{"domain": d.domain, "status": d.status} for d in domains],
        "hosting_services": [
            {
                "id": h.id,
                "primary_domain": h.primary_domain,
                "status": h.status,
                "runtime": "online" if (h.status or "") == "active" else "unknown",
                "project": h.project_name,
                "environment": h.environment,
            }
            for h in hosting_rows
        ],
        "projects": [
            {"id": p.id, "name": p.name, "status": p.status} for p in project_rows
        ],
    }
