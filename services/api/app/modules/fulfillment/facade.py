"""Fulfillment facade (P0): contratação formal + orquestração idempotente.

Pagamentos (Stripe/MP, todos os paths) chamam `after_payment`: garante
Contract → ContractItem → Fulfillment e executa handlers. Billing nunca sabe
detalhes de produto; só sinaliza "invoice paid".
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.core.audit import log_audit
from app.core.datetime_utils import utc_now
from app.models.customer import Customer
from app.modules.billing.models import (
    Contract,
    ContractItem,
    Invoice,
    PricePlan,
    Product,
    Subscription,
)
from app.modules.fulfillment.enums import FulfillmentStatus
from app.modules.fulfillment.models import Fulfillment
from app.modules.fulfillment.registry import (
    ProvisionContext,
    get_provisioner,
    resolve_handler,
)

logger = logging.getLogger(__name__)

RETRY_DELAY_MINUTES = 15
STALE_PROVISIONING_MINUTES = 30


# -- contratação formal ----------------------------------------------------


async def ensure_contract_for_purchase(
    db,
    *,
    customer_id: int,
    org_id: str,
    subscription_id: int | None = None,
    currency: str | None = None,
    actor_type: str = "system",
    actor_id: str | None = None,
) -> Contract:
    """Um contrato por (cliente, subscription); sem subscription, reusa ou cria."""
    if subscription_id is not None:
        row = (
            (
                await db.execute(
                    select(Contract)
                    .join(ContractItem, ContractItem.contract_id == Contract.id)
                    .where(
                        ContractItem.subscription_id == subscription_id,
                        Contract.status != "cancelled",
                    )
                    .order_by(Contract.id)
                )
            )
            .scalars()
            .first()
        )
        if row:
            return row
    else:
        row = (
            (
                await db.execute(
                    select(Contract)
                    .where(
                        Contract.customer_id == customer_id,
                        Contract.status.in_(["active", "pending"]),
                    )
                    .order_by(Contract.id)
                )
            )
            .scalars()
            .first()
        )
        if row:
            return row
    cust = await db.get(Customer, customer_id)
    contract = Contract(
        customer_id=customer_id,
        org_id=org_id,
        status="active",
        currency=currency or (cust.currency if cust else None),
        billing_interval="monthly",
        starts_at=utc_now(),
    )
    db.add(contract)
    await db.flush()
    await log_audit(
        db,
        entity="contract",
        entity_id=str(contract.id),
        action="fulfillment_contract_ensured",
        actor_type=actor_type,
        actor_id=actor_id,
        org_id=org_id,
        payload={"customer_id": customer_id, "subscription_id": subscription_id},
    )
    await db.flush()
    return contract


async def ensure_contract_item_for_purchase(
    db,
    *,
    contract: Contract,
    product_id: int,
    price_plan_id: int | None = None,
    subscription_id: int | None = None,
    quantity: int = 1,
    unit_amount: float | None = None,
    description: str | None = None,
    actor_type: str = "system",
    actor_id: str | None = None,
) -> ContractItem:
    """Um item por (contrato, produto, plano, subscription) — NULL-safe."""
    pid = price_plan_id if price_plan_id is not None else -1
    sid = subscription_id if subscription_id is not None else -1
    from sqlalchemy import func as _func

    row = (
        (
            await db.execute(
                select(ContractItem)
                .where(
                    ContractItem.contract_id == contract.id,
                    ContractItem.product_id == product_id,
                    _func.coalesce(ContractItem.price_plan_id, -1) == pid,
                    _func.coalesce(ContractItem.subscription_id, -1) == sid,
                )
                .order_by(ContractItem.id)
            )
        )
        .scalars()
        .first()
    )
    if row:
        return row
    item = ContractItem(
        contract_id=contract.id,
        product_id=product_id,
        price_plan_id=price_plan_id,
        subscription_id=subscription_id,
        description=description,
        quantity=quantity or 1,
        unit_amount=unit_amount,
    )
    db.add(item)
    await db.flush()
    await log_audit(
        db,
        entity="contract_item",
        entity_id=str(item.id),
        action="fulfillment_item_ensured",
        actor_type=actor_type,
        actor_id=actor_id,
        org_id=contract.org_id,
        payload={"contract_id": contract.id, "product_id": product_id},
    )
    await db.flush()
    return item


# -- resolução produto/invoice ----------------------------------------------


async def resolve_product_for_invoice(db, invoice: Invoice):
    """(product, plan, subscription|None) a partir da invoice paga."""
    sub = None
    if invoice.subscription_id:
        sub = await db.get(Subscription, invoice.subscription_id)
        if sub is not None:
            product = await db.get(Product, sub.product_id) if sub.product_id else None
            plan = (
                await db.get(PricePlan, sub.price_plan_id)
                if sub.price_plan_id
                else None
            )
            return product, plan, sub
    adopted = await _adopt_mail_item(db, invoice)
    if adopted:
        item, product, plan = adopted
        return product, plan, None
    return None, None, None


async def _adopt_mail_item(db, invoice: Invoice):
    """Invoice de mailbox extra → item/contrato já criados pelo fluxo mail."""
    from app.modules.mail.models import EmailMailbox, MailProvisioningJob
    from app.modules.mail.models import Service as MailServiceModel

    job = (
        (
            await db.execute(
                select(MailProvisioningJob)
                .where(MailProvisioningJob.invoice_id == invoice.id)
                .order_by(MailProvisioningJob.id)
            )
        )
        .scalars()
        .first()
    )
    if not job or not job.mailbox_id:
        return None
    box = await db.get(EmailMailbox, job.mailbox_id)
    if not box or not box.service_id:
        return None
    svc = await db.get(MailServiceModel, box.service_id)
    if not svc or not svc.contract_item_id:
        return None
    item = await db.get(ContractItem, svc.contract_item_id)
    if not item:
        return None
    product = await db.get(Product, item.product_id) if item.product_id else None
    plan = await db.get(PricePlan, item.price_plan_id) if item.price_plan_id else None
    return item, product, plan


# -- fulfillment ------------------------------------------------------------


def _fulfillment_key(contract_item_id: int) -> str:
    return f"ci-{contract_item_id}"


async def ensure_fulfillment_for_item(
    db,
    *,
    item: ContractItem,
    contract: Contract,
    invoice: Invoice,
    product=None,
    actor_type: str = "system",
    actor_id: str | None = None,
) -> Fulfillment:
    """Um fulfillment por ContractItem (idempotente por chave)."""
    existing = (
        await db.execute(
            select(Fulfillment).where(
                Fulfillment.idempotency_key == _fulfillment_key(item.id)
            )
        )
    ).scalar_one_or_none()
    if existing:
        return existing
    if product is None and item.product_id:
        product = await db.get(Product, item.product_id)
    strategy, handler = resolve_handler(product)
    f = Fulfillment(
        org_id=contract.org_id,
        customer_id=contract.customer_id,
        contract_id=contract.id,
        contract_item_id=item.id,
        product_id=item.product_id,
        invoice_id=invoice.id,
        subscription_id=item.subscription_id,
        strategy=strategy,
        handler_key=handler,
        status=FulfillmentStatus.QUEUED.value,
        current_step="queued",
        idempotency_key=_fulfillment_key(item.id),
        meta={"product_id": item.product_id, "price_plan_id": item.price_plan_id},
    )
    db.add(f)
    await db.flush()
    await log_audit(
        db,
        entity="fulfillment",
        entity_id=str(f.id),
        action="fulfillment_created",
        actor_type=actor_type,
        actor_id=actor_id,
        org_id=contract.org_id,
        payload={
            "contract_item_id": item.id,
            "handler": handler,
            "strategy": strategy,
            "invoice_id": invoice.id,
        },
    )
    await db.flush()
    return f


async def _apply_result(
    db, f: Fulfillment, result, *, actor_type: str, actor_id: str | None
) -> None:
    org = f.org_id
    if result.ok:
        f.status = FulfillmentStatus.ACTIVE.value
        f.current_step = result.step or "done"
        f.progress = 100
        f.last_error = None
        f.retryable = False
        f.completed_at = utc_now()
        if f.started_at is None:
            f.started_at = utc_now()
        await log_audit(
            db,
            entity="fulfillment",
            entity_id=str(f.id),
            action="fulfillment_completed",
            actor_type=actor_type,
            actor_id=actor_id,
            org_id=org,
        )
    elif result.waiting_input:
        f.status = FulfillmentStatus.WAITING_INPUT.value
        f.current_step = result.waiting_input
        f.progress = max(f.progress, result.progress)
        f.last_error = (result.error or "")[:500] or None
        f.retryable = False
        await log_audit(
            db,
            entity="fulfillment",
            entity_id=str(f.id),
            action="fulfillment_waiting_input",
            actor_type=actor_type,
            actor_id=actor_id,
            org_id=org,
            payload={"step": result.waiting_input},
        )
    elif result.retryable:
        f.status = FulfillmentStatus.FAILED.value
        f.current_step = result.step
        f.last_error = (result.error or "")[:500] or None
        f.retryable = True
        f.next_retry_at = datetime.now(UTC) + timedelta(minutes=RETRY_DELAY_MINUTES)
        await log_audit(
            db,
            entity="fulfillment",
            entity_id=str(f.id),
            action="fulfillment_failed",
            actor_type=actor_type,
            actor_id=actor_id,
            org_id=org,
            payload={"retryable": True},
        )
        await _notify_staff(
            db,
            f,
            "Provisionamento falhou",
            f"{f.handler_key} #{f.id}: {f.last_error or ''}"[:300],
        )
    else:
        f.status = FulfillmentStatus.MANUAL_REVIEW.value
        f.current_step = result.step
        f.last_error = (result.error or "")[:500] or None
        f.retryable = False
        await log_audit(
            db,
            entity="fulfillment",
            entity_id=str(f.id),
            action="fulfillment_manual_review",
            actor_type=actor_type,
            actor_id=actor_id,
            org_id=org,
        )
        await _notify_staff(
            db,
            f,
            "Provisionamento precisa de revisão",
            f"{f.handler_key} #{f.id}: {f.last_error or ''}"[:300],
        )
    await db.flush()


async def _notify_staff(db, f: Fulfillment, title: str, body: str) -> None:
    try:
        from app.models.notification import Notification
        from app.repositories.notification_repository import NotificationRepository
        from app.repositories.user_repository import UserRepository

        users = await UserRepository(db).list_by_org_id(f.org_id)
        repo = NotificationRepository(db)
        for user in users:
            repo.add(
                Notification(
                    user_id=user.id,
                    customer_user_id=None,
                    channel="in_app",
                    title=title,
                    body=body,
                )
            )
        await repo.flush()
    except Exception:  # noqa: BLE001 (notificação nunca quebra fulfillment)
        logger.exception("staff notify failed fulfillment %s", f.id)


async def run_fulfillment(
    db, fulfillment_id: int, *, actor_type: str = "system", actor_id: str | None = None
) -> Fulfillment | None:
    """Executa o handler e aplica o resultado (idempotente por estado)."""
    f = await db.get(Fulfillment, fulfillment_id)
    if not f or f.status in (
        FulfillmentStatus.ACTIVE.value,
        FulfillmentStatus.CANCELLED.value,
    ):
        return f
    invoice = await db.get(Invoice, f.invoice_id) if f.invoice_id else None
    sub = await db.get(Subscription, f.subscription_id) if f.subscription_id else None
    product = await db.get(Product, f.product_id) if f.product_id else None
    plan = None
    if f.contract_item_id:
        item = await db.get(ContractItem, f.contract_item_id)
        if item and item.price_plan_id:
            plan = await db.get(PricePlan, item.price_plan_id)
    customer = await db.get(Customer, f.customer_id)
    f.status = FulfillmentStatus.PROVISIONING.value
    if f.started_at is None:
        f.started_at = utc_now()
    await log_audit(
        db,
        entity="fulfillment",
        entity_id=str(f.id),
        action="fulfillment_started",
        actor_type=actor_type,
        actor_id=actor_id,
        org_id=f.org_id,
    )
    await db.flush()
    ctx = ProvisionContext(
        db=db,
        fulfillment=f,
        invoice=invoice,
        subscription=sub,
        product=product,
        price_plan=plan,
        customer=customer,
        org_id=f.org_id,
        actor_type=actor_type,
        actor_id=actor_id,
    )
    try:
        result = await get_provisioner(f.handler_key).provision(ctx)
    except Exception as e:  # noqa: BLE001 (handler nunca derruba a facade)
        from app.modules.fulfillment.registry import ProvisionResult

        logger.exception("provisioner crashed fulfillment %s", f.id)
        result = ProvisionResult(
            ok=False,
            retryable=True,
            error=f"handler crash: {e}"[:500],
            step="provision",
        )
    await _apply_result(db, f, result, actor_type=actor_type, actor_id=actor_id)
    return f


async def after_payment(
    db, invoice_id: int, *, actor_type: str = "system", actor_id: str | None = None
) -> list[Fulfillment]:
    """Ponto único pós-pagamento: contrato → item → fulfillment → execução."""
    invoice = await db.get(Invoice, invoice_id)
    if not invoice:
        return []
    product, plan, sub = await resolve_product_for_invoice(db, invoice)
    if product is None:
        logger.info(
            "fulfillment: invoice %s sem produto rastreável; nada a fazer", invoice_id
        )
        return []
    contract = await ensure_contract_for_purchase(
        db,
        customer_id=invoice.customer_id,
        org_id=await invoice_org(db, invoice),
        subscription_id=sub.id if sub else None,
        currency=invoice.currency,
        actor_type=actor_type,
        actor_id=actor_id,
    )
    # Adoção: item já criado pelo fluxo mail para esta invoice?
    adopted_item = None
    if sub is None:
        adopted = await _adopt_mail_item(db, invoice)
        if adopted:
            adopted_item, _, _ = adopted
    if adopted_item is not None and adopted_item.contract_id != contract.id:
        contract = await db.get(Contract, adopted_item.contract_id)
    if adopted_item is not None:
        item = adopted_item
    else:
        item = await ensure_contract_item_for_purchase(
            db,
            contract=contract,
            product_id=product.id,
            price_plan_id=plan.id if plan else None,
            subscription_id=sub.id if sub else None,
            quantity=1,
            unit_amount=(
                float(plan.amount) if plan and plan.amount is not None else None
            ),
            description=(plan.name if plan else product.name),
            actor_type=actor_type,
            actor_id=actor_id,
        )
    f = await ensure_fulfillment_for_item(
        db,
        item=item,
        contract=contract,
        invoice=invoice,
        product=product,
        actor_type=actor_type,
        actor_id=actor_id,
    )
    await run_fulfillment(db, f.id, actor_type=actor_type, actor_id=actor_id)
    return [f]


async def invoice_org(db, invoice: Invoice) -> str:
    """Org real do cliente (moeda nunca inferida por domínio — P0 §2)."""
    cust = await db.get(Customer, invoice.customer_id)
    return cust.org_id if cust and cust.org_id else "innexar"


async def process_due_fulfillments(db) -> dict:
    """Cron: QUEUED + retries vencidos + PROVISIONING obsoleto (morte de worker)."""
    now = datetime.now(UTC)
    stale = now - timedelta(minutes=STALE_PROVISIONING_MINUTES)
    rows = (
        (
            await db.execute(
                select(Fulfillment)
                .where(
                    (Fulfillment.status == FulfillmentStatus.QUEUED.value)
                    | (
                        (Fulfillment.status == FulfillmentStatus.FAILED.value)
                        & (Fulfillment.retryable.is_(True))
                        & (
                            Fulfillment.next_retry_at.is_(None)
                            | (Fulfillment.next_retry_at <= now)
                        )
                    )
                    | (
                        (Fulfillment.status == FulfillmentStatus.PROVISIONING.value)
                        & (Fulfillment.updated_at <= stale)
                    )
                )
                .order_by(Fulfillment.id)
                .limit(50)
            )
        )
        .scalars()
        .all()
    )
    done, failed = 0, 0
    for f in rows:
        try:
            out = await run_fulfillment(db, f.id, actor_type="cron")
            if out and out.status == FulfillmentStatus.FAILED.value:
                failed += 1
            else:
                done += 1
            await db.commit()
        except Exception:  # noqa: BLE001 (um item nunca trava o lote)
            logger.exception("cron fulfillment %s failed", f.id)
            await db.rollback()
            failed += 1
    return {"processed": done, "failed": failed}


async def retry_fulfillment(
    db, fulfillment_id: int, *, actor_type: str, actor_id: str | None
) -> Fulfillment | None:
    """Retry operacional: re-enfileira (nunca executa provider no browser)."""
    f = await db.get(Fulfillment, fulfillment_id)
    if not f:
        return None
    if f.status not in (
        FulfillmentStatus.FAILED.value,
        FulfillmentStatus.WAITING_INPUT.value,
        FulfillmentStatus.MANUAL_REVIEW.value,
        FulfillmentStatus.QUEUED.value,
    ):
        return f
    f.retry_count = (f.retry_count or 0) + 1
    f.next_retry_at = None
    f.last_error = None
    f.status = FulfillmentStatus.QUEUED.value
    f.current_step = "queued"
    await log_audit(
        db,
        entity="fulfillment",
        entity_id=str(f.id),
        action="fulfillment_retry",
        actor_type=actor_type,
        actor_id=actor_id,
        org_id=f.org_id,
        payload={"retry_count": f.retry_count},
    )
    await db.flush()
    await run_fulfillment(db, f.id, actor_type=actor_type, actor_id=actor_id)
    return f


async def resolve_fulfillment(
    db, fulfillment_id: int, *, note: str | None, actor_type: str, actor_id: str | None
):
    f = await db.get(Fulfillment, fulfillment_id)
    if not f:
        return None
    f.status = FulfillmentStatus.ACTIVE.value
    f.current_step = "manual_resolved"
    f.progress = 100
    f.retryable = False
    f.completed_at = utc_now()
    await log_audit(
        db,
        entity="fulfillment",
        entity_id=str(f.id),
        action="manual_override",
        actor_type=actor_type,
        actor_id=actor_id,
        org_id=f.org_id,
        payload={"note": (note or "")[:300]},
    )
    await db.flush()
    return f


async def cancel_fulfillment(
    db, fulfillment_id: int, *, note: str | None, actor_type: str, actor_id: str | None
):
    f = await db.get(Fulfillment, fulfillment_id)
    if not f or f.status == FulfillmentStatus.ACTIVE.value:
        return f
    f.status = FulfillmentStatus.CANCELLED.value
    f.current_step = "cancelled"
    f.retryable = False
    await log_audit(
        db,
        entity="fulfillment",
        entity_id=str(f.id),
        action="fulfillment_cancelled",
        actor_type=actor_type,
        actor_id=actor_id,
        org_id=f.org_id,
        payload={"note": (note or "")[:300]},
    )
    await db.flush()
    return f


async def sync_service_event(
    db,
    *,
    contract_item_id: int | None,
    service_id: int | None,
    suspended: bool,
    actor_type: str = "system",
    actor_id: str | None = None,
) -> int:
    """Espelha suspensão/reativação de serviço no fulfillment (lifecycle)."""
    if contract_item_id is None and service_id is None:
        return 0
    q = select(Fulfillment).where(
        Fulfillment.status.in_(
            [FulfillmentStatus.ACTIVE.value, FulfillmentStatus.SUSPENDED.value]
        )
    )
    if contract_item_id is not None:
        q = q.where(Fulfillment.contract_item_id == contract_item_id)
    else:
        q = q.where(Fulfillment.service_id == service_id)
    rows = (await db.execute(q)).scalars().all()
    n = 0
    for f in rows:
        target = (
            FulfillmentStatus.SUSPENDED.value
            if suspended
            else FulfillmentStatus.ACTIVE.value
        )
        if f.status == target:
            continue
        f.status = target
        f.current_step = "suspended" if suspended else "reactivated"
        await log_audit(
            db,
            entity="fulfillment",
            entity_id=str(f.id),
            action=(
                "fulfillment_suspended" if suspended else "fulfillment_reactivated"
            ),
            actor_type=actor_type,
            actor_id=actor_id,
            org_id=f.org_id,
        )
        n += 1
    if n:
        await db.flush()
    return n
