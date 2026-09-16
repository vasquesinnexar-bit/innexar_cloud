"""Workspace onboarding: lista, detalhe, intervenção, retry (P1.3)."""

from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.audit import log_audit
from app.core.database import get_db
from app.core.datetime_utils import utc_now
from app.core.rbac import RequirePermission
from app.models.customer import Customer
from app.models.user import User
from app.modules.billing.dependencies import require_billing_enabled
from app.modules.billing.models import Product
from app.modules.fulfillment.facade import run_fulfillment
from app.modules.onboarding import service as onboarding
from app.modules.onboarding.enums import OnboardingStatus
from app.modules.onboarding.models import OnboardingSession, OnboardingStep
from app.modules.onboarding.schemas import NoteBody, OnboardingSessionResponse

router = APIRouter()

READ = RequirePermission("onboarding.read")
RETRY = RequirePermission("onboarding.retry")
MANAGE = RequirePermission("onboarding.manage")


async def _to_response(db: AsyncSession, s: OnboardingSession) -> dict:
    cust = await db.get(Customer, s.customer_id)
    product = await db.get(Product, s.product_id) if s.product_id else None
    steps = (
        (
            await db.execute(
                select(OnboardingStep)
                .where(OnboardingStep.onboarding_id == s.id)
                .order_by(OnboardingStep.position)
            )
        )
        .scalars()
        .all()
    )
    return {
        "id": s.id,
        "customer_id": s.customer_id,
        "customer_name": cust.name if cust else None,
        "fulfillment_id": s.fulfillment_id,
        "product_name": product.name if product else None,
        "type": s.type,
        "status": s.status,
        "current_step": s.current_step,
        "progress": s.progress,
        "last_error": s.last_error,
        "started_at": s.started_at,
        "completed_at": s.completed_at,
        "last_activity_at": s.last_activity_at,
        "created_at": s.created_at,
        "updated_at": s.updated_at,
        "steps": [
            {
                "step_key": st.step_key,
                "position": st.position,
                "required": st.required,
                "status": st.status,
                "data": st.data,
                "validation_error": st.validation_error,
                "completed_at": st.completed_at,
            }
            for st in steps
        ],
    }


@router.get("/onboardings", response_model=list[OnboardingSessionResponse])
async def list_onboardings(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(READ)],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
    status: str | None = None,
    type: str | None = None,
    stale_days: int | None = None,
):
    from app.core.router_org import router_org_list_filter

    of = router_org_list_filter(org_id)
    q = select(OnboardingSession).order_by(OnboardingSession.id.desc())
    if of is not None:
        q = q.where(OnboardingSession.org_id == of)
    if status:
        q = q.where(OnboardingSession.status == status)
    if type:
        q = q.where(OnboardingSession.type == type)
    if stale_days:
        cutoff = utc_now() - timedelta(days=stale_days)
        q = q.where(
            OnboardingSession.status.in_(
                [
                    OnboardingStatus.WAITING_CUSTOMER.value,
                    OnboardingStatus.WAITING_DNS.value,
                    OnboardingStatus.FAILED.value,
                ]
            ),
            OnboardingSession.last_activity_at <= cutoff,
        )
    rows = (await db.execute(q.limit(200))).scalars().all()
    return [await _to_response(db, s) for s in rows]


@router.get("/onboardings/{session_id}", response_model=OnboardingSessionResponse)
async def get_onboarding(
    session_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(READ)],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
):
    from app.core.router_org import router_org_list_filter

    of = router_org_list_filter(org_id)
    q = (
        select(OnboardingSession)
        .options(selectinload(OnboardingSession.steps))
        .where(OnboardingSession.id == session_id)
    )
    if of is not None:
        q = q.where(OnboardingSession.org_id == of)
    s = (await db.execute(q)).scalar_one_or_none()
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Onboarding não encontrado")
    return await _to_response(db, s)


