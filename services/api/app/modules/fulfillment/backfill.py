"""Backfill P0: Contracts/Items existentes → Fulfillment (sem provisionar).

Somente leitura por padrão (--dry-run). Com --apply cria fulfillments com
estado coerente ao que já existe (Service/Project/Record). Nunca executa
provider, nunca altera contratos.
"""

from __future__ import annotations

import argparse
import asyncio
import logging

from sqlalchemy import select

import app.main  # noqa: F401 (registra todos os models no metadata)
from app.core.database import AsyncSessionLocal
from app.modules.billing.models import (
    Contract,
    ContractItem,
    Invoice,
    Product,
    ProvisioningRecord,
    Subscription,
)
from app.modules.fulfillment import facade
from app.modules.fulfillment.enums import FulfillmentStatus
from app.modules.fulfillment.registry import resolve_handler

logger = logging.getLogger("fulfillment_backfill")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


async def _mail_service_state(db, customer_id: int) -> str | None:
    from app.modules.mail.models import Service as MailService

    rows = (
        (
            await db.execute(
                select(MailService.status).where(MailService.customer_id == customer_id)
            )
        )
        .scalars()
        .all()
    )
    if not rows:
        return None
    if any(s == "active" for s in rows):
        return "active"
    if any(s == "suspended" for s in rows):
        return "suspended"
    return rows[0]


async def _project_state(db, subscription_id: int | None) -> str | None:
    if not subscription_id:
        return None
    from app.modules.projects.models import Project

    row = (
        (
            await db.execute(
                select(Project.status)
                .where(Project.subscription_id == subscription_id)
                .order_by(Project.id.desc())
            )
        )
        .scalars()
        .first()
    )
    return row


async def _hestia_state(db, subscription_id: int | None) -> str | None:
    if not subscription_id:
        return None
    row = (
        (
            await db.execute(
                select(ProvisioningRecord.status)
                .where(
                    ProvisioningRecord.subscription_id == subscription_id,
                    ProvisioningRecord.provider == "hestia",
                )
                .order_by(ProvisioningRecord.id.desc())
            )
        )
        .scalars()
        .first()
    )
    return row


async def _contract_has_paid_invoice(
    db, contract_id: int, subscription_id: int | None
) -> bool:
    q = select(Invoice.id).where(Invoice.status == "paid")
    if subscription_id:
        sub = await db.get(Subscription, subscription_id)
        if sub:
            q = q.where(
                (Invoice.subscription_id == subscription_id)
                | (Invoice.customer_id == sub.customer_id)
            )
            row = (await db.execute(q.limit(1))).first()
            return row is not None
    contract = await db.get(Contract, contract_id)
    if not contract:
        return False
    row = (
        await db.execute(q.where(Invoice.customer_id == contract.customer_id).limit(1))
    ).first()
    return row is not None


async def plan(db) -> list[dict]:
    """Descreve o que o backfill criaria (sem escrever)."""
    out = []
    items = (
        (await db.execute(select(ContractItem).order_by(ContractItem.id)))
        .scalars()
        .all()
    )
    for item in items:
        exists = (
            await db.execute(
                select(facade.Fulfillment.id).where(
                    facade.Fulfillment.idempotency_key == f"ci-{item.id}"
                )
            )
        ).first()
        if exists:
            continue
        contract = await db.get(Contract, item.contract_id)
        product = await db.get(Product, item.product_id) if item.product_id else None
        strategy, handler = resolve_handler(product)
        status = FulfillmentStatus.MANUAL_REVIEW.value
        step = "manual_review"
        progress = 10
        if handler == "mail":
            st = await _mail_service_state(db, contract.customer_id)
            if st == "active":
                status, step, progress = "active", "done", 100
            elif st == "suspended":
                status, step, progress = "suspended", "suspended", 100
        elif handler == "project":
            st = await _project_state(db, item.subscription_id)
            if st and "briefing" in st:
                status, step, progress = "waiting_input", "briefing", 70
            elif st:
                status, step, progress = "active", "done", 100
        elif handler == "hestia":
            st = await _hestia_state(db, item.subscription_id)
            if st == "provisioned":
                status, step, progress = "active", "done", 100
        elif handler == "manual":
            if await _contract_has_paid_invoice(
                db, item.contract_id, item.subscription_id
            ):
                status, step, progress = "active", "manual_followup", 100
        out.append(
            {
                "contract_item_id": item.id,
                "contract_id": item.contract_id,
                "customer_id": contract.customer_id,
                "product": product.name if product else None,
                "handler": handler,
                "strategy": strategy,
                "status": status,
                "step": step,
                "progress": progress,
            }
        )
    return out


async def apply() -> dict:
    from app.modules.fulfillment.models import Fulfillment

    async with AsyncSessionLocal() as db:
        rows = await plan(db)
        created = 0
        for r in rows:
            item = await db.get(ContractItem, r["contract_item_id"])
            contract = await db.get(Contract, r["contract_id"])
            inv = None
            if item.subscription_id:
                inv = (
                    (
                        await db.execute(
                            select(Invoice)
                            .where(
                                Invoice.subscription_id == item.subscription_id,
                                Invoice.status == "paid",
                            )
                            .order_by(Invoice.id.desc())
                        )
                    )
                    .scalars()
                    .first()
                )
            f = Fulfillment(
                org_id=contract.org_id,
                customer_id=r["customer_id"],
                contract_id=r["contract_id"],
                contract_item_id=item.id,
                product_id=item.product_id,
                invoice_id=inv.id if inv else None,
                subscription_id=item.subscription_id,
                strategy=r["strategy"],
                handler_key=r["handler"],
                status=r["status"],
                current_step=r["step"],
                progress=r["progress"],
                idempotency_key=f"ci-{item.id}",
                meta={"backfill": True},
            )
            if r["status"] == "active":
                from app.core.datetime_utils import utc_now

                f.started_at = utc_now()
                f.completed_at = utc_now()
            db.add(f)
            from app.core.audit import log_audit

            await log_audit(
                db,
                entity="fulfillment",
                entity_id=None,
                action="fulfillment_backfilled",
                actor_type="system",
                actor_id="backfill",
                org_id=contract.org_id,
                payload={"contract_item_id": item.id},
            )
            created += 1
        await db.commit()
        return {"created": created, "planned": len(rows)}


async def amain(apply_flag: bool) -> int:
    async with AsyncSessionLocal() as db:
        rows = await plan(db)
    if not apply_flag:
        print(f"DRY-RUN: {len(rows)} fulfillments seriam criados")
        for r in rows:
            print(
                f"  item={r['contract_item_id']} prod={r['product']} "
                f"handler={r['handler']} → {r['status']}/{r['step']}"
            )
        return 0
    result = await apply()
    print(f"APPLY: {result}")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    raise SystemExit(asyncio.run(amain(args.apply)))


if __name__ == "__main__":
    raise SystemExit(main())
