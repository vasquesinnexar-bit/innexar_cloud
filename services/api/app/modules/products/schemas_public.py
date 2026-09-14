"""Public products API: response schemas."""

from typing import Any

from pydantic import BaseModel


class PricePlanOut(BaseModel):
    """Price plan for public catalog."""

    id: int
    name: str
    amount: float
    interval: str
    currency: str


class ProductSiteOut(BaseModel):
    """Site product with single plan and delivery/features meta."""

    id: int
    name: str
    description: str | None
    price_plan: PricePlanOut
    delivery_hours: int
    features: list[str]


class ProductCatalogOut(BaseModel):
    """Product with all price plans for catalog (monthly and/or one-time)."""

    id: int
    name: str
    description: str | None
    plans: list[PricePlanOut]


class WaaSPlanOut(BaseModel):
    """WaaS plan for frontend; frontend uses slug only."""

    slug: str
    name: str
    price: float
    currency: str
    features: list[str]


class PaidTrafficPlanOut(BaseModel):
    """Paid traffic plan for frontend page."""

    slug: str
    name: str
    price: float
    currency: str
    ideal_for: str
    includes: list[str]
    goal: str


# Meta constants for site/waas (not in DB)
SITE_PRODUCT_NAMES = ("Site Essencial", "Site Completo")
WaaS_PRODUCT_NAMES = ("Starter Website", "Business Website", "Pro Website")
PAID_TRAFFIC_PRODUCT_NAMES = (
    "Paid Traffic Start",
    "Paid Traffic Growth",
    "Paid Traffic Premium",
)

WaaS_PLAN_META: dict[str, dict[str, Any]] = {
    "Starter Website": {
        "slug": "starter",
        "features": [
            "5 pages",
            "Hosting included",
            "SSL security",
            "Basic SEO",
            "1 content update/month",
            "Email support",
        ],
    },
    "Business Website": {
        "slug": "business",
        "features": [
            "20 pages",
            "Blog",
            "Analytics integration",
            "SEO optimized",
            "3 updates/month",
            "Priority support",
        ],
    },
    "Pro Website": {
        "slug": "pro",
        "features": [
            "Unlimited pages",
            "Advanced SEO",
            "Integrations (CRM, etc.)",
            "Priority support",
        ],
    },
}

SITE_PLAN_META: dict[str, dict[str, Any]] = {
    "Site Essencial": {
        "delivery_hours": 48,
        "features": [
            "Site institucional",
            "Até 5 páginas",
            "Design profissional",
            "Responsivo (celular e computador)",
            "Integração WhatsApp",
            "SEO básico",
            "Hospedagem incluída",
            "SSL",
            "Manutenção e suporte",
        ],
    },
    "Site Completo": {
        "delivery_hours": 72,
        "features": [
            "Tudo do plano essencial",
            "Blog integrado",
            "Sistema de agendamento",
            "Painel administrativo",
            "SEO avançado",
            "Integrações",
            "Estrutura para crescimento",
        ],
    },
}


PAID_TRAFFIC_PLAN_META: dict[str, dict[str, Any]] = {
    "Paid Traffic Start": {
        "slug": "start",
        "ideal_for": "Businesses starting with paid ads and looking for their first clients",
        "includes": [
            "Meta Ads management (Facebook & Instagram)",
            "1 campaign setup (lead generation)",
            "Up to 2 ad sets",
            "Audience targeting strategy",
            "Campaign setup and monitoring",
            "Basic monthly report",
        ],
        "goal": "Generate first leads and validate the business",
    },
    "Paid Traffic Growth": {
        "slug": "growth",
        "ideal_for": "Businesses ready to grow and increase customer flow",
        "includes": [
            "Full Meta Ads management",
            "Up to 3 campaigns (lead generation, engagement, remarketing)",
            "Up to 5 ad sets",
            "A/B testing",
            "Weekly optimization",
            "Performance analysis and improvements",
            "Detailed report with insights",
        ],
        "goal": "Increase conversions and scale results",
    },
    "Paid Traffic Premium": {
        "slug": "premium",
        "ideal_for": "Businesses that want consistent leads and strong market presence",
        "includes": [
            "Advanced traffic management (Meta Ads + Google Ads)",
            "Full funnel strategy",
            "Advanced remarketing",
            "Custom strategy development",
            "Continuous optimization",
            "Performance tracking and scaling",
            "Full reports + strategy call",
            "Priority support",
        ],
        "goal": "Maximize revenue and scale aggressively",
    },
}
