"""Portal billing: list/get invoices, pay, download HTML. Uses BillingRepository; delegates pay to billing service."""

import logging
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.debug_log import debug_log
from app.models.customer_user import CustomerUser
from app.modules.billing.enums import InvoiceStatus
from app.modules.billing.models import Invoice
from app.modules.billing.overdue import reactivate_subscription_after_payment
from app.modules.billing.schemas import InvoiceResponse, PayRequest, PayResponse
from app.modules.billing.schemas_contracts import ContractItemResponse, ContractResponse
from app.modules.billing.service import _get_payment_provider, create_payment_attempt
from app.modules.notifications.service import create_notification_and_maybe_send_email
from app.providers.payments.mercadopago import MercadoPagoProvider
from app.repositories.billing_repository import BillingRepository
from app.repositories.customer_repository import CustomerRepository

if TYPE_CHECKING:
    from fastapi import BackgroundTasks

from app.core.org import ORG_INNEXAR_US

logger = logging.getLogger(__name__)


async def _customer_org_id(customer_repo: CustomerRepository, customer_id: int) -> str:
    customer = await customer_repo.get_by_id_with_users(customer_id, org_id=None)
    if customer and customer.org_id:
        return str(customer.org_id)
    return ORG_INNEXAR_US


def _invoice_to_response(inv: Invoice) -> InvoiceResponse:
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
    )


