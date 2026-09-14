"""PIX/boleto via Mercado Pago + refunds (Fase 3). Usa resposta oficial do provider."""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import Customer
from app.modules.billing import capabilities
from app.modules.billing._provider import get_payment_provider, resolve_provider_name
from app.modules.billing.enums import AttemptStatus, InvoiceStatus, PaymentMethod
from app.modules.billing.models import Invoice, PaymentAttempt, Refund
from app.providers.payments.mercadopago import MercadoPagoProvider
from app.providers.payments.stripe import StripeProvider

logger = logging.getLogger(__name__)


class PayMethodError(Exception):
    def __init__(self, code: str, detail: str = ""):
        super().__init__(detail or code)
        self.code = code
        self.detail = detail or code


def _aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def _parse_mp_expiry(pay: dict) -> datetime | None:
    for key in ("date_of_expiration",):
        raw = pay.get(key)
        if raw:
            try:
                dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
                return dt if dt.tzinfo else dt.replace(tzinfo=UTC)
            except ValueError:
                continue
    return datetime.now(UTC) + timedelta(minutes=30)


async def _invoice_for_pay(
    db: AsyncSession, invoice_id: int, customer_id: int | None = None
) -> Invoice:
    inv = (
        await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    ).scalar_one_or_none()
    if not inv:
        raise PayMethodError("invoice_not_found", "Fatura não encontrada")
    if customer_id is not None and inv.customer_id != customer_id:
        raise PayMethodError("invoice_not_found", "Fatura não encontrada")
    if inv.status == InvoiceStatus.PAID.value:
        raise PayMethodError("invoice_already_paid", "Fatura já paga")
    if inv.status in (InvoiceStatus.CANCELED.value, InvoiceStatus.VOID.value,
                      InvoiceStatus.REFUNDED.value):
        raise PayMethodError("invoice_not_payable", f"Fatura {inv.status}")
    return inv


async def _customer(db: AsyncSession, customer_id: int) -> Customer:
    cust = (
        await db.execute(select(Customer).where(Customer.id == customer_id))
    ).scalar_one_or_none()
    if not cust:
        raise PayMethodError("invoice_not_found", "Cliente não encontrado")
    return cust


def _split_name(name: str) -> tuple[str, str]:
    parts = (name or "").strip().split()
    if not parts:
        return ("Cliente", "Innexar")
    if len(parts) == 1:
        return (parts[0], "Innexar")
    return (" ".join(parts[:-1]), parts[-1])


def _doc_type_number(tax_id: str | None) -> tuple[str, str] | None:
    digits = "".join(ch for ch in (tax_id or "") if ch.isdigit())
    if len(digits) == 11:
        return ("CPF", digits)
    if len(digits) == 14:
        return ("CNPJ", digits)
    return None


async def create_pix_charge(
    db: AsyncSession, *, invoice_id: int, customer_id: int | None = None,
) -> dict:
    """Cria cobrança PIX oficial e registra a tentativa (idempotente)."""
    inv = await _invoice_for_pay(db, invoice_id, customer_id)
    cust = await _customer(db, inv.customer_id)
    provider_name = resolve_provider_name(cust.billing_provider, inv.currency)
    if not capabilities.supports(provider_name, PaymentMethod.PIX.value):
        raise PayMethodError(
            "method_not_supported",
            f"PIX indisponível via {provider_name} para {inv.currency}",
        )
    # Reusa tentativa pendente válida (idempotência).
    existing = (
        await db.execute(
            select(PaymentAttempt).where(
                PaymentAttempt.invoice_id == inv.id,
                PaymentAttempt.method == PaymentMethod.PIX.value,
                PaymentAttempt.status == AttemptStatus.PENDING.value,
            )
        )
    ).scalars().first()
    if existing and (not existing.expires_at or (_aware(existing.expires_at) or datetime.now(UTC)) > datetime.now(UTC)):
        return _attempt_view(existing)
    provider = await get_payment_provider(db, inv.customer_id, cust.org_id, inv.currency)
    if not isinstance(provider, MercadoPagoProvider):
        raise PayMethodError("method_not_supported", "PIX exige Mercado Pago")
    try:
        pay = provider.create_pix(
            amount=float(inv.total), payer_email=cust.email,
            description=f"Innexar fatura #{inv.id}",
            external_reference=str(inv.id),
        )
    except ValueError as e:
        raise PayMethodError("provider_error", str(e)) from e
    poi = pay.get("point_of_interaction") or {}
    txn = poi.get("transaction_data") or {}
    attempt = PaymentAttempt(
        invoice_id=inv.id, provider=provider_name,
        external_id=str(pay.get("id")), status=AttemptStatus.PENDING.value,
        method=PaymentMethod.PIX.value, amount=float(inv.total),
        expires_at=_parse_mp_expiry(pay),
        meta={
            "qr_code": txn.get("qr_code"),
            "qr_code_base64": txn.get("qr_code_base64"),
            "copy_paste": txn.get("qr_code"),
        },
    )
    db.add(attempt)
    await db.flush()
    return _attempt_view(attempt)


