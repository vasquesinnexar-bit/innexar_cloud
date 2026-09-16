"""Marketplace service (P1.2): catálogo e compra scoped ao cliente logado.

Regras:
- Preço SEMPRE resolvido no servidor (nunca do browser).
- billing_provider nunca vem do frontend (contrato herda cliente/plano).
- Contrato reutilizado se ACTIVE/PENDING + mesma moeda + mesmo provider
  (NULL-safe); senão cria novo. Nunca mistura BRL+USD nem Stripe+MP.
- Idempotência real por (cliente, idempotency_key) na invoice.
"""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.audit import log_audit
from app.models.customer import Customer
from app.modules.billing.contract_invoicing import create_invoice_from_contract
from app.modules.billing.models import (
    Contract,
    ContractItem,
    Invoice,
    PricePlan,
    Product,
)

logger = logging.getLogger(__name__)

SOURCE = "portal"
MAX_QTY = 100


class MarketplaceError(Exception):
    def __init__(self, code: str, detail: str = "", status: int = 422):
        super().__init__(detail or code)
        self.code = code
        self.detail = detail or code
        self.status = status


def customer_currency(customer: Customer) -> str:
    if customer.currency:
        return customer.currency
    return "BRL" if (customer.org_id or "") == "innexar-br" else "USD"


async def list_catalog(db: AsyncSession, customer: Customer) -> list[dict]:
    """Produtos portal_sellable + ativos + da org + planos na moeda do cliente."""
    currency = customer_currency(customer)
    products = (
        (
            await db.execute(
                select(Product)
                .options(selectinload(Product.price_plans))
                .where(
                    Product.org_id == customer.org_id,
                    Product.is_active.is_(True),
                    Product.portal_sellable.is_(True),
                )
                .order_by(Product.name)
            )
        )
        .scalars()
        .all()
    )
    out = []
    for p in products:
        plans = [
            pl for pl in (p.price_plans or []) if (pl.currency or "USD") == currency
        ]
        if not plans:
            continue
        out.append(
            {
                "id": p.id,
                "name": p.name,
                "description": p.description,
                "category": p.category,
                "slug": p.slug,
                "fulfillment_handler": p.fulfillment_handler,
                "fulfillment_strategy": p.fulfillment_strategy,
                "plans": [
                    {
                        "id": pl.id,
                        "name": pl.name,
                        "interval": pl.interval,
                        "amount": float(pl.amount),
                        "currency": pl.currency,
                        "billing_type": pl.billing_type,
                        "unit": pl.unit,
                    }
                    for pl in sorted(plans, key=lambda x: float(x.amount))
                ],
            }
        )
    return out


async def _find_compatible_contract(
    db: AsyncSession, customer: Customer, currency: str, provider: str | None
) -> Contract | None:
    """Reusa contrato ACTIVE/PENDING com mesma moeda + mesmo provider (NULL-safe)."""
    rows = (
        (
            await db.execute(
                select(Contract)
                .where(
                    Contract.customer_id == customer.id,
                    Contract.status.in_(["active", "pending"]),
                )
                .order_by(Contract.id)
            )
        )
        .scalars()
        .all()
    )
    for c in rows:
        c_currency = c.currency or customer.currency or "USD"
        if c_currency != currency:
            continue
        c_provider = c.billing_provider or None
        if (c_provider or None) != (provider or None):
            continue
        return c
    return None


