"""Onboarding engine (P1.3): sessões persistentes, state machine, comandos.

Cliente nunca envia status: só comandos (submit_*). Servidor decide estados.
"""

from __future__ import annotations

import logging
import secrets

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.audit import log_audit
from app.core.datetime_utils import utc_now
from app.modules.onboarding.enums import (
    OnboardingStatus,
    OnboardingStepStatus,
    OnboardingType,
)
from app.modules.onboarding.models import OnboardingSession, OnboardingStep
from app.modules.onboarding.registry import get_handler

logger = logging.getLogger(__name__)

ACTIVE_STATUSES = (
    OnboardingStatus.PENDING.value,
    OnboardingStatus.ACTIVE.value,
    OnboardingStatus.WAITING_CUSTOMER.value,
    OnboardingStatus.WAITING_DNS.value,
    OnboardingStatus.FAILED.value,
)

TERMINAL_BAD = (
    OnboardingStepStatus.BLOCKED.value,
    OnboardingStepStatus.FAILED.value,
)


async def _touch(session: OnboardingSession) -> None:
    session.last_activity_at = utc_now()
    session.updated_at = utc_now()


async def ensure_session(
    db: AsyncSession,
    *,
    customer_id: int,
    org_id: str,
    type: str,
    fulfillment_id: int | None = None,
    contract_item_id: int | None = None,
    product_id: int | None = None,
    actor_type: str = "system",
    actor_id: str | None = None,
) -> OnboardingSession:
    """Idempotente: 1 sessão por fulfillment (ou item+tipo). Nunca duplica."""
    key = (
        f"ful-{fulfillment_id}"
        if fulfillment_id is not None
        else f"ci-{contract_item_id}-{type}"
    )
    existing = (
        await db.execute(
            select(OnboardingSession).where(OnboardingSession.idempotency_key == key)
        )
    ).scalar_one_or_none()
    if existing:
        return existing
    handler = get_handler(type)
    session = OnboardingSession(
        customer_id=customer_id,
        org_id=org_id,
        type=type,
        fulfillment_id=fulfillment_id,
        contract_item_id=contract_item_id,
        product_id=product_id,
        status=OnboardingStatus.PENDING.value,
        idempotency_key=key,
        started_at=utc_now(),
        meta={"handler_steps": [s.key for s in handler.steps()]},
    )
    db.add(session)
    await db.flush()
    for step in handler.steps():
        db.add(
            OnboardingStep(
                onboarding_id=session.id,
                step_key=step.key,
                position=step.position,
                required=step.required,
                status=OnboardingStepStatus.PENDING.value,
            )
        )
    await db.flush()
    await _recompute(db, session)
    await log_audit(
        db,
        entity="onboarding",
        entity_id=str(session.id),
        action="onboarding_created",
        actor_type=actor_type,
        actor_id=actor_id,
        org_id=org_id,
        payload={"type": type, "fulfillment_id": fulfillment_id},
    )
    await db.flush()
    await notify(db, session, "started")
    return session


async def get_active_session(
    db: AsyncSession,
    *,
    customer_id: int,
    fulfillment_id: int | None = None,
    type: str | None = None,
) -> OnboardingSession | None:
    q = (
        select(OnboardingSession)
        .options(selectinload(OnboardingSession.steps))
        .where(
            OnboardingSession.customer_id == customer_id,
            OnboardingSession.status.in_(ACTIVE_STATUSES),
        )
        .order_by(OnboardingSession.id.desc())
    )
    if fulfillment_id is not None:
        q = q.where(OnboardingSession.fulfillment_id == fulfillment_id)
    if type is not None:
        q = q.where(OnboardingSession.type == type)
    return (await db.execute(q)).scalars().first()


async def _steps_map(
    db: AsyncSession, session: OnboardingSession
) -> dict[str, OnboardingStep]:
    rows = (
        (
            await db.execute(
                select(OnboardingStep)
                .where(OnboardingStep.onboarding_id == session.id)
                .order_by(OnboardingStep.position)
            )
        )
        .scalars()
        .all()
    )
    return {s.step_key: s for s in rows}


