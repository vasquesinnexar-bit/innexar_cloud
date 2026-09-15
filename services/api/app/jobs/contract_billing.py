"""Geração de faturas por contrato (Fase 3). Idempotente via period_key."""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.billing.enums import ContractStatus, InvoiceStatus
from app.modules.billing.lifecycle import contract_tz, notify_customer
from app.modules.billing.models import Contract, ContractItem, Invoice

logger = logging.getLogger(__name__)

INTERVAL_MONTHS = {
    "monthly": 1,
    "quarterly": 3,
    "biannual": 6,
    "semiannual": 6,
    "yearly": 12,
    "annual": 12,
}


def _period_key(contract_id: int, year: int, month: int) -> str:
    return f"c{contract_id}-{year:04d}-{month:02d}"


async def generate(db: AsyncSession) -> dict:
    """Gera faturas dos contratos ativos no período corrente. Retorna contadores."""
    contracts = (
        (
            await db.execute(
                select(Contract).where(Contract.status == ContractStatus.ACTIVE.value)
            )
        )
        .scalars()
        .all()
    )
    created, skipped = 0, []
    for contract in contracts:
        try:
            if await _generate_one(db, contract):
                created += 1
            else:
                skipped.append(contract.id)
        except Exception:  # noqa: BLE001
            logger.exception("generate failed for contract %s", contract.id)
    await db.flush()
    return {"created": created, "skipped": skipped}


async def _generate_one(db: AsyncSession, contract) -> bool:
    from app.models.customer import Customer
    from app.modules.billing.models import PricePlan, Product

    interval = (contract.billing_interval or "monthly").lower()
    if interval == "one_time":
        return False
    months = INTERVAL_MONTHS.get(interval)
    if not months:
        return False
    tz = contract_tz(contract.org_id, getattr(contract, "timezone", None))
    today = datetime.now(tz).date()
    if today.day < (contract.billing_day or 1):
        return False
    period = _period_key(contract.id, today.year, today.month)
    exists = (
        await db.execute(select(Invoice.id).where(Invoice.period_key == period))
    ).scalar_one_or_none()
    if exists:
        return False
    cust = (
        await db.execute(select(Customer).where(Customer.id == contract.customer_id))
    ).scalar_one_or_none()
    if not cust:
        return False
    currency = (
        contract.currency
        or cust.currency
        or ("BRL" if contract.org_id == "innexar-br" else "USD")
    )
    items = (
        (
            await db.execute(
                select(ContractItem).where(ContractItem.contract_id == contract.id)
            )
        )
        .scalars()
        .all()
    )
    if not items:
        return False
    # Setup (one_time) só na primeira fatura do contrato.
    prior = (
        (
            await db.execute(
                select(Invoice.id).where(
                    Invoice.customer_id == contract.customer_id,
                    Invoice.status.notin_(
                        [InvoiceStatus.CANCELED.value, InvoiceStatus.VOID.value]
                    ),
                )
            )
        )
        .scalars()
        .first()
    )
    lines: list[dict] = []
    total = 0.0
    for item in items:
        plan = None
        if item.price_plan_id:
            plan = await db.get(PricePlan, item.price_plan_id)
        is_setup = (plan.billing_type == "one_time") if plan else False
        if is_setup and prior:
            continue
        amount = (
            float(item.unit_amount)
            if item.unit_amount is not None
            else (float(plan.amount) if plan else 0.0)
        )
        line_total = round(amount * (item.quantity or 1), 2)
        total += line_total
        prod_name = None
        if item.product_id:
            prod = await db.get(Product, item.product_id)
            prod_name = prod.name if prod else None
        lines.append(
            {
                "description": item.description or prod_name or "Item",
                "quantity": item.quantity or 1,
                "unit_amount": amount,
                "line_total": line_total,
                "preferred_locale": cust.locale
                or ("pt-BR" if contract.org_id == "innexar-br" else "en-US"),
            }
        )
    if not lines:
        return False
    credit_used = 0.0
    credit = float(contract.credit_balance or 0)
    if credit > 0:
        credit_used = round(min(credit, total), 2)
        total = round(total - credit_used, 2)
        lines.append(
            {
                "description": "Crédito aplicado",
                "quantity": 1,
                "unit_amount": -credit_used,
                "line_total": -credit_used,
            }
        )
        contract.credit_balance = round(credit - credit_used, 2)
    due_days = contract.due_days if contract.due_days is not None else 10
    due = datetime.now(UTC).replace(
        hour=12, minute=0, second=0, microsecond=0
    ) + timedelta(days=due_days)
    inv = Invoice(
        customer_id=contract.customer_id,
        status=InvoiceStatus.PENDING.value,
        due_date=due,
        total=total,
        currency=currency,
        line_items={"items": lines},
        period_key=period,
    )
    db.add(inv)
    await db.flush()
    await notify_customer(
        db,
        cust,
        "invoice_created",
        org_id=contract.org_id,
        id=inv.id,
        total=f"{currency} {total:.2f}",
        due=due.date().isoformat(),
    )
    return True
