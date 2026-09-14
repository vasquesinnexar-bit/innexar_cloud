"""Hosting worker CLI (Fase 4). Chamado pelo cron do host, ex.:

    docker exec innexar-usa-workspace-backend python -m app.jobs.hosting_cron process

Lock exclusivo via PG advisory lock (chave distinta do billing).
"""

from __future__ import annotations

import asyncio
import logging
import sys

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal

import app.main  # noqa: F401 (registra todos os models p/ o mapper)

logger = logging.getLogger("hosting_cron")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

LOCK_KEY = 829138


async def _locked(db: AsyncSession, name: str, fn):
    got = (
        await db.execute(text("SELECT pg_try_advisory_lock(:k)"), {"k": LOCK_KEY})
    ).scalar()
    if not got:
        logger.info("lock ocupado, pulando %s", name)
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


async def cmd_process() -> dict:
    from app.modules.hosting.models import HostingJob
    from app.modules.hosting.service import HostingServiceLayer

    async with AsyncSessionLocal() as db:
        async def run():
            rows = (
                await db.execute(
                    select(HostingJob).where(HostingJob.status == "pending")
                    .order_by(HostingJob.id).limit(20)
                )
            ).scalars().all()
            layer = HostingServiceLayer(db)
            done, failed = 0, 0
            for job in rows:
                await layer.run_job(job)
                if job.status == "completed":
                    done += 1
                else:
                    failed += 1
            return {"done": done, "failed": failed}

        return await _locked(db, "process", run)


async def cmd_ssl_check() -> dict:
    """Avisa certificados <14 dias (sem enforce)."""
    from app.modules.billing.lifecycle import notify_customer
    from app.modules.hosting.models import HostingService
    from app.modules.hosting.service import _ssl_info
    from app.models.customer import Customer

    async with AsyncSessionLocal() as db:
        async def run():
            rows = (
                await db.execute(
                    select(HostingService).where(
                        HostingService.primary_domain.is_not(None))
                )
            ).scalars().all()
            warned = 0
            for svc in rows:
                info = _ssl_info(svc.primary_domain or "")
                days = info.get("days_remaining")
                if info.get("ok") and days is not None and days < 14:
                    cust = await db.get(Customer, svc.customer_id)
                    if cust:
                        await notify_customer(
                            db, cust, "ssl_expiring", org_id=svc.org_id,
                            domain=svc.primary_domain, days=days)
                        warned += 1
            return {"warned": warned}

        return await _locked(db, "ssl-check", run)


COMMANDS = {"process": cmd_process, "ssl-check": cmd_ssl_check}


async def amain(argv: list[str]) -> int:
    which = argv[0] if argv else "process"
    if which not in COMMANDS:
        print(f"comando desconhecido: {which} (use: {'|'.join(COMMANDS)})")
        return 2
    try:
        logger.info("%s -> %s", which, await COMMANDS[which]())
    except Exception:
        logger.exception("%s falhou", which)
        return 1
    return 0


def main() -> None:
    raise SystemExit(asyncio.run(amain(sys.argv[1:])))


if __name__ == "__main__":
    main()
