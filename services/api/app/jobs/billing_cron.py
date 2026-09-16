"""Billing scheduler CLI (Fase 3). Chamado pelo cron do host, ex.:


    docker exec innexar-usa-workspace-backend python -m app.jobs.billing_cron all

Lock exclusivo via PG advisory lock (duas workers nunca faturam junto).
Tudo idempotente: re-execução segura.
"""

from __future__ import annotations

import asyncio
import logging
import sys

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.modules.billing.lifecycle import (
    mark_past_due,
    reconcile,
    send_reminders,
    suspend_overdue,
)
from app.modules.billing.recurring_ops import generate_recurring_invoices

logger = logging.getLogger("billing_cron")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

LOCK_KEY = 829137


async def _with_lock(db: AsyncSession, coro_name: str, fn):
    got = (
        await db.execute(text("SELECT pg_try_advisory_lock(:k)"), {"k": LOCK_KEY})
    ).scalar()
    if not got:
        logger.info("lock ocupado, pulando %s", coro_name)
        return {"skipped": True}
    try:
        result = await fn()
        await db.commit()
        return result
    except Exception:
        await db.rollback()
        raise
    finally:
        await db.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": LOCK_KEY})


async def cmd_generate() -> dict:
    async with AsyncSessionLocal() as db:

        async def run():
            return {"invoices": await generate_recurring_invoices(db)}

        return await _with_lock(db, "generate", run)


async def cmd_remind() -> dict:
    async with AsyncSessionLocal() as db:

        async def run():
            return {"sent": await send_reminders(db)}

        return await _with_lock(db, "remind", run)


async def cmd_overdue() -> dict:
    async with AsyncSessionLocal() as db:

        async def run():
            past = await mark_past_due(db)
            susp = await suspend_overdue(db)
            return {"past_due": past, "suspended": susp}

        return await _with_lock(db, "overdue", run)


async def cmd_reconcile() -> dict:
    async with AsyncSessionLocal() as db:

        async def run():
            return await reconcile(db)

        return await _with_lock(db, "reconcile", run)


async def cmd_contracts() -> dict:
    from app.jobs import contract_billing

    async with AsyncSessionLocal() as db:

        async def run():
            return await contract_billing.generate(db)

        return await _with_lock(db, "contracts", run)


async def cmd_fulfillments() -> dict:
    from app.modules.fulfillment.facade import process_due_fulfillments

    async with AsyncSessionLocal() as db:

        async def run():
            return await process_due_fulfillments(db)

        return await _with_lock(db, "fulfillments", run)


async def cmd_external_sync() -> dict:
    from app.modules.billing.external_sync import sync_external_billing

    async with AsyncSessionLocal() as db:

        async def run():
            return await sync_external_billing(db)

        return await _with_lock(db, "external-sync", run)


async def cmd_onboarding_verify() -> dict:
    from app.modules.onboarding.verify_job import verify_waiting_dns

    async with AsyncSessionLocal() as db:

        async def run():
            return await verify_waiting_dns(db)

        return await _with_lock(db, "onboarding-verify", run)


COMMANDS = {
    "generate": cmd_generate,  # faturas recorrentes (subscriptions)
    "contracts": cmd_contracts,  # faturas por contrato (Fase 3)
    "remind": cmd_remind,  # lembretes antes/depois
    "overdue": cmd_overdue,  # past_due + suspensão
    "reconcile": cmd_reconcile,  # provider x Innexar
    "fulfillments": cmd_fulfillments,  # P0: QUEUED + retries vencidos
    "external-sync": cmd_external_sync,  # provedor → local (Stripe + MP)
    "onboarding-verify": cmd_onboarding_verify,  # P1.3: DNS waiting → resume
}


async def amain(argv: list[str]) -> int:
    which = argv[0] if argv else "all"
    targets = list(COMMANDS) if which == "all" else [which]
    for name in targets:
        if name not in COMMANDS:
            print(f"comando desconhecido: {name} (use: all|{'|'.join(COMMANDS)})")
            return 2
    for name in targets:
        try:
            result = await COMMANDS[name]()
            logger.info("%s -> %s", name, result)
        except Exception:
            logger.exception("%s falhou", name)
            return 1
    return 0


def main() -> None:
    raise SystemExit(asyncio.run(amain(sys.argv[1:])))


if __name__ == "__main__":
    main()
