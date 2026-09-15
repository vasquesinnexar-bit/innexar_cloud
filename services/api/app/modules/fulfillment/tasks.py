"""Fulfillment background tasks (P0). Ponto único pós-pagamento.

Todos os paid paths (webhook Stripe/MP, Bricks, mark-paid) enfileiram
`fulfillment_after_payment`: contratação formal + fulfillment + execução.
Mantém os nomes legados onde existiam para compatibilidade.
"""

from __future__ import annotations

import logging

from app.core.database import AsyncSessionLocal
from app.modules.fulfillment import facade

logger = logging.getLogger(__name__)


async def fulfillment_after_payment(
    invoice_id: int,
    *,
    actor_type: str = "system",
    actor_id: str | None = None,
    source: str | None = None,
) -> None:
    """Background: ensure contract/item/fulfillment + run handlers (1 sessão)."""
    async with AsyncSessionLocal() as db:
        try:
            await facade.after_payment(
                db,
                invoice_id,
                actor_type=actor_type,
                actor_id=actor_id,
                source=source,
            )
            await db.commit()
        except Exception:
            await db.rollback()
            logger.exception("fulfillment_after_payment failed invoice %s", invoice_id)
            raise


async def _run_provisioning(invoice_id: int) -> None:
    """Compat: nome legado usado pelos paid paths (agora via facade)."""
    await fulfillment_after_payment(invoice_id)


async def _run_create_project_and_notify(invoice_id: int) -> None:
    """Compat: projeto segue idempotente (facade também o garante)."""
    from app.modules.billing.post_payment import (
        create_project_and_notify_after_payment,
    )

    async with AsyncSessionLocal() as db:
        try:
            await create_project_and_notify_after_payment(db, invoice_id)
            await db.commit()
        except Exception:
            await db.rollback()
            raise
