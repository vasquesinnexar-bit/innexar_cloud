"""Portal billing routes: list invoices, pay, download (print-friendly HTML)."""

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from fastapi.responses import HTMLResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_customer import get_current_customer
from app.core.database import get_db
from app.models.customer_user import CustomerUser
from app.modules.billing import capabilities
from app.modules.billing._provider import resolve_provider_name
from app.modules.billing.dependencies import require_billing_enabled
from app.modules.billing.pay_methods import (
    PayMethodError,
    create_boleto_charge,
    create_pix_charge,
)
from app.modules.billing.portal_service import BillingPortalService
from app.modules.billing.schemas import InvoiceResponse, PayRequest, PayResponse
from app.modules.billing.schemas_contracts import ContractResponse

router = APIRouter(tags=["portal-billing"])
limiter = Limiter(key_func=get_remote_address)


async def _parse_pay_body(request: Request) -> PayRequest:
    """Parse optional body so POST with empty or missing body still works (avoids 422)."""
    try:
        raw = await request.body()
        if not raw or not raw.strip():
            return PayRequest()
        return PayRequest.model_validate_json(raw)
    except Exception:
        return PayRequest()


def get_billing_portal_service(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BillingPortalService:
    return BillingPortalService(db)


@router.get("/invoices", response_model=list[InvoiceResponse])
async def list_my_invoices(
    current: Annotated[CustomerUser, Depends(get_current_customer)],
    _: Annotated[None, Depends(require_billing_enabled)],
    service: Annotated[BillingPortalService, Depends(get_billing_portal_service)],
):
    """List invoices for the current customer."""
    return await service.list_my_invoices(current.customer_id)


@router.get("/contracts", response_model=list[ContractResponse])
async def list_my_contracts(
    current: Annotated[CustomerUser, Depends(get_current_customer)],
    _: Annotated[None, Depends(require_billing_enabled)],
    service: Annotated[BillingPortalService, Depends(get_billing_portal_service)],
):
    """List contracts for the current customer (read-only)."""
    return await service.list_my_contracts(current.customer_id)


@router.get("/contracts/{contract_id}", response_model=ContractResponse)
async def get_my_contract(
    contract_id: int,
    current: Annotated[CustomerUser, Depends(get_current_customer)],
    _: Annotated[None, Depends(require_billing_enabled)],
    service: Annotated[BillingPortalService, Depends(get_billing_portal_service)],
):
    """Contract detail if owned by the current customer (read-only)."""
    return await service.get_my_contract(contract_id, current.customer_id)


@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
async def get_my_invoice(
    invoice_id: int,
    current: Annotated[CustomerUser, Depends(get_current_customer)],
    _: Annotated[None, Depends(require_billing_enabled)],
    service: Annotated[BillingPortalService, Depends(get_billing_portal_service)],
):
    """Get a single invoice by id (customer-scoped)."""
    return await service.get_my_invoice(invoice_id, current.customer_id)


@router.post("/invoices/{invoice_id}/pay", response_model=PayResponse)
async def pay_invoice(
    invoice_id: int,
    payload: Annotated[PayRequest, Depends(_parse_pay_body)],
    background_tasks: BackgroundTasks,
    current: Annotated[CustomerUser, Depends(get_current_customer)],
    _: Annotated[None, Depends(require_billing_enabled)],
    service: Annotated[BillingPortalService, Depends(get_billing_portal_service)],
) -> PayResponse:
    """Pay invoice: Bricks (token) or Checkout Pro (payment_url)."""
    return await service.pay_invoice(invoice_id, current, payload, background_tasks)


@router.post("/invoices/{invoice_id}/pay-pix")
@limiter.limit("5/minute")
async def pay_invoice_pix(
    invoice_id: int,
    request: Request,
    current: Annotated[CustomerUser, Depends(get_current_customer)],
    _: Annotated[None, Depends(require_billing_enabled)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Gera cobrança PIX oficial (QR + copia e cola). Rate limited."""
    try:
        return await create_pix_charge(
            db, invoice_id=invoice_id, customer_id=current.customer_id
        )
    except PayMethodError as e:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, {"code": e.code, "message": e.detail}
        ) from e


@router.post("/invoices/{invoice_id}/pay-boleto")
@limiter.limit("5/minute")
async def pay_invoice_boleto(
    invoice_id: int,
    request: Request,
    current: Annotated[CustomerUser, Depends(get_current_customer)],
    _: Annotated[None, Depends(require_billing_enabled)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Gera boleto oficial (código + URL). Rate limited."""
    try:
        view = await create_boleto_charge(
            db, invoice_id=invoice_id, customer_id=current.customer_id
        )
    except PayMethodError as e:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, {"code": e.code, "message": e.detail}
        ) from e
    return view


@router.get("/invoices/{invoice_id}/payment-methods")
async def invoice_payment_methods(
    invoice_id: int,
    current: Annotated[CustomerUser, Depends(get_current_customer)],
    _: Annotated[None, Depends(require_billing_enabled)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Métodos compatíveis com provider/moeda da fatura (Portal só mostra estes)."""
    from sqlalchemy import select

    from app.models.customer import Customer
    from app.modules.billing.models import Invoice

    inv = (
        await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    ).scalar_one_or_none()
    if not inv or inv.customer_id != current.customer_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Fatura não encontrada")
    cust = (
        await db.execute(select(Customer).where(Customer.id == current.customer_id))
    ).scalar_one_or_none()
    provider = resolve_provider_name(
        cust.billing_provider if cust else None, inv.currency
    )
    return {
        "provider": provider,
        "methods": capabilities.available_methods(provider, inv.currency or "USD"),
    }


@router.get("/billing/summary")
async def billing_summary(
    current: Annotated[CustomerUser, Depends(get_current_customer)],
    _: Annotated[None, Depends(require_billing_enabled)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Resumo financeiro do cliente: próxima cobrança, abertas, recentes."""
    from sqlalchemy import select

    from app.modules.billing.models import Invoice, PaymentAttempt

    invs = (
        (
            await db.execute(
                select(Invoice)
                .where(Invoice.customer_id == current.customer_id)
                .order_by(Invoice.due_date)
            )
        )
        .scalars()
        .all()
    )
    open_statuses = {"pending", "past_due", "failed"}
    open_invs = [i for i in invs if i.status in open_statuses]
    nxt = min(open_invs, key=lambda i: i.due_date, default=None)
    attempts = (
        (
            await db.execute(
                select(PaymentAttempt)
                .where(PaymentAttempt.invoice_id.in_([i.id for i in invs] or [0]))
                .order_by(PaymentAttempt.id.desc())
                .limit(10)
            )
        )
        .scalars()
        .all()
    )
    return {
        "next_charge": (
            {
                "invoice_id": nxt.id,
                "due_date": nxt.due_date.isoformat(),
                "total": float(nxt.total),
                "currency": nxt.currency,
                "status": nxt.status,
            }
            if nxt
            else None
        ),
        "open_count": len(open_invs),
        "open_total": round(sum(float(i.total) for i in open_invs), 2),
        "recent_payments": [
            {
                "id": a.id,
                "invoice_id": a.invoice_id,
                "provider": a.provider,
                "method": a.method,
                "status": a.status,
                "amount": float(a.amount) if a.amount is not None else None,
                "paid_at": a.paid_at.isoformat() if a.paid_at else None,
            }
            for a in attempts
        ],
    }


@router.get("/invoices/{invoice_id}/payments")
async def invoice_payments(
    invoice_id: int,
    current: Annotated[CustomerUser, Depends(get_current_customer)],
    _: Annotated[None, Depends(require_billing_enabled)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Histórico da fatura: tentativas + reembolsos (sem payload interno)."""
    from sqlalchemy import select

    from app.modules.billing.models import Invoice, PaymentAttempt, Refund

    inv = (
        await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    ).scalar_one_or_none()
    if not inv or inv.customer_id != current.customer_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Fatura não encontrada")
    attempts = (
        (
            await db.execute(
                select(PaymentAttempt)
                .where(PaymentAttempt.invoice_id == inv.id)
                .order_by(PaymentAttempt.id.desc())
            )
        )
        .scalars()
        .all()
    )
    refunds = (
        (
            await db.execute(
                select(Refund)
                .where(Refund.invoice_id == inv.id)
                .order_by(Refund.id.desc())
            )
        )
        .scalars()
        .all()
    )
    return {
        "invoice": {
            "id": inv.id,
            "status": inv.status,
            "total": float(inv.total),
            "currency": inv.currency,
            "due_date": inv.due_date.isoformat(),
            "paid_at": inv.paid_at.isoformat() if inv.paid_at else None,
            "line_items": inv.line_items,
        },
        "attempts": [
            {
                "id": a.id,
                "provider": a.provider,
                "method": a.method,
                "status": a.status,
                "amount": float(a.amount) if a.amount is not None else None,
                "expires_at": a.expires_at.isoformat() if a.expires_at else None,
                "paid_at": a.paid_at.isoformat() if a.paid_at else None,
                "failure_code": a.failure_code,
            }
            for a in attempts
        ],
        "refunds": [
            {
                "id": r.id,
                "amount": float(r.amount),
                "status": r.status,
                "reason": r.reason,
            }
            for r in refunds
        ],
    }


@router.get("/invoices/{invoice_id}/download", response_class=HTMLResponse)
async def download_invoice_html(
    invoice_id: int,
    current: Annotated[CustomerUser, Depends(get_current_customer)],
    _: Annotated[None, Depends(require_billing_enabled)],
    service: Annotated[BillingPortalService, Depends(get_billing_portal_service)],
) -> HTMLResponse:
    """Return print-friendly HTML for invoice (Ctrl+P -> Save as PDF)."""
    html = await service.get_invoice_download_html(invoice_id, current.customer_id)
    return HTMLResponse(content=html)


@router.post("/billing-portal-link")
async def stripe_billing_portal_link(
    current: Annotated[CustomerUser, Depends(get_current_customer)],
    _: Annotated[None, Depends(require_billing_enabled)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Gera link do Stripe Customer Portal para o cliente gerenciar cartão/pagamento."""
    import os

    import stripe
    from fastapi import HTTPException
    from sqlalchemy import select

    # At least twice in a row so ruff is happy with the import.
    stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
    if not stripe.api_key:
        raise HTTPException(status_code=400, detail="Stripe not configured")

    # Lookup Stripe customer_id from subscriptions external_id or invoice metadata.
    # First try: search Stripe by email
    try:
        customers = stripe.Customer.list(email=current.email, limit=1)
        if customers.data:
            stripe_customer_id = customers.data[0].id
        else:
            # Try from subscription external_id
            from app.modules.billing.models import Subscription

            result = await db.execute(
                select(Subscription)
                .where(
                    Subscription.customer_id == current.customer_id,
                    Subscription.external_id.isnot(None),
                )
                .limit(1)
            )
            sub = result.scalar_one_or_none()
            if sub and sub.external_id:
                # external_id could be Stripe checkout session ID → look up customer from it
                session = stripe.checkout.Session.retrieve(sub.external_id)
                stripe_customer_id = session.customer
            else:
                raise HTTPException(status_code=404, detail="Stripe customer not found")

        portal = stripe.billing_portal.Session.create(
            customer=stripe_customer_id,
            return_url="https://panel.innexar.app/billing",
        )
        return {"url": portal.url, "customer_id": stripe_customer_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao criar portal: {e}") from e
