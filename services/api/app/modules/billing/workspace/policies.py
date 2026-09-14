"""Workspace: BillingPolicy CRUD + resolução efetiva (Fase 3)."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import log_audit
from app.core.database import get_db
from app.core.rbac import RequirePermission
from app.models.user import User
from app.modules.billing.dependencies import require_billing_enabled
from app.modules.billing.models import BillingPolicy
from app.modules.billing.policy import resolve_policy

router = APIRouter()


class PolicyUpsert(BaseModel):
    scope: str
    scope_ref: str | None = None
    grace_period_days: int | None = None
    reminder_days_before: list[int] | None = None
    reminder_days_after: list[int] | None = None
    suspend_after_days: int | None = None
    cancel_after_days: int | None = None
    auto_reactivate: bool | None = None
    is_active: bool | None = None


class PolicyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    scope: str
    scope_ref: str | None
    grace_period_days: int
    reminder_days_before: list[int] | None
    reminder_days_after: list[int] | None
    suspend_after_days: int
    cancel_after_days: int | None
    auto_reactivate: bool
    is_active: bool


@router.get("/billing/policies", response_model=list[PolicyResponse])
async def list_policies(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(RequirePermission("billing:read"))],
    __: Annotated[None, Depends(require_billing_enabled)],
):
    rows = (
        await db.execute(select(BillingPolicy).order_by(BillingPolicy.id))
    ).scalars().all()
    return list(rows)


@router.get("/billing/policies/effective")
async def effective_policy(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(RequirePermission("billing:read"))],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
    product_id: int | None = None,
    contract_id: int | None = None,
) -> dict[str, Any]:
    return await resolve_policy(
        db, org_id=org_id, product_id=product_id, contract_id=contract_id
    )


@router.post("/billing/policies", response_model=PolicyResponse, status_code=201)
async def upsert_policy(
    body: PolicyUpsert,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(RequirePermission("billing:write"))],
    __: Annotated[None, Depends(require_billing_enabled)],
):
    scope = body.scope.strip().lower()
    if scope not in ("global", "org", "product", "contract"):
        raise HTTPException(400, "scope deve ser global|org|product|contract")
    ref = (body.scope_ref or "").strip() or None
    if scope != "global" and not ref:
        raise HTTPException(400, "scope_ref obrigatório para escopo não-global")
    existing = (
        await db.execute(
            select(BillingPolicy).where(
                BillingPolicy.scope == scope,
                BillingPolicy.scope_ref.is_(None) if ref is None
                else BillingPolicy.scope_ref == ref,
            )
        )
    ).scalar_one_or_none()
    data = body.model_dump(exclude_unset=True, exclude={"scope", "scope_ref"})
    data = {k: v for k, v in data.items() if v is not None}
    if existing:
        for k, v in data.items():
            setattr(existing, k, v)
        pol = existing
    else:
        pol = BillingPolicy(scope=scope, scope_ref=ref, **data)
        db.add(pol)
    await db.flush()
    await log_audit(
        db, entity="billing_policy", entity_id=str(pol.id),
        action="billing_policy_changed", actor_type="staff",
        actor_id=str(current.id), payload={"scope": scope, "ref": ref},
    )
    await db.flush()
    return pol
