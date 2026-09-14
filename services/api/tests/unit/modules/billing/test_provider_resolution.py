"""Fase 1: resolução de billing provider (explícito > fallback por moeda)."""

from app.modules.billing._provider import resolve_provider_name


def test_explicit_stripe_wins_over_brl():
    assert resolve_provider_name("stripe", "BRL") == "stripe"


def test_explicit_mercadopago_wins_over_usd():
    assert resolve_provider_name("mercadopago", "USD") == "mercadopago"


def test_null_provider_falls_back_to_currency_brl():
    assert resolve_provider_name(None, "BRL") == "mercadopago"
    assert resolve_provider_name("", "BRL") == "mercadopago"


def test_null_provider_falls_back_to_currency_usd():
    assert resolve_provider_name(None, "USD") == "stripe"
    assert resolve_provider_name(None, None) == "stripe"


def test_invalid_explicit_ignored():
    assert resolve_provider_name("paypal", "BRL") == "mercadopago"
    assert resolve_provider_name("pix", "USD") == "stripe"


def test_case_insensitive():
    assert resolve_provider_name("Stripe", "BRL") == "stripe"
    assert resolve_provider_name(None, "brl") == "mercadopago"