async def _recompute(db: AsyncSession, session: OnboardingSession) -> None:
    """Recalcula current_step/progress/status a partir dos steps."""
    steps = await _steps_map(db, session)
    ordered = sorted(steps.values(), key=lambda s: s.position)
    total = len([s for s in ordered if s.required]) or 1
    done = len(
        [
            s
            for s in ordered
            if s.required and s.status == OnboardingStepStatus.COMPLETED.value
        ]
    )
    session.progress = int(100 * done / total)
    current = next(
        (
            s
            for s in ordered
            if s.status
            in (
                OnboardingStepStatus.ACTIVE.value,
                OnboardingStepStatus.PENDING.value,
                OnboardingStepStatus.BLOCKED.value,
                OnboardingStepStatus.FAILED.value,
            )
        ),
        None,
    )
    session.current_step = current.step_key if current else None
    if all(
        s.status
        in (OnboardingStepStatus.COMPLETED.value, OnboardingStepStatus.SKIPPED.value)
        or not s.required
        for s in ordered
    ):
        if session.status != OnboardingStatus.COMPLETED.value:
            session.status = OnboardingStatus.COMPLETED.value
            session.completed_at = utc_now()
            await log_audit(
                db,
                entity="onboarding",
                entity_id=str(session.id),
                action="onboarding_completed",
                actor_type="system",
                actor_id=None,
                org_id=session.org_id,
            )
    elif session.status == OnboardingStatus.COMPLETED.value:
        session.status = OnboardingStatus.ACTIVE.value
        session.completed_at = None
    await _touch(session)
    await db.flush()


async def maybe_advance_fulfillment(
    db: AsyncSession,
    session: OnboardingSession,
    was_completed: bool,
    *,
    actor_type: str = "system",
    actor_id: str | None = None,
) -> None:
    """Onboarding concluído → re-executa fulfillment (validação final)."""
    from app.modules.fulfillment.enums import FulfillmentStatus
    from app.modules.fulfillment.models import Fulfillment

    if was_completed or session.status != OnboardingStatus.COMPLETED.value:
        return
    if not session.fulfillment_id:
        return
    f = await db.get(Fulfillment, session.fulfillment_id)
    if not f or f.status == FulfillmentStatus.ACTIVE.value:
        return
    try:
        from app.modules.fulfillment.facade import run_fulfillment

        await run_fulfillment(db, f.id, actor_type=actor_type, actor_id=actor_id)
        await db.refresh(f)
        if f.status == FulfillmentStatus.ACTIVE.value:
            await notify(db, session, "service_ready")
    except Exception:  # noqa: BLE001
        logger.exception("advance fulfillment %s failed", f.id)


async def complete_step_for_project(
    db: AsyncSession,
    project_id: int,
    step_key: str = "briefing",
    *,
    actor_type: str = "system",
    actor_id: str | None = None,
) -> None:
    """Briefing concluído → completa etapa website e avança fulfillment (P1.3 §43)."""
    from app.modules.fulfillment.enums import FulfillmentStatus
    from app.modules.fulfillment.models import Fulfillment

    sessions = (
        (
            await db.execute(
                select(OnboardingSession).where(
                    OnboardingSession.type == OnboardingType.WEBSITE_PROJECT.value,
                    OnboardingSession.status.in_(ACTIVE_STATUSES),
                )
            )
        )
        .scalars()
        .all()
    )
    for session in sessions:
        steps = await _steps_map(db, session)
        step = steps.get(step_key)
        if not step or step.status == OnboardingStepStatus.COMPLETED.value:
            continue
        # Confirma vínculo via fulfillment→project.
        linked = False
        if session.fulfillment_id:
            f = await db.get(Fulfillment, session.fulfillment_id)
            if f and f.project_id == project_id:
                linked = True
        if not linked:
            continue
        step.status = OnboardingStepStatus.COMPLETED.value
        step.completed_at = utc_now()
        await log_audit(
            db,
            entity="onboarding",
            entity_id=str(session.id),
            action="onboarding_step_completed",
            actor_type=actor_type,
            actor_id=actor_id,
            org_id=session.org_id,
            payload={"step": step_key, "via": "briefing"},
        )
        await db.flush()
        was_completed = session.status == OnboardingStatus.COMPLETED.value
        await _recompute(db, session)
        # Projeto ainda precisa de produção manual → MANUAL_REVIEW (não ACTIVE).
        if session.fulfillment_id:
            f = await db.get(Fulfillment, session.fulfillment_id)
            if f and f.status == FulfillmentStatus.WAITING_INPUT.value:
                f.status = FulfillmentStatus.MANUAL_REVIEW.value
                f.current_step = "production"
                f.last_error = "Briefing recebido. Produção manual pendente."
                await log_audit(
                    db,
                    entity="fulfillment",
                    entity_id=str(f.id),
                    action="fulfillment_manual_review",
                    actor_type=actor_type,
                    actor_id=actor_id,
                    org_id=f.org_id,
                    payload={"reason": "briefing_completed"},
                )
                await db.flush()
        await maybe_advance_fulfillment(
            db,
            session,
            was_completed,
            actor_type=actor_type,
            actor_id=actor_id,
        )


