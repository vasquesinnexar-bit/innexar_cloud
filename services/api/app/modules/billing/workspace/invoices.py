"""Workspace billing: invoices CRUD, payment-link, pay-bricks, mark-paid, process-overdue, generate-recurring."""

from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.rbac import RequirePermission
from app.core.router_org import router_org_list_filter
from app.models.customer import Customer
from app.models.user import User
from app.modules.billing.dependencies import (
    get_billing_workspace_service,
    require_billing_enabled,
)
from app.modules.billing.enums import InvoiceStatus
from app.modules.billing.models import Invoice, Subscription
from app.modules.billing.overdue import (
    process_overdue_invoices,
    reactivate_subscription_after_payment,
)
from app.modules.billing.schemas import (
    GenerateRecurringResponse,
    InvoiceCreate,
    InvoiceResponse,
    InvoiceUpdate,
    MarkPaidResponse,
    PayBricksRequest,
    PaymentLinkResponse,
    PayResponse,
    ProcessOverdueResponse,
)
from app.modules.billing.service import (
    _get_payment_provider,
    create_payment_attempt,
    generate_recurring_invoices,
    mark_invoice_paid,
    send_invoice_reminders,
)
from app.modules.billing.workspace_service import BillingWorkspaceService
from app.modules.mail.models import Service
from app.modules.notifications.service import create_notification_and_maybe_send_email
from app.providers.payments.mercadopago import MercadoPagoProvider

router = APIRouter()


async def _run_provisioning_after_payment(
    invoice_id: int, source: str | None = "workspace"
) -> None:
    """Background: P0 — contratação formal + fulfillment (cobre mail+hestia)."""
    from app.modules.fulfillment.tasks import (
        fulfillment_after_payment as _fulfillment_after_payment,
    )

    await _fulfillment_after_payment(invoice_id, source=source)


def _invoice_to_response(
    inv: Invoice, customer: Customer | None = None
) -> InvoiceResponse:
    return InvoiceResponse(
        id=inv.id,
        customer_id=inv.customer_id,
        subscription_id=inv.subscription_id,
        status=inv.status,
        due_date=inv.due_date,
        paid_at=inv.paid_at,
        total=float(inv.total),
        currency=inv.currency,
        line_items=inv.line_items,
        external_id=inv.external_id,
        created_at=inv.created_at,
        customer_name=customer.name if customer else None,
        org_id=customer.org_id if customer else None,
    )


async def _load_customer(db: AsyncSession, customer_id: int) -> Customer | None:
    r = await db.execute(select(Customer).where(Customer.id == customer_id).limit(1))
    return r.scalar_one_or_none()


async def _get_staff_invoice(
    service: BillingWorkspaceService,
    db: AsyncSession,
    invoice_id: int,
    org_id: str | None,
) -> tuple[Invoice | None, Customer | None]:
    org_filter = router_org_list_filter(org_id)
    inv = await service.get_invoice(invoice_id, org_filter)
    if not inv:
        return None, None
    customer = await _load_customer(db, inv.customer_id)
    return inv, customer


@router.get("/invoices", response_model=list[InvoiceResponse])
async def list_invoices(
    service: Annotated[BillingWorkspaceService, Depends(get_billing_workspace_service)],
    current: Annotated[User, Depends(RequirePermission("billing:read"))],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
    customer_id: int | None = None,
    status: str | None = None,
):
    rows = await service.list_invoices(
        router_org_list_filter(org_id), customer_id=customer_id, status=status
    )
    return [_invoice_to_response(inv, customer) for inv, customer in rows]


@router.post("/invoices", response_model=InvoiceResponse, status_code=201)
async def create_invoice(
    body: InvoiceCreate,
    service: Annotated[BillingWorkspaceService, Depends(get_billing_workspace_service)],
    _: Annotated[User, Depends(RequirePermission("billing:write"))],
    __: Annotated[None, Depends(require_billing_enabled)],
):
    inv = await service.create_invoice(body)
    return _invoice_to_response(inv)


