"""Billing workspace service: CRUD and link-hestia via repository. No payment logic here."""

import asyncio
from datetime import UTC, datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import log_audit
from app.core.org import staff_org_id
from app.models.customer import Customer
from app.modules.billing._subscription_helpers import (
    set_subscription_next_due_if_recurring,
)
from app.modules.billing.enums import InvoiceStatus, SubscriptionStatus
from app.modules.billing.models import (
    Invoice,
    PaymentAttempt,
    PricePlan,
    Product,
    ProvisioningRecord,
    Subscription,
)
from app.modules.billing.overdue import (
    reactivate_subscription_after_payment,
    sync_subscription_status_to_hestia,
)
from app.modules.billing.schemas import (
    InvoiceCreate,
    LinkHestiaBody,
    PricePlanCreate,
    PricePlanUpdate,
    ProductCreate,
    ProductUpdate,
    SubscriptionCreate,
    SubscriptionUpdate,
)
from app.modules.billing.service import create_manual_invoice
from app.providers.payments.stripe import StripeProvider
from app.repositories.billing_repository import BillingRepository


class BillingWorkspaceService:
    """Workspace billing CRUD. Uses BillingRepository; no direct DB in routers."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._repo = BillingRepository(db)

    @staticmethod
    def _sub_org_filter(org_id: str | None) -> str | None:
        return staff_org_id(org_id) if org_id is not None else None

    async def _customer_org_for_sub(self, sub: Subscription) -> str:
        r = await self._db.execute(
            select(Customer.org_id).where(Customer.id == sub.customer_id).limit(1)
        )
        return r.scalar_one_or_none() or "innexar"

    # ----- Products -----
    async def list_products(
        self, org_id: str | None, with_plans: bool = False
    ) -> list[Product] | list[dict]:
        products = await self._repo.list_products(org_id=org_id)
        if not with_plans:
            return products
        all_plans = await self._repo.list_price_plans(org_id=org_id, order_by_id=True)
        by_product: dict[int, list[PricePlan]] = {}
        for pp in all_plans:
            by_product.setdefault(pp.product_id, []).append(pp)
        return [{"product": p, "plans": by_product.get(p.id, [])} for p in products]

    async def get_product(
        self, product_id: int, org_id: str | None = None
    ) -> Product | None:
        return await self._repo.get_product_by_id(product_id, org_id=org_id)

    async def create_product(self, body: ProductCreate, org_id: str) -> Product:
        p = Product(
            org_id=staff_org_id(org_id),
            name=body.name,
            description=body.description,
            is_active=body.is_active,
            provisioning_type=body.provisioning_type,
            hestia_package=body.hestia_package,
            category=body.category,
            slug=body.slug.strip().lower() if body.slug else None,
            portal_sellable=body.portal_sellable,
            website_sellable=body.website_sellable,
            admin_assignable=body.admin_assignable,
        )
        self._repo.add_product(p)
        await self._db.flush()
        await self._repo.update_product(p)
        return p

    async def update_product(
        self, product_id: int, body: ProductUpdate, org_id: str | None = None
    ) -> Product | None:
        p = await self._repo.get_product_by_id(product_id, org_id=org_id)
        if not p:
            return None
        if body.name is not None:
            p.name = body.name
        if body.description is not None:
            p.description = body.description
        if body.is_active is not None:
            p.is_active = body.is_active
        if body.provisioning_type is not None:
            p.provisioning_type = body.provisioning_type
        if body.hestia_package is not None:
            p.hestia_package = body.hestia_package
        if body.category is not None:
            p.category = body.category.strip() or None
        if body.slug is not None:
            p.slug = body.slug.strip().lower() or None
        if body.portal_sellable is not None:
            p.portal_sellable = body.portal_sellable
        if body.website_sellable is not None:
            p.website_sellable = body.website_sellable
        if body.admin_assignable is not None:
            p.admin_assignable = body.admin_assignable
        await self._repo.update_product(p)
        return p

    # ----- Price plans -----
    async def list_price_plans(
        self, org_id: str | None, product_id: int | None = None
    ) -> list[PricePlan]:
        return await self._repo.list_price_plans(org_id=org_id, product_id=product_id)

    async def get_price_plan(
        self, plan_id: int, org_id: str | None = None
    ) -> PricePlan | None:
        return await self._repo.get_price_plan_by_id(plan_id, org_id=org_id)

    async def create_price_plan(self, body: PricePlanCreate) -> PricePlan:
        pp = PricePlan(
            product_id=body.product_id,
            name=body.name,
            interval=body.interval,
            amount=body.amount,
            currency=body.currency,
            billing_type=body.billing_type or "recurring",
            unit=body.unit,
            provider=body.provider.strip().lower() if body.provider else None,
        )
        self._repo.add_price_plan(pp)
        await self._db.flush()
        await self._repo.update_price_plan(pp)
        return pp

    async def update_price_plan(
        self, plan_id: int, body: PricePlanUpdate, org_id: str | None = None
    ) -> PricePlan | None:
        pp = await self._repo.get_price_plan_by_id(plan_id, org_id=org_id)
        if not pp:
            return None
        if body.name is not None:
            pp.name = body.name
        if body.interval is not None:
            pp.interval = body.interval
        if body.amount is not None:
            pp.amount = body.amount
        if body.currency is not None:
            pp.currency = body.currency
        if body.billing_type is not None:
            pp.billing_type = body.billing_type.strip().lower() or "recurring"
        if body.unit is not None:
            pp.unit = body.unit.strip() or None
        if body.provider is not None:
            pp.provider = body.provider.strip().lower() or None
        await self._repo.update_price_plan(pp)
        return pp

    # ----- Subscriptions -----
    async def list_subscriptions(
        self, org_id: str | None, customer_id: int | None = None
    ) -> list[Subscription]:
        return await self._repo.list_subscriptions(
            org_id=org_id, customer_id=customer_id
        )

    async def get_subscription(
        self, subscription_id: int, org_id: str | None = None
    ) -> Subscription | None:
        return await self._repo.get_subscription_by_id(
            subscription_id, org_id=self._sub_org_filter(org_id)
        )

    async def create_subscription(
        self, body: SubscriptionCreate, actor_id: str, org_id: str
    ) -> Subscription:
        org = staff_org_id(org_id)
        cust = (
            await self._db.execute(
                select(Customer.id)
                .where(Customer.id == body.customer_id, Customer.org_id == org)
                .limit(1)
            )
        ).scalar_one_or_none()
        if not cust:
            raise ValueError("Customer not found in organization")
        sub = Subscription(
            customer_id=body.customer_id,
            product_id=body.product_id,
            price_plan_id=body.price_plan_id,
            status=body.status,
            start_date=body.start_date,
            next_due_date=body.next_due_date,
        )
        self._repo.add_subscription(sub)
        await self._db.flush()
        await log_audit(
            self._db,
            entity="subscription",
            entity_id=str(sub.id),
            action="create",
            actor_type="staff",
            actor_id=actor_id,
            org_id=org_id,
        )
        await self._repo.update_subscription(sub)
        return sub

    async def update_subscription(
        self,
        subscription_id: int,
        body: SubscriptionUpdate,
        org_id: str | None = None,
    ) -> Subscription | None:
        sub = await self._repo.get_subscription_by_id(
            subscription_id, org_id=self._sub_org_filter(org_id)
        )
        if not sub:
            return None
        hestia_org = (
            org_id if org_id is not None else await self._customer_org_for_sub(sub)
        )
        if body.status is not None:
            sub.status = body.status
            await sync_subscription_status_to_hestia(
                self._db, subscription_id, body.status, hestia_org
            )
        if body.start_date is not None:
            sub.start_date = body.start_date
        if body.end_date is not None:
            sub.end_date = body.end_date
        if body.next_due_date is not None:
            sub.next_due_date = body.next_due_date
        await self._repo.update_subscription(sub)
        return sub

    async def cancel_subscription(
        self,
        subscription_id: int,
        org_id: str | None,
        actor_id: str,
    ) -> Subscription | None:
        """Cancel subscription: set status canceled, end_date now, clear next_due_date."""
        sub = await self._repo.get_subscription_by_id(
            subscription_id, org_id=self._sub_org_filter(org_id)
        )
        if not sub:
            return None
        hestia_org = (
            org_id if org_id is not None else await self._customer_org_for_sub(sub)
        )
        if sub.status == SubscriptionStatus.CANCELED.value:
            return sub
        sub.status = SubscriptionStatus.CANCELED.value
        sub.end_date = datetime.now(timezone.utc)  # noqa: UP017
        sub.next_due_date = None
        await sync_subscription_status_to_hestia(
            self._db, subscription_id, SubscriptionStatus.CANCELED.value, hestia_org
        )
        await self._repo.update_subscription(sub)
        await log_audit(
            self._db,
            entity="subscription",
            entity_id=str(sub.id),
            action="cancel",
            actor_type="staff",
            actor_id=actor_id,
            org_id=hestia_org,
        )
        return sub

    async def link_hestia_user(
        self, subscription_id: int, body: LinkHestiaBody, org_id: str | None
    ) -> ProvisioningRecord | None:
        """Link Hestia user to subscription. Returns None if subscription not found; raises ValueError if invoice_id invalid."""
        sub = await self._repo.get_subscription_by_id(
            subscription_id, org_id=self._sub_org_filter(org_id)
        )
        if not sub:
            return None
        if body.invoice_id is not None:
            inv = await self._repo.get_invoice_for_subscription(
                body.invoice_id, subscription_id
            )
            if inv is None:
                raise ValueError(
                    "invoice_id must belong to this subscription or be omitted"
                )
        rec = ProvisioningRecord(
            subscription_id=subscription_id,
            invoice_id=body.invoice_id,
            provider="hestia",
            external_user=body.hestia_username.strip(),
            domain=body.domain.strip(),
            site_url=f"https://{body.domain.strip()}",
            panel_login=body.hestia_username.strip(),
            panel_url=None,
            panel_password_encrypted=None,
            status="provisioned",
            provisioned_at=datetime.now(timezone.utc),  # noqa: UP017
        )
        self._repo.add_provisioning_record(rec)
        await self._repo.refresh_provisioning_record(rec)
        return rec

    # ----- Invoices (list/get from repo; create via existing service) -----
    async def list_invoices(
        self,
        org_id: str | None,
        customer_id: int | None = None,
        status: str | None = None,
    ):
        invs = await self._repo.list_invoices(
            org_id=org_id, customer_id=customer_id, status=status
        )
        if not invs:
            return []
        customer_ids = list({i.customer_id for i in invs})
        r = await self._db.execute(
            select(Customer).where(Customer.id.in_(customer_ids))
        )
        customers = {c.id: c for c in r.scalars().all()}
        return [(inv, customers.get(inv.customer_id)) for inv in invs]

    async def get_invoice(self, invoice_id: int, org_id: str | None = None):
        return await self._repo.get_invoice_by_id(invoice_id, org_id=org_id)

    async def create_invoice(self, body: InvoiceCreate):
        """Create invoice via create_manual_invoice then set subscription_id."""
        inv = await create_manual_invoice(
            self._db,
            customer_id=body.customer_id,
            due_date=body.due_date,
            total=body.total,
            currency=body.currency,
            line_items=body.line_items,
        )
        inv.subscription_id = body.subscription_id
        await self._db.flush()
        await self._db.refresh(inv)
        return inv

    async def _reconcile_pending_stripe_checkouts(
        self, customer_id: int, org_id: str = "innexar"
    ) -> None:
        """Fallback reconciliation for pending Stripe checkout sessions.

        If webhook processing is delayed/missed, read APIs still reflect paid status.
        """
        pending_invoices = (
            (
                await self._db.execute(
                    select(Invoice)
                    .where(
                        Invoice.customer_id == customer_id,
                        Invoice.status == InvoiceStatus.PENDING.value,
                        Invoice.external_id.is_not(None),
                    )
                    .order_by(Invoice.id.desc())
                    .limit(10)
                )
            )
            .scalars()
            .all()
        )
        if not pending_invoices:
            return

        stripe_provider = StripeProvider()
        changed = False

        for inv in pending_invoices:
            session_id = (inv.external_id or "").strip()
            if not session_id.startswith("cs_"):
                continue

            attempt = (
                await self._db.execute(
                    select(PaymentAttempt)
                    .where(PaymentAttempt.invoice_id == inv.id)
                    .order_by(PaymentAttempt.id.desc())
                    .limit(1)
                )
            ).scalar_one_or_none()
            if attempt and attempt.provider != "stripe":
                continue

            try:
                session = await asyncio.to_thread(
                    stripe_provider.get_checkout_session, session_id
                )
            except Exception:
                continue

            payment_status = str(session.get("payment_status") or "").lower()
            checkout_status = str(session.get("status") or "").lower()
            is_paid = payment_status == "paid" or checkout_status == "complete"
            if not is_paid:
                continue

            inv.status = InvoiceStatus.PAID.value
            inv.paid_at = inv.paid_at or datetime.now(timezone.utc)  # noqa: UP017
            if attempt:
                attempt.status = "paid"

            if inv.subscription_id:
                sub = await self._repo.get_subscription_by_id(inv.subscription_id)
                if sub:
                    sub.status = SubscriptionStatus.ACTIVE.value
                    sub.start_date = sub.start_date or datetime.now(UTC)
                    await set_subscription_next_due_if_recurring(self._db, sub)
                    await reactivate_subscription_after_payment(
                        self._db,
                        sub.id,
                        org_id=staff_org_id(org_id),
                    )
            changed = True

        if changed:
            await self._db.flush()
