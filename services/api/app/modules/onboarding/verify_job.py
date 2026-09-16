"""Verify job (P1.3): revalida DNS de onboardings aguardando e auto-resume.

Sem navegador aberto: waiting → verified → auto advance → fulfillment →
notify. Idempotente e silencioso quando nada muda.
"""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.datetime_utils import utc_now
from app.modules.onboarding.enums import OnboardingStatus, OnboardingStepStatus
from app.modules.onboarding.models import OnboardingSession

logger = logging.getLogger(__name__)


async def verify_waiting_dns(db: AsyncSession, limit: int = 50) -> dict:
    from app.modules.onboarding import service as onboarding
    from app.modules.onboarding.registry import get_handler

    sessions = (
        (
            await db.execute(
                select(OnboardingSession)
                .where(
                    OnboardingSession.status.in_(
                        [
                            OnboardingStatus.WAITING_DNS.value,
                            OnboardingStatus.ACTIVE.value,
                            OnboardingStatus.WAITING_CUSTOMER.value,
                        ]
                    )
                )
                .order_by(OnboardingSession.id)
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )
    checked = verified = 0
    for session in sessions:
        try:
            steps = await onboarding._steps_map(db, session)  # noqa: SLF001
            step = steps.get("dns_verification")
            if not step or step.status not in (
                OnboardingStepStatus.BLOCKED.value,
                OnboardingStepStatus.PENDING.value,
                OnboardingStepStatus.ACTIVE.value,
            ):
                continue
            handler = get_handler(session.type)
            if not hasattr(handler, "_run_verification"):
                continue
            checked += 1
            was_completed = session.status == OnboardingStatus.COMPLETED.value
            result = await handler._run_verification(db, session)  # noqa: SLF001
            if result.ok:
                step.status = OnboardingStepStatus.COMPLETED.value
                step.completed_at = utc_now()
                step.validation_error = None
                verified += 1
                await onboarding._recompute(db, session)  # noqa: SLF001
                await onboarding.auto_advance(db, session)  # noqa: SLF001
                await onboarding.maybe_advance_fulfillment(db, session, was_completed)
                await onboarding.notify(db, session, "dns_verified")
            else:
                step.validation_error = (result.error or "")[:500]
                session.status = OnboardingStatus.WAITING_DNS.value
            await db.commit()
        except Exception:  # noqa: BLE001 (uma sessão nunca trava o lote)
            logger.exception("onboarding verify failed %s", session.id)
            await db.rollback()
    return {"checked": checked, "verified": verified}