@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: int,
    service: Annotated[BillingWorkspaceService, Depends(get_billing_workspace_service)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(RequirePermission("billing:read"))],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
):
    inv, customer = await _get_staff_invoice(service, db, invoice_id, org_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return _invoice_to_response(inv, customer)


@router.patch("/invoices/{invoice_id}", response_model=InvoiceResponse)
async def update_invoice(
    invoice_id: int,
    body: InvoiceUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[BillingWorkspaceService, Depends(get_billing_workspace_service)],
    _: Annotated[User, Depends(RequirePermission("billing:write"))],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
):
    """Update invoice fields (status, due_date, total)."""
    inv, customer = await _get_staff_invoice(service, db, invoice_id, org_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if body.status is not None:
        inv.status = body.status
    if body.due_date is not None:
        inv.due_date = body.due_date
    if body.total is not None:
        inv.total = body.total
    await db.flush()
    return _invoice_to_response(inv, customer)


@router.delete("/invoices/{invoice_id}", status_code=204)
async def delete_invoice(
    invoice_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[BillingWorkspaceService, Depends(get_billing_workspace_service)],
    _: Annotated[User, Depends(RequirePermission("billing:write"))],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
):
    """Delete invoice and its payment attempts."""
    from app.modules.billing.models import PaymentAttempt

    inv, _ = await _get_staff_invoice(service, db, invoice_id, org_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if inv.status == InvoiceStatus.PAID.value:
        raise HTTPException(status_code=400, detail="Cannot delete a paid invoice")
    await db.execute(
        select(PaymentAttempt).where(PaymentAttempt.invoice_id == invoice_id)
    )
    from sqlalchemy import delete as sa_delete

    await db.execute(
        sa_delete(PaymentAttempt).where(PaymentAttempt.invoice_id == invoice_id)
    )
    await db.delete(inv)
    await db.flush()


@router.post("/invoices/{invoice_id}/payment-link", response_model=PaymentLinkResponse)
async def invoice_payment_link(
    invoice_id: int,
    success_url: str,
    cancel_url: str,
    coupon_code: str | None = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
    service: Annotated[
        BillingWorkspaceService, Depends(get_billing_workspace_service)
    ] = None,
    _: Annotated[User, Depends(RequirePermission("billing:write"))] = None,
    __: Annotated[None, Depends(require_billing_enabled)] = None,
    org_id: str | None = None,
) -> PaymentLinkResponse:
    """Create payment link. Optional coupon_code (Stripe only): promotion code or coupon id (co_xxx)."""
    inv, _ = await _get_staff_invoice(service, db, invoice_id, org_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    try:
        res = await create_payment_attempt(
            db, invoice_id, success_url, cancel_url, coupon_code=coupon_code
        )
        return PaymentLinkResponse(payment_url=res.payment_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/invoices/{invoice_id}/pay-bricks", response_model=PayResponse)
async def invoice_pay_bricks(
    invoice_id: int,
    body: PayBricksRequest,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[BillingWorkspaceService, Depends(get_billing_workspace_service)],
    current: Annotated[User, Depends(RequirePermission("billing:write"))],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
):
    """Pay invoice with Bricks (card/Pix). Staff initiates; payer_email is the customer email."""
    inv, cust = await _get_staff_invoice(service, db, invoice_id, org_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if inv.status == InvoiceStatus.PAID.value:
        raise HTTPException(status_code=400, detail="Invoice already paid")

    invoice_org = cust.org_id if cust else "innexar"
    currency = (inv.currency or "USD").upper()
    provider = await _get_payment_provider(db, inv.customer_id, invoice_org, currency)
    if not isinstance(provider, MercadoPagoProvider):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bricks is only available for Mercado Pago (BRL)",
        )
    payer_email = (body.payer_email or "").strip().lower()
    if not payer_email:
        raise HTTPException(status_code=400, detail="payer_email is required")

    cust_with_users = (
        await db.execute(
            select(Customer)
            .where(Customer.id == inv.customer_id)
            .options(selectinload(Customer.users))
        )
    ).scalar_one_or_none()
    if cust_with_users and not cust_with_users.mp_customer_id:
        try:
            mp_customer = provider.create_or_get_customer(
                email=payer_email, name=body.customer_name or cust_with_users.name
            )
            cust_with_users.mp_customer_id = str(mp_customer.get("id", ""))
            await db.flush()
        except ValueError:
            pass

    desc = f"Invoice #{inv.id}"
    if inv.line_items and isinstance(inv.line_items, list) and inv.line_items:
        first = inv.line_items[0]
        if isinstance(first, dict):
            desc = str(first.get("description", desc))
    try:
        payment = provider.create_payment(
            token=body.token,
            amount=float(inv.total),
            installments=body.installments,
            payment_method_id=body.payment_method_id,
            issuer_id=body.issuer_id,
            payer_email=payer_email,
            description=desc,
            external_reference=str(inv.id),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    payment_status = (payment.get("status") or "").lower()
    payment_id = str(payment.get("id", ""))

    inv.external_id = payment_id
    if payment_status == "approved":
        inv.status = InvoiceStatus.PAID.value
        inv.paid_at = datetime.now(timezone.utc)  # noqa: UP017
        if inv.subscription_id:
            sub_r = await db.execute(
                select(Subscription)
                .where(Subscription.id == inv.subscription_id)
                .limit(1)
            )
            sub = sub_r.scalar_one_or_none()
            if sub:
                await reactivate_subscription_after_payment(
                    db, sub.id, org_id=invoice_org
                )
        await db.flush()
        background_tasks.add_task(
            _run_provisioning_after_payment, inv.id, source="workspace"
        )
        if cust_with_users and cust_with_users.users:
            for cu in cust_with_users.users:
                await create_notification_and_maybe_send_email(
                    db,
                    background_tasks,
                    customer_user_id=cu.id,
                    channel="in_app,email",
                    title="Pagamento confirmado",
                    body=f"A fatura #{inv.id} foi paga.",
                    recipient_email=cu.email,
                    org_id=invoice_org,
                )
    else:
        inv.status = InvoiceStatus.PENDING.value
        await db.flush()

    error_message = None
    if payment_status == "rejected":
        status_detail = payment.get("status_detail", "")
        error_messages = {
            "cc_rejected_bad_filled_card_number": "Número do cartão incorreto.",
            "cc_rejected_duplicated_payment": "Pagamento duplicado detectado.",
            "cc_rejected_insufficient_amount": "Saldo insuficiente.",
            "cc_rejected_other_reason": "Pagamento recusado. Tente outro cartão.",
        }
        error_message = error_messages.get(
            status_detail, "Pagamento recusado. Tente novamente."
        )

    poi = payment.get("point_of_interaction", {}) or {}
    tx_data = poi.get("transaction_data", {}) or {}
    return PayResponse(
        payment_url="",
        attempt_id=0,
        payment_status=payment_status,
        payment_id=payment_id,
        error_message=error_message,
        qr_code_base64=tx_data.get("qr_code_base64"),
        qr_code=tx_data.get("qr_code"),
        ticket_url=tx_data.get("ticket_url"),
    )


@router.post("/invoices/{invoice_id}/mark-paid", response_model=MarkPaidResponse)
async def invoice_mark_paid(
    invoice_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[BillingWorkspaceService, Depends(get_billing_workspace_service)],
    background_tasks: BackgroundTasks,
    current: Annotated[User, Depends(RequirePermission("billing:write"))],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
    reason: str | None = None,
) -> MarkPaidResponse:
    """Mark invoice as paid (manual override, staff only, reason auditado)."""
    inv, cust = await _get_staff_invoice(service, db, invoice_id, org_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    invoice_org = cust.org_id if cust else "innexar"
    paid_id = await mark_invoice_paid(
        db,
        invoice_id,
        actor_type="staff",
        actor_id=str(current.id),
        org_id=invoice_org,
        reason=(reason or "").strip()[:300],
    )
    if paid_id is None:
        raise HTTPException(
            status_code=400,
            detail="Invoice not found or already paid",
        )
    background_tasks.add_task(
        _run_provisioning_after_payment, paid_id, source="workspace"
    )
    return MarkPaidResponse(ok=True, invoice_id=paid_id)


@router.post("/process-overdue", response_model=ProcessOverdueResponse)
async def billing_process_overdue(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(RequirePermission("billing:write"))],
) -> ProcessOverdueResponse:
    """Run overdue processor: suspend Hestia and set subscriptions SUSPENDED. Call from cron."""
    org_id = current.org_id or "innexar"
    count = await process_overdue_invoices(db, org_id=org_id)
    return ProcessOverdueResponse(processed=count)


@router.post("/generate-recurring-invoices", response_model=GenerateRecurringResponse)
async def billing_generate_recurring_invoices(
    db: Annotated[AsyncSession, Depends(get_db)],
    background_tasks: BackgroundTasks,
    current: Annotated[User, Depends(RequirePermission("billing:write"))],
    __: Annotated[None, Depends(require_billing_enabled)],
    days_before_due: int = 0,
    send_reminders: bool = False,
) -> GenerateRecurringResponse:
    """Generate next invoice for active subscriptions whose next_due_date is due.
    If send_reminders=True, also send email + in-portal reminder for PENDING invoices due in 2 days.
    """
    org_id = current.org_id or "innexar"
    count = await generate_recurring_invoices(
        db, org_id=org_id, days_before_due=days_before_due
    )
    reminded = 0
    if send_reminders:
        reminded = await send_invoice_reminders(
            db, background_tasks, org_id=org_id, days_ahead=2
        )
    return GenerateRecurringResponse(generated=count, reminders_sent=reminded)


@router.get("/overview")
async def billing_overview(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(RequirePermission("billing:read"))],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
):
    """Resumo financeiro admin (Fase 3): abertas, atrasadas, pagas no mês, suspensos."""
    from datetime import UTC, datetime

    from sqlalchemy import func, select

    from app.core.router_org import router_org_list_filter
    from app.modules.billing.enums import InvoiceStatus
    from app.modules.billing.models import Invoice, PaymentAttempt

    org_filter = router_org_list_filter(org_id)
    inv_q = select(Invoice)
    if org_filter is not None:
        inv_q = inv_q.join(Customer, Customer.id == Invoice.customer_id).where(
            Customer.org_id == org_filter
        )
    invs = (await db.execute(inv_q)).scalars().all()
    now = datetime.now(UTC)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    open_statuses = {
        InvoiceStatus.PENDING.value,
        InvoiceStatus.PAST_DUE.value,
        InvoiceStatus.FAILED.value,
    }
    open_invs = [i for i in invs if i.status in open_statuses]
    past_due = [i for i in invs if i.status == InvoiceStatus.PAST_DUE.value]
    paid_month = [
        i
        for i in invs
        if i.status == InvoiceStatus.PAID.value
        and i.paid_at
        and i.paid_at >= month_start
    ]
    failed_7d = (
        await db.execute(
            select(func.count())
            .select_from(PaymentAttempt)
            .where(
                PaymentAttempt.status == "failed",
                PaymentAttempt.created_at >= now - timedelta(days=7),
            )
        )
    ).scalar_one()
    suspended = (
        await db.execute(
            select(func.count())
            .select_from(Service)
            .where(Service.status == "suspended")
        )
    ).scalar_one()
    return {
        "open_count": len(open_invs),
        "open_total": round(sum(float(i.total) for i in open_invs), 2),
        "past_due_count": len(past_due),
        "paid_this_month": round(sum(float(i.total) for i in paid_month), 2),
        "paid_this_month_count": len(paid_month),
        "failed_payments_7d": failed_7d,
        "suspended_services": suspended,
    }