async def create_boleto_charge(
    db: AsyncSession, *, invoice_id: int, customer_id: int | None = None,
) -> dict:
    """Cria boleto oficial e registra a tentativa (idempotente)."""
    inv = await _invoice_for_pay(db, invoice_id, customer_id)
    cust = await _customer(db, inv.customer_id)
    provider_name = resolve_provider_name(cust.billing_provider, inv.currency)
    if not capabilities.supports(provider_name, PaymentMethod.BOLETO.value):
        raise PayMethodError(
            "method_not_supported",
            f"Boleto indisponível via {provider_name} para {inv.currency}",
        )
    existing = (
        await db.execute(
            select(PaymentAttempt).where(
                PaymentAttempt.invoice_id == inv.id,
                PaymentAttempt.method == PaymentMethod.BOLETO.value,
                PaymentAttempt.status == AttemptStatus.PENDING.value,
            )
        )
    ).scalars().first()
    if existing and (not existing.expires_at or (_aware(existing.expires_at) or datetime.now(UTC)) > datetime.now(UTC)):
        return _attempt_view(existing)
    doc = _doc_type_number(cust.tax_id)
    if not doc:
        raise PayMethodError(
            "payer_data_missing",
            "Informe CPF/CNPJ no cadastro para gerar boleto",
        )
    first, last = _split_name(cust.name)
    provider = await get_payment_provider(db, inv.customer_id, cust.org_id, inv.currency)
    if not isinstance(provider, MercadoPagoProvider):
        raise PayMethodError("method_not_supported", "Boleto exige Mercado Pago")
    addr = cust.address if isinstance(cust.address, dict) else {}
    missing = [k for k in ("street", "number", "city", "state") if not addr.get(k)]
    if not (addr.get("postal_code") or addr.get("zip_code")):
        missing.append("postal_code")
    if missing:
        raise PayMethodError(
            "payer_data_missing",
            f"Complete o endereço no cadastro para gerar boleto: {', '.join(missing)}",
        )
    try:
        pay = provider.create_boleto(
            amount=float(inv.total), payer_email=cust.email,
            first_name=first, last_name=last,
            doc_type=doc[0], doc_number=doc[1], address=addr,
            description=f"Innexar fatura #{inv.id}",
            external_reference=str(inv.id),
        )
    except ValueError as e:
        raise PayMethodError("provider_error", str(e)) from e
    txn = pay.get("transaction_details") or {}
    attempt = PaymentAttempt(
        invoice_id=inv.id, provider=provider_name,
        external_id=str(pay.get("id")), status=AttemptStatus.PENDING.value,
        method=PaymentMethod.BOLETO.value, amount=float(inv.total),
        expires_at=_parse_mp_expiry(pay),
        meta={
            "barcode": txn.get("barcode", {}).get("content")
            if isinstance(txn.get("barcode"), dict) else txn.get("barcode"),
            "digitable_line": txn.get("barcode", {}).get("content")
            if isinstance(txn.get("barcode"), dict) else None,
            "ticket_url": txn.get("external_resource_url"),
        },
    )
    db.add(attempt)
    await db.flush()
    return _attempt_view(attempt)


def _attempt_view(att: PaymentAttempt) -> dict:
    return {
        "id": att.id,
        "method": att.method,
        "provider": att.provider,
        "external_id": att.external_id,
        "status": att.status,
        "amount": float(att.amount) if att.amount is not None else None,
        "expires_at": att.expires_at.isoformat() if att.expires_at else None,
        "meta": att.meta or {},
    }


async def create_refund(
    db: AsyncSession, *, invoice_id: int, amount: float | None = None,
    reason: str | None = None, actor_type: str = "staff", actor_id: str = "",
) -> dict:
    """Reembolsa via provider oficial quando suportado; registra tudo."""
    from app.core.audit import log_audit

    inv = (
        await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    ).scalar_one_or_none()
    if not inv:
        raise PayMethodError("invoice_not_found", "Fatura não encontrada")
    cust = await _customer(db, inv.customer_id)
    provider_name = resolve_provider_name(cust.billing_provider, inv.currency)
    provider = await get_payment_provider(db, inv.customer_id, cust.org_id, inv.currency)
    provider_refund_id: str | None = None
    if isinstance(provider, StripeProvider):
        attempt = (
            await db.execute(
                select(PaymentAttempt).where(
                    PaymentAttempt.invoice_id == inv.id,
                    PaymentAttempt.provider == "stripe",
                    PaymentAttempt.status == AttemptStatus.APPROVED.value,
                )
            )
        ).scalars().first()
        charge_id = (attempt.meta or {}).get("charge_id") if attempt else None
        if not charge_id:
            raise PayMethodError("refund_unavailable", "Charge Stripe não localizado")
        cents = int(round((amount if amount is not None else float(inv.total)) * 100))
        out = provider.refund_charge(charge_id, amount_cents=cents)
        provider_refund_id = str(out.get("id"))
    elif isinstance(provider, MercadoPagoProvider):
        attempt = (
            await db.execute(
                select(PaymentAttempt).where(
                    PaymentAttempt.invoice_id == inv.id,
                    PaymentAttempt.provider == "mercadopago",
                    PaymentAttempt.status == AttemptStatus.APPROVED.value,
                )
            )
        ).scalars().first()
        payment_id = attempt.external_id if attempt else None
        if not payment_id and inv.external_id:
            payment_id = inv.external_id
        if not payment_id:
            raise PayMethodError("refund_unavailable", "Pagamento MP não localizado")
        out = provider.refund_payment(payment_id, amount=amount)
        provider_refund_id = str((out or {}).get("id"))
    else:
        raise PayMethodError("refund_unavailable", "Provider sem reembolso")
    refund = Refund(
        invoice_id=inv.id, provider=provider_name,
        provider_refund_id=provider_refund_id,
        amount=amount if amount is not None else float(inv.total),
        currency=inv.currency or "USD", status="approved",
        reason=reason, actor_type=actor_type, actor_id=actor_id,
    )
    db.add(refund)
    inv.status = InvoiceStatus.REFUNDED.value
    await db.flush()
    await log_audit(
        db, entity="invoice", entity_id=str(inv.id), action="refund_created",
        actor_type=actor_type, actor_id=actor_id,
        payload={"provider": provider_name, "amount": refund.amount},
    )
    await db.flush()
    return {"id": refund.id, "status": refund.status,
            "provider_refund_id": provider_refund_id}