async def submit_step(
    db: AsyncSession,
    session_id: int,
    step_key: str,
    data: dict,
    *,
    actor_type: str,
    actor_id: str | None,
) -> OnboardingSession:
    """Comando genérico de avanço (única escrita do cliente)."""
    session = await db.get(OnboardingSession, session_id)
    if not session:
        raise LookupError("onboarding_not_found")
    if session.status == OnboardingStatus.COMPLETED.value:
        return session
    steps = await _steps_map(db, session)
    step = steps.get(step_key)
    if not step:
        raise ValueError("unknown_step")
    handler = get_handler(session.type)
    result = await handler.submit(
        db,
        session,
        step_key,
        data or {},
        actor_type=actor_type,
        actor_id=actor_id,
    )
    if not result.ok:
        step.status = OnboardingStepStatus.BLOCKED.value
        step.validation_error = (result.error or "")[:500]
        session.last_error = step.validation_error
        session.status = OnboardingStatus.WAITING_CUSTOMER.value
        await log_audit(
            db,
            entity="onboarding",
            entity_id=str(session.id),
            action="onboarding_step_blocked",
            actor_type=actor_type,
            actor_id=actor_id,
            org_id=session.org_id,
            payload={"step": step_key},
        )
        await db.flush()
        return session
    step.status = OnboardingStepStatus.COMPLETED.value
    step.validation_error = None
    if result.step_data is not None:
        step.data = result.step_data
    step.completed_at = utc_now()
    await log_audit(
        db,
        entity="onboarding",
        entity_id=str(session.id),
        action="onboarding_step_completed",
        actor_type=actor_type,
        actor_id=actor_id,
        org_id=session.org_id,
        payload={"step": step_key},
    )
    await db.flush()
    was_completed = session.status == OnboardingStatus.COMPLETED.value
    await _recompute(db, session)
    await auto_advance(db, session, actor_type=actor_type, actor_id=actor_id)
    await maybe_advance_fulfillment(
        db, session, was_completed, actor_type=actor_type, actor_id=actor_id
    )
    return session


async def auto_advance(
    db: AsyncSession,
    session: OnboardingSession,
    *,
    actor_type: str = "system",
    actor_id: str | None = None,
) -> OnboardingSession:
    """Roda steps automáticos pendentes + rechecagens (motor e cron)."""
    from app.modules.onboarding.registry import StepDef

    _fallback = StepDef(key="", position=0, auto=False)
    handler = get_handler(session.type)
    defs = {s.key: s for s in handler.steps()}
    steps = await _steps_map(db, session)
    for key in sorted(steps, key=lambda k: steps[k].position):
        step = steps[key]
        if step.status != OnboardingStepStatus.PENDING.value:
            continue
        if not defs.get(key, _fallback).auto:
            step.status = OnboardingStepStatus.ACTIVE.value
            await db.flush()
            break
        result = await handler.auto_run(db, session, key)
        if result.ok:
            step.status = OnboardingStepStatus.COMPLETED.value
            step.completed_at = utc_now()
            if result.step_data is not None:
                step.data = result.step_data
            await db.flush()
            continue
        step.status = OnboardingStepStatus.BLOCKED.value
        step.validation_error = (result.error or "")[:500]
        await db.flush()
        break
    await _recompute(db, session)
    return session