@router.post(
    "/onboardings/{session_id}/verify-dns",
    response_model=OnboardingSessionResponse,
)
async def verify_dns(
    session_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(RETRY)],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
):
    """Revalida DNS agora (staff)."""
    from app.core.router_org import router_org_write

    org = router_org_write(current, org_id)
    s = await db.get(OnboardingSession, session_id)
    if not s or s.org_id != org:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Onboarding não encontrado")
    from app.modules.onboarding.registry import get_handler

    handler = get_handler(s.type)
    if hasattr(handler, "_run_verification"):
        result = await handler._run_verification(db, s)  # noqa: SLF001
        steps = await onboarding._steps_map(db, s)  # noqa: SLF001
        step = steps.get("dns_verification")
        if step:
            if result.ok:
                from app.modules.onboarding.enums import OnboardingStepStatus

                step.status = OnboardingStepStatus.COMPLETED.value
                step.completed_at = utc_now()
                step.data = {"checks": True}
            else:
                from app.modules.onboarding.enums import OnboardingStepStatus

                step.status = OnboardingStepStatus.BLOCKED.value
                step.validation_error = (result.error or "")[:500]
            await db.flush()
            await onboarding._recompute(db, s)  # noqa: SLF001
            await onboarding.auto_advance(db, s)  # noqa: SLF001
            await onboarding.maybe_advance_fulfillment(
                db, s, False, actor_type="staff", actor_id=str(current.id)
            )
    await db.commit()
    return await _to_response(db, s)


@router.post(
    "/onboardings/{session_id}/resolve",
    response_model=OnboardingSessionResponse,
)
async def resolve_onboarding(
    session_id: int,
    body: NoteBody,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(MANAGE)],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
):
    """Staff marca como resolvido (manual override auditado)."""
    from app.core.router_org import router_org_write

    org = router_org_write(current, org_id)
    s = await db.get(OnboardingSession, session_id)
    if not s or s.org_id != org:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Onboarding não encontrado")
    s.status = OnboardingStatus.COMPLETED.value
    s.completed_at = utc_now()
    await log_audit(
        db,
        entity="onboarding",
        entity_id=str(s.id),
        action="onboarding_manual_override",
        actor_type="staff",
        actor_id=str(current.id),
        org_id=org,
        payload={"note": (body.note or "")[:300]},
    )
    await db.flush()
    await onboarding.maybe_advance_fulfillment(
        db, s, False, actor_type="staff", actor_id=str(current.id)
    )
    await db.commit()
    return await _to_response(db, s)


@router.post(
    "/onboardings/{session_id}/retry", response_model=OnboardingSessionResponse
)
async def retry_onboarding(
    session_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(RETRY)],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
):
    """Reprocessa: volta etapa bloqueada p/ pendente e avança o motor."""
    from app.core.router_org import router_org_write
    from app.modules.onboarding.enums import OnboardingStepStatus

    org = router_org_write(current, org_id)
    s = await db.get(OnboardingSession, session_id)
    if not s or s.org_id != org:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Onboarding não encontrado")
    steps = await onboarding._steps_map(db, s)  # noqa: SLF001
    for step in steps.values():
        if step.status in (
            OnboardingStepStatus.BLOCKED.value,
            OnboardingStepStatus.FAILED.value,
        ):
            step.status = OnboardingStepStatus.PENDING.value
            step.validation_error = None
    if s.status in (
        OnboardingStatus.FAILED.value,
        OnboardingStatus.WAITING_CUSTOMER.value,
        OnboardingStatus.WAITING_DNS.value,
    ):
        s.status = OnboardingStatus.ACTIVE.value
    await log_audit(
        db,
        entity="onboarding",
        entity_id=str(s.id),
        action="onboarding_retry",
        actor_type="staff",
        actor_id=str(current.id),
        org_id=org,
    )
    await db.flush()
    await onboarding.auto_advance(  # noqa: SLF001
        db, s, actor_type="staff", actor_id=str(current.id)
    )
    if s.fulfillment_id:
        await run_fulfillment(
            db, s.fulfillment_id, actor_type="staff", actor_id=str(current.id)
        )
    await db.commit()
    return await _to_response(db, s)


@router.get(
    "/customers/{customer_id}/onboardings",
    response_model=list[OnboardingSessionResponse],
)
async def customer_onboardings(
    customer_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(READ)],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
):
    from app.core.router_org import router_org_list_filter

    of = router_org_list_filter(org_id)
    q = select(OnboardingSession).where(OnboardingSession.customer_id == customer_id)
    if of is not None:
        q = q.where(OnboardingSession.org_id == of)
    rows = (
        (await db.execute(q.order_by(OnboardingSession.id.desc()).limit(100)))
        .scalars()
        .all()
    )
    return [await _to_response(db, s) for s in rows]
