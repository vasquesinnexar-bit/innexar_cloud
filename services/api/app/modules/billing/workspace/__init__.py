"""Workspace billing routes: products, price_plans, subscriptions, invoices, contracts (split for ≤300 lines each)."""

from fastapi import APIRouter

from app.modules.billing.workspace import contracts, invoices, policies, price_plans, products, refunds, subscriptions

router = APIRouter(prefix="/billing", tags=["workspace-billing"])
router.include_router(products.router)
router.include_router(price_plans.router)
router.include_router(subscriptions.router)
router.include_router(invoices.router)
router.include_router(contracts.router)
router.include_router(policies.router)
router.include_router(refunds.router)