def verification_token(customer_id: int, domain: str) -> str:
    """Token determinístico p/ challenge TXT (armazena só o prefixo público)."""
    raw = secrets.token_urlsafe(24)
    return f"innexar-verification={raw}"


async def notify(
    db: AsyncSession,
    session: OnboardingSession,
    template: str,
    background_tasks=None,
    **kwargs,
) -> None:
    """In-app sempre; e-mail somente com BackgroundTasks (routers).

    O cron (sem request) registra in-app + audit; sem spam de e-mail fora
    de transições chamadas pelo cliente ou job de verificação.
    """
    from sqlalchemy import select as _select

    from app.models.customer_user import CustomerUser
    from app.models.notification import Notification
    from app.modules.billing.notify_templates import render

    try:
        title, body = render(f"onboarding_{template}", _locale_of(session), **kwargs)
    except KeyError:
        title, body = f"Onboarding: {template}", ""
    cu = (
        (
            await db.execute(
                _select(CustomerUser).where(
                    CustomerUser.customer_id == session.customer_id
                )
            )
        )
        .scalars()
        .first()
    )
    db.add(
        Notification(
            customer_user_id=cu.id if cu else None,
            channel="in_app,email" if background_tasks else "in_app",
            title=title,
            body=body,
        )
    )
    await db.flush()
    if background_tasks is not None and cu and cu.email:
        from app.modules.notifications.service import (
            create_notification_and_maybe_send_email,
        )

        try:
            email_subject, email_body = render(
                f"onboarding_{template}_email", _locale_of(session), **kwargs
            )
        except KeyError:
            email_subject, email_body = title, body
        await create_notification_and_maybe_send_email(
            db,
            background_tasks,
            customer_user_id=cu.id,
            channel="email",
            title=title,
            body=body,
            recipient_email=cu.email,
            org_id=session.org_id,
            email_subject=email_subject,
            email_body=email_body,
            email_locale=_locale_of(session),
            email_action_url="/services/email/setup",
        )
    await log_audit(
        db,
        entity="onboarding",
        entity_id=str(session.id),
        action=f"onboarding_notify_{template}",
        actor_type="system",
        actor_id=None,
        org_id=session.org_id,
        payload={"title": title},
    )
    await db.flush()


def _locale_of(session: OnboardingSession) -> str:
    return "pt-BR" if (session.org_id or "") == "innexar-br" else "en-US"


async def next_action_for_fulfillment(db: AsyncSession, fulfillment) -> dict | None:
    """Próxima ação de negócio (backend decide; frontend só renderiza)."""
    from app.modules.fulfillment.enums import FulfillmentStatus

    if fulfillment.status == FulfillmentStatus.ACTIVE.value:
        return None
    session = await get_active_session(
        db,
        customer_id=fulfillment.customer_id,
        fulfillment_id=fulfillment.id,
    )
    if session and session.current_step:
        href = _href_for(session)
        if href:
            return {
                "type": "onboarding",
                "step": session.current_step,
                "href": href,
                "progress": session.progress,
            }
    if (fulfillment.handler_key or "") == "project":
        return {
            "type": "briefing",
            "step": "briefing",
            "href": "/site-briefing",
            "progress": 50,
        }
    if (fulfillment.handler_key or "") == "mail":
        return {
            "type": "onboarding",
            "step": "domain",
            "href": "/services/email/setup",
            "progress": 10,
        }
    return None


def _href_for(session: OnboardingSession) -> str | None:
    if session.type == "professional_email":
        return "/services/email/setup"
    if session.type == "website_project":
        return "/site-briefing"
    return None
