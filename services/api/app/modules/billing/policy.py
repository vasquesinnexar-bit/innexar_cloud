"""BillingPolicy: regras configuráveis (Fase 3). Resolução: contract → product → org → global → defaults."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.billing.models import BillingPolicy

DEFAULTS = {
    "grace_period_days": 7,
    "reminder_days_before": [3, 1],
    "reminder_days_after": [1, 3, 5],
    "suspend_after_days": 14,
    "cancel_after_days": None,
    "auto_reactivate": True,
}


async def resolve_policy(
    db: AsyncSession,
    *,
    org_id: str | None = None,
    product_id: int | None = None,
    contract_id: int | None = None,
) -> dict:
    """Merge contract > product > org > global > defaults (só policies ativas)."""
    rows = (
        await db.execute(
            select(BillingPolicy).where(BillingPolicy.is_active.is_(True))
        )
    ).scalars().all()
    by_scope: dict[tuple[str, str | None], BillingPolicy] = {
        (p.scope, p.scope_ref): p for p in rows
    }

    def pick(scope: str, ref: str | int | None):
        if ref is None:
            return None
        return by_scope.get((scope, str(ref)))

    merged = dict(DEFAULTS)
    for scope, ref in (
        ("global", None),
        ("org", org_id),
        ("product", product_id),
        ("contract", contract_id),
    ):
        if scope == "global":
            p = by_scope.get(("global", None))
        else:
            p = pick(scope, ref)
        if not p:
            continue
        merged["grace_period_days"] = p.grace_period_days
        if p.reminder_days_before is not None:
            merged["reminder_days_before"] = list(p.reminder_days_before)
        if p.reminder_days_after is not None:
            merged["reminder_days_after"] = list(p.reminder_days_after)
        merged["suspend_after_days"] = p.suspend_after_days
        merged["cancel_after_days"] = p.cancel_after_days
        merged["auto_reactivate"] = p.auto_reactivate
    return merged
