"""P1.4A validador central de venda: 12 testes (função pura, sem DB)."""

from types import SimpleNamespace

from app.modules.billing.product_validation import (
    is_sellable,
    validate_product_for_sale,
)


def _product(**kw):
    base = {
        "id": 1,
        "is_active": True,
        "website_sellable": True,
        "portal_sellable": True,
        "admin_assignable": True,
        "fulfillment_handler": None,
        "fulfillment_strategy": None,
        "provisioning_type": None,
        "slug": None,
        "category": None,
    }
    base.update(kw)
    return SimpleNamespace(**base)


def _plan(**kw):
    base = {"id": 10, "product_id": 1, "amount": 100.0, "currency": "BRL"}
    base.update(kw)
    return SimpleNamespace(**base)


def _codes(issues):
    return [i["code"] for i in issues]


def test_ok_website_manual():
    assert validate_product_for_sale(_product(), _plan(), channel="website") == []


def test_no_product():
    issues = validate_product_for_sale(None, None, channel="website")
    assert _codes(issues) == ["no_product"]


def test_inactive():
    issues = validate_product_for_sale(
        _product(is_active=False), None, channel="website"
    )
    assert "inactive" in _codes(issues)


def test_website_channel_closed():
    issues = validate_product_for_sale(
        _product(website_sellable=False), None, channel="website"
    )
    assert "channel_closed" in _codes(issues)


def test_portal_channel_closed():
    issues = validate_product_for_sale(
        _product(portal_sellable=False), None, channel="portal"
    )
    assert "channel_closed" in _codes(issues)


def test_admin_channel_closed():
    issues = validate_product_for_sale(
        _product(admin_assignable=False), None, channel="admin"
    )
    assert "channel_closed" in _codes(issues)


def test_unknown_explicit_handler():
    issues = validate_product_for_sale(
        _product(fulfillment_handler="foguete"), None, channel="admin"
    )
    assert "unknown_handler" in _codes(issues)


def test_plan_mismatch():
    issues = validate_product_for_sale(
        _product(), _plan(product_id=999), channel="admin"
    )
    assert "plan_mismatch" in _codes(issues)


def test_no_price():
    issues = validate_product_for_sale(_product(), _plan(amount=None), channel="admin")
    assert "no_price" in _codes(issues)


def test_currency_mismatch():
    cust = SimpleNamespace(currency="USD", org_id="innexar")
    issues = validate_product_for_sale(
        _product(), _plan(currency="BRL"), channel="portal", customer=cust
    )
    assert "currency_mismatch" in _codes(issues)


def test_hestia_requires_domain_at_checkout():
    p = _product(provisioning_type="hestia_hosting")
    issues = validate_product_for_sale(p, None, channel="website", domain=None)
    assert "domain_required" in _codes(issues)
    ok = validate_product_for_sale(p, None, channel="website", domain="x.com")
    assert "domain_required" not in _codes(ok)


def test_is_sellable_helper():
    assert is_sellable(_product(), _plan(), channel="website") is True
    assert is_sellable(None, None, channel="website") is False
