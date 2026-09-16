"""Public checkout: resolve product/plan, find or create customer, create subscription+invoice, pay."""

import logging
import secrets
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING
from urllib.parse import quote

from app.core.ops_notifications import send_ops_alert
from app.core.org import default_currency_for_org
from app.core.security import create_token_customer, hash_password
from app.models.customer import Customer
from app.models.customer_user import CustomerUser
from app.modules.billing.enums import InvoiceStatus, SubscriptionStatus
from app.modules.billing.models import Invoice, PricePlan, Product, Subscription
from app.modules.billing.service import create_payment_attempt
from app.modules.checkout.schemas import CheckoutStartRequest, CheckoutStartResponse
from app.repositories.billing_repository import BillingRepository
from app.repositories.customer_repository import CustomerRepository
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

if TYPE_CHECKING:
    from fastapi import BackgroundTasks

logger = logging.getLogger(__name__)

PLAN_SLUG_TO_NAME: dict[str, str] = {
    "starter": "Starter Website",
    "business": "Business Website",
    "pro": "Pro Website",
    "start": "Paid Traffic Start",
    "growth": "Paid Traffic Growth",
    "premium": "Paid Traffic Premium",
}


class CheckoutService:
    """Start checkout: resolve product/plan, find or create customer, create sub+invoice, pay (Bricks or Checkout Pro)."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._billing = BillingRepository(db)
        self._customer = CustomerRepository(db)

    async def start_checkout(
        self,
        body: CheckoutStartRequest,
        background_tasks: "BackgroundTasks",
        org_id: str,
    ) -> CheckoutStartResponse:
        """Full checkout flow: resolve product/plan, find or create customer, create sub+invoice, process payment."""
        email = body.customer_email.lower().strip()
        product_id, price_plan_id, product, pp = await self._resolve_product_plan(
            body, org_id
        )
        # P1.4A — validação central (canal website). Pré-cheque sem cliente
        # antes de criar qualquer registro; cheque completo após resolver cliente.
        from app.modules.billing.product_validation import (
            validate_product_for_sale,
        )
        from app.modules.fulfillment.registry import handler_spec, resolve_handler

        _strategy, _handler = resolve_handler(product)
        _spec = handler_spec(_handler) or {}
        _pre = validate_product_for_sale(
            product, pp, channel="website", domain=body.domain
        )
        if _pre:
            _code = _pre[0]["code"]
            raise HTTPException(
                status_code=(
                    status.HTTP_404_NOT_FOUND
                    if _code
                    in (
                        "no_product",
                        "inactive",
                        "channel_closed",
                        "unknown_handler",
                        "plan_mismatch",
                    )
                    else status.HTTP_400_BAD_REQUEST
                ),
                detail=_pre[0]["message"],
            )

        customer_id, customer_user_id, cust, existing_customer = (
            await self._find_or_create_customer(body, email, org_id)
        )
        if not existing_customer:
            await send_ops_alert(
                self._db,
                subject="Novo cadastro iniciado",
                body=(
                    f"Cliente: {body.customer_name or email}\n"
                    f"Email: {email}\n"
                    f"Origem: checkout p?blico\n"
                    f"Plano: {body.plan_slug or body.price_plan_id}"
                ),
                org_id=org_id,
            )
        checkout_token = create_token_customer(
            subject=customer_user_id,
            expires_delta=timedelta(hours=24),
            extra_claims={"scope": "checkout_auto_login"},
        )

        sub = Subscription(
            customer_id=customer_id,
            product_id=product_id,
            price_plan_id=price_plan_id,
            status=SubscriptionStatus.INACTIVE.value,
        )
        self._billing.add_subscription(sub)
        await self._db.flush()

        due = datetime.now(UTC) + timedelta(days=7)
        preferred_locale = (body.locale or "en").strip().lower() or "en"
        if preferred_locale not in ("en", "pt", "es"):
            preferred_locale = "en"
        line_items: list[dict] = [
            {
                "description": f"{product.name} - {pp.name}",
                "amount": float(pp.amount),
                "preferred_locale": preferred_locale,
            }
        ]
        if body.domain and _spec.get("requires_domain_at_checkout"):
            line_items[0]["domain"] = body.domain.strip()
        if body.fidelity_12_months_accepted is True:
            line_items[0]["fidelity_12_months_accepted"] = True
            line_items[0]["fidelity_accepted_at"] = datetime.now(UTC).isoformat()

        inv = Invoice(
            customer_id=customer_id,
            subscription_id=sub.id,
            status=InvoiceStatus.DRAFT.value,
            due_date=due,
            total=float(pp.amount),
            currency=pp.currency or "USD",
            line_items=line_items,
        )
        self._billing.add_invoice(inv)
        await self._db.flush()

        if body.payment_method_id:
            from app.modules.checkout.checkout_bricks import process_bricks_payment

            return await process_bricks_payment(
                self._db,
                background_tasks,
                body,
                inv,
                sub,
                pp,
                cust,
                email,
                existing_customer,
                checkout_token,
                org_id=org_id,
            )

        success_url = body.success_url
        if success_url and checkout_token:
            separator = "&" if "?" in success_url else "?"
            success_url = (
                f"{success_url}{separator}token={quote(checkout_token, safe='')}"
            )
        try:
            res = await create_payment_attempt(
                self._db,
                invoice_id=inv.id,
                success_url=success_url,
                cancel_url=body.cancel_url,
                customer_email=email,
                customer_name=body.customer_name,
                customer_phone=body.customer_phone,
                coupon_code=body.coupon_code and body.coupon_code.strip() or None,
            )
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
            ) from e

        await send_ops_alert(
            self._db,
            subject="Pagamento iniciado",
            body=(
                f"Cliente: {body.customer_name or email}\n"
                f"Email: {email}\n"
                f"Invoice ID: {inv.id}\n"
                f"Subscription ID: {sub.id}\n"
                f"Plano: {body.plan_slug or body.price_plan_id}\n"
                f"Valor: {pp.amount} {pp.currency or 'USD'}"
            ),
            org_id=org_id,
        )
        return CheckoutStartResponse(
            payment_url=res.payment_url,
            existing_customer=existing_customer,
            checkout_token=checkout_token,
        )

    async def _resolve_product_plan(
        self, body: CheckoutStartRequest, org_id: str
    ) -> tuple[int, int, Product, PricePlan]:
        """Resolve product_id, price_plan_id and load Product, PricePlan. Raises 404 if not found."""
        if body.plan_slug:
            slug = (body.plan_slug or "").strip().lower()
            product_name = PLAN_SLUG_TO_NAME.get(slug)
            if not product_name:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=(
                        f"Unknown plan_slug: {body.plan_slug}. "
                        "Use starter, business, pro, start, growth, or premium."
                    ),
                )
            rows = await self._billing.list_products_and_plans_by_filter(
                org_id=org_id,
                product_names=(product_name,),
                plan_interval="month",
                plan_currency=default_currency_for_org(org_id),
            )
            if not rows:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"WaaS product '{product_name}' not found. Run seed_products_usa_waas.py.",
                )
            product, pp = rows[0]
            return (product.id, pp.id, product, pp)
        product_id = body.product_id  # type: ignore[assignment]
        price_plan_id = body.price_plan_id  # type: ignore[assignment]
        pp = await self._billing.get_price_plan_by_id(price_plan_id, org_id=org_id)
        if not pp or pp.product_id != product_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Product or price plan not found",
            )
        product = await self._billing.get_product_by_id(product_id, org_id=org_id)
        if not product or not product.is_active:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Product or price plan not found",
            )
        return (product_id, price_plan_id, product, pp)

    async def _find_or_create_customer(
        self, body: CheckoutStartRequest, email: str, org_id: str
    ) -> tuple[int, int, Customer | None, bool]:
        """Find or create Customer and CustomerUser. Returns (customer_id, customer_user_id, cust, existing_customer)."""
        cu = await self._customer.get_customer_user_by_email(email, org_id=org_id)
        if cu:
            cust = await self._customer.get_by_id_with_users(
                cu.customer_id, org_id=org_id
            )
            return (cu.customer_id, cu.id, cust, True)

        cust = await self._customer.get_by_email(email, org_id=org_id)
        if cust:
            cu_new = CustomerUser(
                customer_id=cust.id,
                email=email,
                password_hash=hash_password(secrets.token_urlsafe(16)),
                requires_password_change=True,
                email_verified=False,
            )
            self._customer.add_customer_user(cu_new)
            await self._db.flush()
            return (cust.id, cu_new.id, cust, False)

        cust = Customer(
            org_id=org_id,
            name=body.customer_name or email,
            email=email,
            phone=body.customer_phone,
        )
        self._customer.add(cust)
        await self._db.flush()
        cu_new = CustomerUser(
            customer_id=cust.id,
            email=email,
            password_hash=hash_password(secrets.token_urlsafe(16)),
            requires_password_change=True,
            email_verified=False,
        )
        self._customer.add_customer_user(cu_new)
        await self._db.flush()
        return (cust.id, cu_new.id, cust, False)
