"""Provider capabilities por método (Fase 3). Nem todo provider faz tudo."""

from app.modules.billing.enums import PaymentMethod, PaymentProvider

PROVIDER_CAPABILITIES: dict[str, frozenset[str]] = {
    PaymentProvider.MERCADOPAGO.value: frozenset(
        {
            PaymentMethod.PIX.value,
            PaymentMethod.BOLETO.value,
            PaymentMethod.CARD.value,
            PaymentMethod.CHECKOUT_LINK.value,
            PaymentMethod.SUBSCRIPTION.value,
        }
    ),
    PaymentProvider.STRIPE.value: frozenset(
        {
            PaymentMethod.CARD.value,
            PaymentMethod.CHECKOUT_LINK.value,
            PaymentMethod.SUBSCRIPTION.value,
        }
    ),
}

METHOD_CURRENCIES: dict[str, frozenset[str]] = {
    PaymentMethod.PIX.value: frozenset({"BRL"}),
    PaymentMethod.BOLETO.value: frozenset({"BRL"}),
}


def supports(provider: str, method: str) -> bool:
    return method in PROVIDER_CAPABILITIES.get((provider or "").lower(), frozenset())


def available_methods(provider: str, currency: str) -> list[str]:
    """Métodos ofertáveis para provider+moeda (Portal só mostra compatíveis)."""
    cur = (currency or "USD").upper()
    return [
        m
        for m in sorted(PROVIDER_CAPABILITIES.get((provider or "").lower(), set()))
        if cur in METHOD_CURRENCIES.get(m, frozenset({cur}))
    ]
