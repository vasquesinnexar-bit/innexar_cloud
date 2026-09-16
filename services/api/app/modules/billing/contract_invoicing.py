"""Faturamento a partir de contrato (P1/P1.2): lógica compartilhada.

Usado pelo Workspace (staff) e pelo purchase do Portal (cliente).
Preço SEMPRE = qty × unit_amount do item (snapshot); nunca do browser.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import log_audit
from app.core.datetime_utils import utc_now
from app.models.customer import Customer
from app.modules.billing.invoice_ops import create_manual_invoice
from app.modules.billing.models import Contract, Invoice, PricePlan, Product


class ContractBillingError(Exception):
    """Erro de domínio com código estável."""

    def __init__(self, code: str, detail: str = ""):
        super().__init__(detail or code)
        self.code = code
        self.detail = detail or code


async def create_invoice_from_contract(
    db: AsyncSession,
    contract: Contract,
    *,
    due_date: datetime | None = None,
    subscription_id: int | None = None,
    idempotency_key: str | None = None,
    only_item_ids: list[int] | None = None,
    actor_type: str = "staff",
    actor_id: str | None = None,
) -> Invoice:
    """Gera invoice dos itens (422 se item sem preço). Idempotente por chave."""
    if idempotency_key:
        from sqlalchemy import select

        existing = (
            await db.execute(
                select(Invoice).where(
                    Invoice.customer_id == contract.customer_id,
                    Invoice.idempotency_key == idempotency_key,
                )
            )
        ).scalar_one_or_none()
        if existing:
            return existing
    items = list(contract.items or [])
    if only_item_ids is not None:
        wanted = set(only_item_ids)
        items = [i for i in items if i.id in wanted]
    if not items:
        raise ContractBillingError("empty_contract", "Contrato sem itens")
    missing = [i.id for i in items if i.unit_amount is None]
    if missing:
        raise ContractBillingError("item_without_price", f"Itens sem preço: {missing}")
    lines: list[dict] = []
    total = 0.0
    for i in items:
        product = await db.get(Product, i.product_id) if i.product_id else None
        plan = await db.get(PricePlan, i.price_plan_id) if i.price_plan_id else None
        amount = float(i.unit_amount or 0) * (i.quantity or 1)
        total += amount
        lines.append(
            {
                "description": i.description
                or (
                    plan.name
                    if plan
                    else (product.name if product else f"Item #{i.id}")
                ),
                "quantity": i.quantity or 1,
                "unit_amount": float(i.unit_amount or 0),
                "amount": amount,
                "contract_item_id": i.id,
                "contract_id": contract.id,
            }
        )
    cust = await db.get(Customer, contract.customer_id)
    currency = contract.currency or (cust.currency if cust else None) or "USD"
    inv = await create_manual_invoice(
        db,
        customer_id=contract.customer_id,
        due_date=due_date or (utc_now() + timedelta(days=7)),
        total=round(total, 2),
        currency=currency,
        line_items=lines,
    )
    if idempotency_key:
        inv.idempotency_key = idempotency_key
        await db.flush()
    if subscription_id is not None:
        inv.subscription_id = subscription_id
        await db.flush()
    await log_audit(
        db,
        entity="invoice",
        entity_id=str(inv.id),
        action="invoice_created_from_contract",
        actor_type=actor_type,
        actor_id=str(actor_id) if actor_id is not None else None,
        org_id=contract.org_id,
        payload={"contract_id": contract.id, "total": round(total, 2)},
    )
    await db.flush()
    await db.refresh(inv)
    return inv
