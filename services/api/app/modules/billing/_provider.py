"""Payment provider resolution from IntegrationConfig or env. Internal use by billing services.

Fase 1 — ordem de resolução do gateway (nunca por domínio):
1. billing_provider explícito (parâmetro ou Customer.billing_provider)
2. fallback legado pela currency (BRL → mercadopago, demais → stripe)
"""

import os

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.encryption import decrypt_value
from app.core.org import ORG_INNEXAR_BR
from app.models.customer import Customer
from app.models.integration_config import IntegrationConfig
from app.modules.billing.enums import PaymentProvider
from app.providers.payments.mercadopago import MercadoPagoProvider
from app.providers.payments.stripe import StripeProvider


def _mp_env_token(org_id: str) -> str:
    """Env fallback for Mercado Pago access token (org-specific when possible)."""
    if org_id == ORG_INNEXAR_BR:
        return (
            os.environ.get("MERCADOPAGO_ACCESS_TOKEN")
            or os.environ.get("MP_ACCESS_TOKEN")
            or ""
        ).strip()
    return (
        os.environ.get("MP_ACCESS_TOKEN")
        or os.environ.get("MERCADOPAGO_ACCESS_TOKEN")
        or ""
    ).strip()


def resolve_provider_name(
    billing_provider: str | None = None,
    currency: str | None = None,
) -> str:
    """Fase 1: nome do provider sem tocar em integrações.

    1. billing_provider explícito válido (stripe|mercadopago) vence;
    2. senão fallback legado pela currency (BRL → mercadopago, demais → stripe).
    """
    if billing_provider:
        normalized = billing_provider.strip().lower()
        if normalized in (
            PaymentProvider.STRIPE.value,
            PaymentProvider.MERCADOPAGO.value,
        ):
            return normalized
    return "mercadopago" if (currency or "USD").upper() == "BRL" else "stripe"


async def get_payment_provider(
    db: AsyncSession,
    customer_id: int,
    org_id: str,
    currency: str,
    mode: str = "test",
    billing_provider: str | None = None,
) -> StripeProvider | MercadoPagoProvider:
    """Resolve provider from IntegrationConfig (customer → tenant → global), else env fallback.

    Fase 1: billing_provider explícito (parâmetro) ou Customer.billing_provider
    tem precedência; NULL mantém o fallback legado pela currency.
    """
    if billing_provider is None and customer_id:
        row = await db.execute(
            select(Customer.billing_provider).where(Customer.id == customer_id)
        )
        stored = row.scalar_one_or_none()
        if stored:
            billing_provider = stored
    provider_name = resolve_provider_name(billing_provider, currency)
    key_name = "access_token" if provider_name == "mercadopago" else "secret_key"

    base_filters = [
        IntegrationConfig.provider == provider_name,
        IntegrationConfig.key == key_name,
        IntegrationConfig.enabled.is_(True),
        IntegrationConfig.mode == mode,
    ]

    for scope in ["customer", "tenant", "global"]:
        if scope == "customer":
            q = (
                select(IntegrationConfig)
                .where(
                    IntegrationConfig.scope == "customer",
                    IntegrationConfig.customer_id == customer_id,
                    *base_filters,
                )
                .limit(1)
            )
        elif scope == "tenant":
            q = (
                select(IntegrationConfig)
                .where(
                    IntegrationConfig.scope == "tenant",
                    IntegrationConfig.org_id == org_id,
                    IntegrationConfig.customer_id.is_(None),
                    *base_filters,
                )
                .limit(1)
            )
        else:
            q = (
                select(IntegrationConfig)
                .where(
                    IntegrationConfig.scope == "global",
                    IntegrationConfig.customer_id.is_(None),
                    *base_filters,
                )
                .limit(1)
            )
        r = await db.execute(q)
        cfg = r.scalar_one_or_none()
        if cfg and cfg.value_encrypted:
            secret = decrypt_value(cfg.value_encrypted)
            if secret:
                if provider_name == "stripe":
                    return StripeProvider(api_key=secret)
                return MercadoPagoProvider(access_token=secret)

    if provider_name == "mercadopago":
        env_token = _mp_env_token(org_id)
        if env_token:
            return MercadoPagoProvider(access_token=env_token)
        return MercadoPagoProvider()
    return StripeProvider()
