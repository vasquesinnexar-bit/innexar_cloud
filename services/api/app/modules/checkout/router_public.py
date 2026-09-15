"""Public checkout: start checkout (create customer/subscription/invoice, process payment)."""

from typing import Annotated

from app.core.database import get_db
from app.core.org import resolve_public_org
from app.core.security import (
    create_token_customer,
    verify_password,
)
from app.modules.checkout.checkout_service import CheckoutService
from app.modules.checkout.schemas import (
    CheckEmailRequest,
    CheckEmailResponse,
    CheckoutLoginRequest,
    CheckoutLoginResponse,
    CheckoutStartRequest,
    CheckoutStartResponse,
)
from app.repositories.customer_repository import CustomerRepository
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/checkout", tags=["public-checkout"])


def get_checkout_service(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CheckoutService:
    return CheckoutService(db)


@router.post("/check-email", response_model=CheckEmailResponse)
async def check_email(
    body: CheckEmailRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CheckEmailResponse:
    """Check if email already has a customer account."""
    repo = CustomerRepository(db)
    cu = await repo.get_customer_user_by_email(body.email.lower().strip())
    if cu:
        cust = await repo.get_by_id_with_users(cu.customer_id)
        return CheckEmailResponse(
            exists=True, customer_name=cust.name if cust else None
        )
    return CheckEmailResponse(exists=False)


@router.post("/login", response_model=CheckoutLoginResponse)
async def checkout_inline_login(
    body: CheckoutLoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CheckoutLoginResponse:
    """Inline login during checkout. Returns token + customer info to pre-fill form."""
    repo = CustomerRepository(db)
    cu = await repo.get_customer_user_by_email(body.email.lower().strip())
    if cu is None or not verify_password(body.password, cu.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
        )
    token = create_token_customer(cu.id)
    cust = await repo.get_by_id_with_users(cu.customer_id)
    return CheckoutLoginResponse(
        access_token=token,
        customer_name=cust.name if cust else None,
        customer_email=cu.email,
        customer_phone=cust.phone if cust else None,
    )


@router.post("/start", response_model=CheckoutStartResponse)
async def checkout_start(
    body: CheckoutStartRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    service: Annotated[CheckoutService, Depends(get_checkout_service)],
) -> CheckoutStartResponse:
    """Start checkout: find/create Customer, create Subscription+Invoice, process payment via Bricks or Checkout Pro.
    Accepts either (product_id, price_plan_id) or plan_slug (starter, business, pro) for WaaS USA.
    """
    org_id = resolve_public_org(
        origin=request.headers.get("origin"),
        referer=request.headers.get("referer"),
        locale=body.locale,
        x_org_id=request.headers.get("x-org-id"),
    )
    return await service.start_checkout(body, background_tasks, org_id)
