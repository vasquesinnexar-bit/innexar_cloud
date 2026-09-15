"""Public billing: webhook handling (Stripe / Mercado Pago). Uses BillingRepository, CustomerRepository."""

import hmac
import json
import os
from hashlib import sha256
from typing import TYPE_CHECKING

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.email_templates import invoice_paid_email, normalize_locale
from app.core.ops_notifications import send_ops_alert
from app.modules.billing.post_payment import create_project_and_notify_after_payment
from app.modules.billing.service import process_webhook
from app.modules.fulfillment.tasks import (
    fulfillment_after_payment as _fulfillment_after_payment,
)
from app.repositories.billing_repository import BillingRepository
from app.repositories.customer_repository import CustomerRepository

if TYPE_CHECKING:
    from fastapi import BackgroundTasks

from app.core.org import ORG_INNEXAR_US


def _invoice_locale(line_items: list | dict | None) -> str:
    """Extract locale from invoice line_items payload."""
    if isinstance(line_items, list) and line_items and isinstance(line_items[0], dict):
        return normalize_locale(str(line_items[0].get("preferred_locale") or "en"))
    if isinstance(line_items, dict):
        loc = line_items.get("preferred_locale")
        if isinstance(loc, str):
            return normalize_locale(loc)
    return "en"


def _mp_webhook_secrets() -> list[str]:
    """Collect MP webhook secrets from env (USA + Brazil stacks may differ)."""
    seen: set[str] = set()
    secrets: list[str] = []
    for key in ("MP_WEBHOOK_SECRET", "MERCADOPAGO_WEBHOOK_SECRET"):
        v = (os.environ.get(key) or "").strip()
        if v and v not in seen:
            seen.add(v)
            secrets.append(v)
    return secrets


def _verify_mercadopago_signature(request: Request, body: bytes) -> bool:
    """Validate MP x-signature (manifest + HMAC-SHA256). If no secret configured, skip validation."""
    secrets = _mp_webhook_secrets()
    if not secrets:
        return True
    x_sig = request.headers.get("x-signature")
    if not x_sig:
        return False
    ts_val: str | None = None
    v1_val: str | None = None
    for part in x_sig.split(","):
        key_val = part.strip().split("=", 1)
        if len(key_val) == 2:
            k, v = key_val[0].strip(), key_val[1].strip()
            if k == "ts":
                ts_val = v
            elif k == "v1":
                v1_val = v
    if not ts_val or not v1_val:
        return False
    x_request_id = request.headers.get("x-request-id") or ""
    data_id = request.query_params.get("data.id") or ""
    if not data_id and body:
        try:
            payload = json.loads(body)
            data_id = str((payload.get("data") or {}).get("id") or "")
        except Exception:
            pass
    if isinstance(data_id, str) and data_id.isalnum():
        data_id = data_id.lower()
    manifest = f"id:{data_id};request-id:{x_request_id};ts:{ts_val};"
    for secret in secrets:
        expected = hmac.new(secret.encode(), manifest.encode(), sha256).hexdigest()
        if hmac.compare_digest(expected, v1_val):
            return True
    return False


def _is_mercadopago_test_notification(body: bytes) -> bool:
    """MP dashboard 'Test this URL' sends fixed payload with data.id=123456."""
    try:
        payload = json.loads(body)
        data_id = str((payload.get("data") or {}).get("id") or "")
        return payload.get("type") == "payment" and data_id == "123456"
    except Exception:
        return False


async def _run_create_project_and_notify(invoice_id: int) -> None:
    """Background: create project for site product and notify team."""
    async with AsyncSessionLocal() as db:
        try:
            await create_project_and_notify_after_payment(db, invoice_id)
            await db.commit()
        except Exception:
            await db.rollback()
            raise