class BillingPortalService:
    """Portal billing: list/get invoices, pay, download. Uses BillingRepository and CustomerRepository."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._repo = BillingRepository(db)
        self._customer_repo = CustomerRepository(db)

    async def list_my_invoices(self, customer_id: int) -> list[InvoiceResponse]:
        """List invoices for customer, newest first (org do próprio cliente)."""
        org_id = await _customer_org_id(self._customer_repo, customer_id)
        invoices = await self._repo.list_invoices(
            customer_id=customer_id, org_id=org_id, order_desc=True
        )
        return [_invoice_to_response(inv) for inv in invoices]

    async def list_my_contracts(self, customer_id: int) -> list[ContractResponse]:
        """Contratos do cliente (somente leitura; escopo por customer)."""
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload

        from app.modules.billing.models import Contract

        rows = (
            (
                await self._db.execute(
                    select(Contract)
                    .options(selectinload(Contract.items))
                    .where(Contract.customer_id == customer_id)
                    .order_by(Contract.id.desc())
                )
            )
            .scalars()
            .all()
        )
        return [await self._contract_to_response(c) for c in rows]

    async def get_my_contract(
        self, contract_id: int, customer_id: int
    ) -> ContractResponse:
        """Detalhe do contrato se pertencer ao cliente (404 caso contrário)."""
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload

        from app.modules.billing.models import Contract

        c = (
            await self._db.execute(
                select(Contract)
                .options(selectinload(Contract.items))
                .where(
                    Contract.id == contract_id,
                    Contract.customer_id == customer_id,
                )
            )
        ).scalar_one_or_none()
        if not c:
            raise HTTPException(status_code=404, detail="Contract not found")
        return await self._contract_to_response(c)

    async def _contract_to_response(self, c) -> ContractResponse:
        from app.modules.billing.models import PricePlan, Product

        items = []
        for i in c.items or []:
            pname, plan_name = None, None
            if i.product_id:
                p = await self._db.get(Product, i.product_id)
                pname = p.name if p else None
            if i.price_plan_id:
                pl = await self._db.get(PricePlan, i.price_plan_id)
                plan_name = pl.name if pl else None
            items.append(
                ContractItemResponse(
                    id=i.id,
                    product_id=i.product_id,
                    price_plan_id=i.price_plan_id,
                    subscription_id=i.subscription_id,
                    description=i.description,
                    quantity=i.quantity,
                    unit_amount=(
                        float(i.unit_amount) if i.unit_amount is not None else None
                    ),
                    product_name=pname,
                    plan_name=plan_name,
                )
            )
        return ContractResponse(
            id=c.id,
            customer_id=c.customer_id,
            org_id=str(c.org_id),
            status=str(c.status),
            currency=c.currency,
            billing_provider=c.billing_provider,
            notes=c.notes,
            starts_at=c.starts_at,
            ends_at=c.ends_at,
            billing_interval=c.billing_interval,
            billing_day=c.billing_day,
            due_days=c.due_days,
            timezone=c.timezone,
            credit_balance=float(c.credit_balance or 0),
            created_at=c.created_at,
            items=items,
        )

    async def get_my_invoice(
        self, invoice_id: int, customer_id: int
    ) -> InvoiceResponse:
        """Get invoice by id if owned by customer. Raises 404 if not found."""
        inv = await self._repo.get_invoice_by_id_and_customer(invoice_id, customer_id)
        if not inv:
            raise HTTPException(status_code=404, detail="Invoice not found")
        return _invoice_to_response(inv)

    async def pay_invoice(
        self,
        invoice_id: int,
        current: CustomerUser,
        payload: PayRequest,
        background_tasks: "BackgroundTasks",
    ) -> PayResponse:
        """Pay invoice: Bricks (token) or Checkout Pro (payment_url). Raises 404/400/503."""
        inv = await self._repo.get_invoice_by_id_and_customer(
            invoice_id, current.customer_id
        )
        debug_log(
            "portal_service.pay_invoice",
            "Invoice fetch",
            {
                "invoice_id": invoice_id,
                "found": inv is not None,
                "status": getattr(inv, "status", None),
            },
            "B",
        )
        if not inv:
            raise HTTPException(status_code=404, detail="Invoice not found")
        if inv.status == InvoiceStatus.PAID.value:
            raise HTTPException(status_code=400, detail="Invoice already paid")

        if payload.payment_method_id:
            return await self._pay_invoice_bricks(
                inv, current, payload, background_tasks
            )

        base = (
            (getattr(settings, "PORTAL_URL", None) or "").strip()
            or (getattr(settings, "FRONTEND_URL", None) or "").strip()
            or "https://portal.innexar.com.br"
        ).rstrip("/")
        success_url = (payload.success_url or "").strip() or f"{base}/payment/success"
        cancel_url = (payload.cancel_url or "").strip() or f"{base}/payment/cancel"
        debug_log(
            "portal_service.pay_invoice",
            "Before create_payment_attempt",
            {"base": base, "success_url": success_url[:80]},
            "C",
        )
        try:
            res = await create_payment_attempt(
                self._db,
                invoice_id=inv.id,
                success_url=success_url,
                cancel_url=cancel_url,
                customer_email=current.email,
                coupon_code=payload.coupon_code and payload.coupon_code.strip() or None,
            )
        except ValueError as e:
            detail = str(e)
            logger.warning("Portal pay invoice %s failed: %s", invoice_id, detail)
            if "403" in detail and (
                "PolicyAgent" in detail or "UNAUTHORIZED" in detail
            ):
                raise HTTPException(
                    status_code=503,
                    detail="Pagamento temporariamente indisponível. Verifique a configuração do Mercado Pago (token e permissões) no servidor.",
                ) from e
            raise HTTPException(status_code=400, detail=detail) from e

        attempt = await self._repo.get_latest_payment_attempt_by_invoice_id(invoice_id)
        return PayResponse(
            payment_url=res.payment_url, attempt_id=attempt.id if attempt else 0
        )

    async def _pay_invoice_bricks(
        self,
        inv: Invoice,
        current: CustomerUser,
        body: PayRequest,
        background_tasks: "BackgroundTasks",
    ) -> PayResponse:
        """Pay invoice with Bricks (Mercado Pago card/Pix token)."""
        currency = (inv.currency or "USD").upper()
        org_id = await _customer_org_id(self._customer_repo, inv.customer_id)
        provider = await _get_payment_provider(
            self._db, inv.customer_id, org_id, currency
        )
        if not isinstance(provider, MercadoPagoProvider):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bricks payment is only available for Mercado Pago (BRL)",
            )
        payer_email = (body.payer_email or current.email or "").lower().strip()
        if not payer_email:
            raise HTTPException(
                status_code=400, detail="payer_email or login email required"
            )

        cust = await self._customer_repo.get_by_id_with_users(inv.customer_id)
        if cust and not cust.mp_customer_id:
            try:
                mp_customer = provider.create_or_get_customer(
                    email=payer_email, name=body.customer_name or current.email
                )
                cust.mp_customer_id = str(mp_customer.get("id", ""))
                await self._db.flush()
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
            inv.paid_at = datetime.now(UTC)
            if inv.subscription_id:
                sub = await self._repo.get_subscription_by_id(inv.subscription_id)
                if sub:
                    await reactivate_subscription_after_payment(
                        self._db, sub.id, org_id=org_id
                    )
            await self._db.flush()

            from app.modules.fulfillment.tasks import (
                fulfillment_after_payment as _fulfillment_after_payment,
            )

            background_tasks.add_task(
                _fulfillment_after_payment, inv.id, source="portal"
            )

            await create_notification_and_maybe_send_email(
                self._db,
                background_tasks,
                customer_user_id=current.id,
                channel="in_app,email",
                title="Pagamento confirmado",
                body=f"A fatura #{inv.id} foi paga.",
                recipient_email=current.email,
                org_id=org_id,
            )
        else:
            inv.status = InvoiceStatus.PENDING.value
            await self._db.flush()

        error_message = None
        if payment_status == "rejected":
            status_detail = payment.get("status_detail", "")
            error_messages = {
                "cc_rejected_bad_filled_card_number": "Número do cartão incorreto.",
                "cc_rejected_bad_filled_date": "Data de validade incorreta.",
                "cc_rejected_bad_filled_security_code": "Código de segurança incorreto.",
                "cc_rejected_duplicated_payment": "Pagamento duplicado detectado.",
                "cc_rejected_insufficient_amount": "Saldo insuficiente.",
                "cc_rejected_other_reason": "Pagamento recusado. Tente outro cartão.",
            }
            error_message = error_messages.get(
                status_detail,
                "Pagamento recusado. Verifique os dados e tente novamente.",
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

    async def get_invoice_download_html(self, invoice_id: int, customer_id: int) -> str:
        """Return print-friendly HTML for invoice. Raises 404 if not found."""
        inv = await self._repo.get_invoice_by_id_and_customer(invoice_id, customer_id)
        if not inv:
            raise HTTPException(status_code=404, detail="Invoice not found")
        due = inv.due_date.strftime("%d/%m/%Y") if inv.due_date else ""
        paid = inv.paid_at.strftime("%d/%m/%Y") if inv.paid_at else ""
        return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Fatura #{inv.id}</title>
  <style>
    body {{ font-family: system-ui, sans-serif; max-width: 600px; margin: 2rem auto; padding: 1rem; color: #1e293b; }}
    h1 {{ font-size: 1.25rem; }}
    table {{ width: 100%; border-collapse: collapse; margin: 1rem 0; }}
    th, td {{ text-align: left; padding: 0.5rem; border-bottom: 1px solid #e2e8f0; }}
    .meta {{ color: #64748b; font-size: 0.875rem; }}
    @media print {{ body {{ margin: 0; }} }}
  </style>
</head>
<body>
  <h1>Fatura #{inv.id}</h1>
  <p class="meta">Cliente ID: {inv.customer_id}</p>
  <table>
    <tr><th>Status</th><td>{inv.status}</td></tr>
    <tr><th>Vencimento</th><td>{due}</td></tr>
    <tr><th>Pago em</th><td>{paid or "—"}</td></tr>
    <tr><th>Total</th><td><strong>{inv.currency} {float(inv.total):,.2f}</strong></td></tr>
  </table>
  <p class="meta">Para salvar como PDF: use o menu do navegador (Ctrl+P ou Cmd+P) e escolha "Salvar como PDF".</p>
</body>
</html>"""