async def purchase(
    db: AsyncSession,
    customer: Customer,
    *,
    product_id: int,
    price_plan_id: int,
    quantity: int = 1,
    idempotency_key: str | None = None,
    actor_id: str | None = None,
) -> dict:
    """Compra: valida tudo no servidor, cria contrato/item/invoice. Idempotente."""
    if quantity < 1 or quantity > MAX_QTY:
        raise MarketplaceError("invalid_quantity", "Quantidade inválida")
    if idempotency_key:
        existing = (
            await db.execute(
                select(Invoice).where(
                    Invoice.customer_id == customer.id,
                    Invoice.idempotency_key == idempotency_key,
                )
            )
        ).scalar_one_or_none()
        if existing:
            item = None
            for iid in _invoice_item_ids(existing):
                item = await db.get(ContractItem, iid)
                if item:
                    break
            contract = await db.get(Contract, item.contract_id) if item else None
            return {
                "contract_id": contract.id if contract else None,
                "contract_item_id": item.id if item else None,
                "invoice_id": existing.id,
                "total": float(existing.total),
                "currency": existing.currency,
                "status": existing.status,
                "reused": True,
            }
    product = await db.get(Product, product_id)
    if (
        not product
        or not product.is_active
        or not product.portal_sellable
        or product.org_id != customer.org_id
    ):
        raise MarketplaceError(
            "product_unavailable",
            "Produto indisponível para contratação",
            status=404,
        )
    plan = await db.get(PricePlan, price_plan_id)
    if (
        not plan
        or plan.product_id != product.id
        or (plan.currency or "USD") != customer_currency(customer)
    ):
        raise MarketplaceError(
            "plan_unavailable", "Plano indisponível para este produto/moeda"
        )
    currency = plan.currency or "USD"
    provider = plan.provider or customer.billing_provider or None
    contract = await _find_compatible_contract(db, customer, currency, provider)
    if contract is None:
        contract = Contract(
            customer_id=customer.id,
            org_id=customer.org_id,
            status="pending",
            currency=currency,
            billing_provider=provider,
            billing_interval=(
                "one_time" if plan.billing_type == "one_time" else "monthly"
            ),
            source=SOURCE,
        )
        db.add(contract)
        await db.flush()
        await log_audit(
            db,
            entity="contract",
            entity_id=str(contract.id),
            action="portal_purchase_created",
            actor_type="customer",
            actor_id=actor_id,
            org_id=customer.org_id,
        )
        await db.flush()
    subscription_id = None
    if plan.billing_type == "recurring":
        from app.modules.billing.models import Subscription

        sub = Subscription(
            customer_id=customer.id,
            product_id=product.id,
            price_plan_id=plan.id,
            status="inactive",
            currency=currency,
        )
        db.add(sub)
        await db.flush()
        subscription_id = sub.id
    item = ContractItem(
        contract_id=contract.id,
        product_id=product.id,
        price_plan_id=plan.id,
        subscription_id=subscription_id,
        description=f"{product.name} — {plan.name}",
        quantity=quantity,
        unit_amount=float(plan.amount),
        source=SOURCE,
    )
    db.add(item)
    await db.flush()
    await log_audit(
        db,
        entity="contract_item",
        entity_id=str(item.id),
        action="contract_item_created",
        actor_type="customer",
        actor_id=actor_id,
        org_id=customer.org_id,
        payload={"contract_id": contract.id, "product_id": product.id},
    )
    await db.flush()
    # Fatura SOMENTE este item (não o contrato inteiro).
    inv = await _invoice_for_item(
        db, customer, contract, item, idempotency_key, actor_id
    )
    return {
        "contract_id": contract.id,
        "contract_item_id": item.id,
        "invoice_id": inv.id,
        "total": float(inv.total),
        "currency": inv.currency,
        "status": inv.status,
        "reused": False,
    }


async def _invoice_for_item(
    db: AsyncSession,
    customer: Customer,
    contract: Contract,
    item: ContractItem,
    idempotency_key: str | None,
    actor_id: str | None,
):
    """Fatura de um único item via helper compartilhado (sem duplicar cálculo)."""
    from datetime import timedelta

    from app.core.datetime_utils import utc_now
    from app.modules.billing.contract_invoicing import (
        ContractBillingError,
    )

    try:
        return await create_invoice_from_contract(
            db,
            contract,
            due_date=utc_now() + timedelta(days=3),
            only_item_ids=[item.id],
            subscription_id=item.subscription_id,
            idempotency_key=idempotency_key,
            status="pending",
            actor_type="customer",
            actor_id=actor_id,
        )
    except ContractBillingError as e:
        raise MarketplaceError("invoice_failed", e.detail) from e


async def list_my_purchases(db: AsyncSession, customer: Customer) -> list[dict]:
    """Itens do cliente com status de invoice + fulfillment (Meus serviços)."""
    from app.modules.fulfillment.models import Fulfillment

    items = (
        await db.execute(
            select(ContractItem, Contract, Product)
            .join(Contract, Contract.id == ContractItem.contract_id)
            .outerjoin(Product, Product.id == ContractItem.product_id)
            .where(Contract.customer_id == customer.id)
            .order_by(ContractItem.id.desc())
        )
    ).all()
    invoices = (
        (
            await db.execute(
                select(Invoice)
                .where(Invoice.customer_id == customer.id)
                .order_by(Invoice.id.desc())
            )
        )
        .scalars()
        .all()
    )
    fulfillments = (
        (
            await db.execute(
                select(Fulfillment).where(Fulfillment.customer_id == customer.id)
            )
        )
        .scalars()
        .all()
    )
    by_item = {}
    for x in invoices:
        for iid in _invoice_item_ids(x):
            by_item.setdefault(iid, x)
    by_item_f = {}
    for fl in fulfillments:
        by_item_f.setdefault(fl.contract_item_id, fl)
    out = []
    for item, _contract, product in items:
        inv_match = by_item.get(item.id)
        f = by_item_f.get(item.id)
        out.append(
            {
                "id": item.id,
                "product_name": product.name if product else item.description,
                "description": item.description,
                "quantity": item.quantity,
                "unit_amount": (
                    float(item.unit_amount) if item.unit_amount is not None else None
                ),
                "source": item.source,
                "invoice_id": inv_match.id if inv_match else None,
                "invoice_status": inv_match.status if inv_match else None,
                "invoice_total": (float(inv_match.total) if inv_match else None),
                "fulfillment_status": f.status if f else None,
                "fulfillment_step": f.current_step if f else None,
            }
        )
    return out


def _invoice_item_ids(inv: Invoice) -> list[int]:
    items = inv.line_items
    nested: list = []
    if isinstance(items, list):
        nested = items
    elif isinstance(items, dict):
        maybe = items.get("items") or items.get("line_items") or []
        if isinstance(maybe, list):
            nested = maybe
    return [
        x.get("contract_item_id")
        for x in nested
        if isinstance(x, dict) and x.get("contract_item_id") is not None
    ]