class BillingPublicService:
    """Public webhooks: Stripe and Mercado Pago. Uses BillingRepository, CustomerRepository."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._billing = BillingRepository(db)
        self._customer = CustomerRepository(db)

    async def handle_stripe_webhook(
        self,
        body: bytes,
        headers: dict,
        background_tasks: "BackgroundTasks",
    ) -> tuple[int, str]:
        """Process Stripe webhook; enqueue post-payment tasks if paid. Returns (status_code, content)."""
        ok, msg, paid_invoice_id = await process_webhook(
            self._db, "stripe", body, headers
        )
        if not ok and msg != "already_processed":
            return (400, msg)
        if ok and paid_invoice_id:
            await self._run_post_payment_tasks(
                paid_invoice_id,
                background_tasks,
                title="Invoice paid",
                body=f"Invoice #{paid_invoice_id} has been paid.",
            )
        return (200, "ok")

    async def handle_mercadopago_webhook(
        self,
        request: Request,
        body: bytes,
        background_tasks: "BackgroundTasks",
    ) -> tuple[int, str]:
        """Verify MP signature, process webhook; enqueue post-payment tasks if paid. Returns (status_code, content)."""
        if not _is_mercadopago_test_notification(
            body
        ) and not _verify_mercadopago_signature(request, body):
            return (401, "invalid signature")
        headers = dict(request.headers)
        ok, msg, paid_invoice_id = await process_webhook(
            self._db, "mercadopago", body, headers
        )
        if not ok:
            return (400, msg)
        if ok and paid_invoice_id:
            await self._run_post_payment_tasks(
                paid_invoice_id,
                background_tasks,
                title="Pagamento confirmado",
                body=f"A fatura #{paid_invoice_id} foi paga.",
            )
        return (200, "ok")

    async def _run_post_payment_tasks(
        self,
        paid_invoice_id: int,
        background_tasks: "BackgroundTasks",
        title: str,
        body: str,
    ) -> None:
        """Load invoice and customer user; send notification; enqueue credentials, provisioning, project."""
        from app.modules.customers.service import send_portal_credentials_after_payment
        from app.modules.notifications.service import (
            create_notification_and_maybe_send_email,
        )

        inv = await self._billing.get_invoice_by_id(paid_invoice_id)
        if not inv:
            background_tasks.add_task(
                _fulfillment_after_payment, paid_invoice_id, source="website"
            )
            background_tasks.add_task(_run_create_project_and_notify, paid_invoice_id)
            return
        customer = await self._customer.get_by_id_with_users(inv.customer_id)
        org_id = customer.org_id if customer and customer.org_id else ORG_INNEXAR_US
        cu = await self._customer.get_customer_user_by_customer_id(inv.customer_id)
        if cu:
            locale = _invoice_locale(inv.line_items)
            portal_base = str(
                getattr(settings, "PORTAL_URL", None)
                or getattr(settings, "FRONTEND_URL", "http://localhost:3000")
            ).rstrip("/")
            billing_url = f"{portal_base}/{locale}/billing"
            email_subject, email_plain, email_html = invoice_paid_email(
                invoice_id=inv.id,
                locale=locale,
                billing_url=billing_url,
            )
            await create_notification_and_maybe_send_email(
                self._db,
                background_tasks,
                customer_user_id=cu.id,
                channel="in_app,email",
                title=title,
                body=body,
                recipient_email=cu.email,
                org_id=org_id,
                email_subject=email_subject,
                email_body=email_plain,
                email_html=email_html,
                email_locale=locale,
                email_action_url=billing_url,
            )
        await send_ops_alert(
            self._db,
            subject="Pagamento confirmado",
            body=(
                f"Invoice ID: {inv.id}\n"
                f"Customer ID: {inv.customer_id}\n"
                f"Email cliente: {cu.email if cu else 'n/a'}\n"
                f"Valor: {inv.total} {inv.currency}\n"
                f"Provider: webhook"
            ),
            org_id=org_id,
        )
        background_tasks.add_task(
            send_portal_credentials_after_payment,
            inv.customer_id,
            org_id,
            inv.id,
        )
        background_tasks.add_task(
                _fulfillment_after_payment, paid_invoice_id, source="website"
            )
        background_tasks.add_task(_run_create_project_and_notify, paid_invoice_id)
