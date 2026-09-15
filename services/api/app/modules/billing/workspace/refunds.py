"""Workspace: refunds (visualizar + criar via provider oficial)."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.rbac import RequirePermission
from app.models.user import User
from app.modules.billing.dependencies import require_billing_enabled
from app.modules.billing.models import Refund
from app.modules.billing.pay_methods import PayMethodError, create_refund

router = APIRouter()


class RefundCreate(BaseModel):
    invoice_id: int
    amount: float | None = None
    reason: str | None = None


class RefundResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    invoice_id: int
    provider: str
    provider_refund_id: str | None
    amount: float
    currency: str
    status: str
    reason: str | None
    created_at: object


@router.get("/refunds", response_model=list[RefundResponse])
async def list_refunds(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(RequirePermission("billing:read"))],
    __: Annotated[None, Depends(require_billing_enabled)],
    invoice_id: int | None = None,
):
    q = select(Refund).order_by(Refund.id.desc())
    if invoice_id is not None:
        q = q.where(Refund.invoice_id == invoice_id)
    return list((await db.execute(q)).scalars().all())


@router.post("/refunds", status_code=201)
async def create_refund_endpoint(
    body: RefundCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(RequirePermission("billing:write"))],
    __: Annotated[None, Depends(require_billing_enabled)],
):
    try:
        return await create_refund(
            db,
            invoice_id=body.invoice_id,
            amount=body.amount,
            reason=(body.reason or "").strip()[:300] or None,
            actor_type="staff",
            actor_id=str(current.id),
        )
    except PayMethodError as e:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, {"code": e.code, "message": e.detail}
        ) from e
