"""Multi-tenant org resolution (USA vs Brazil)."""

from __future__ import annotations

ORG_INNEXAR_US = "innexar"
ORG_INNEXAR_BR = "innexar-br"

BR_HOST_MARKERS = (
    "innexar.com.br",
    "portal.innexar.com.br",
    "app.innexar.com.br",
    "api.innexar.com.br",
)


def normalize_org_id(org_id: str | None, default: str = ORG_INNEXAR_US) -> str:
    """Return a known org id or default."""
    if not org_id:
        return default
    value = org_id.strip().lower()
    if value in (ORG_INNEXAR_US, ORG_INNEXAR_BR):
        return value
    return default


def staff_org_id(org_id: str | None) -> str:
    """Org id for authenticated workspace staff."""
    return normalize_org_id(org_id, default=ORG_INNEXAR_US)


def is_brazil_request(origin: str | None, referer: str | None) -> bool:
    """True when request comes from a Brazil frontend host."""
    for raw in (origin or "", referer or ""):
        lower = raw.lower()
        if any(marker in lower for marker in BR_HOST_MARKERS):
            return True
    return False


def resolve_public_org(
    *,
    origin: str | None = None,
    referer: str | None = None,
    locale: str | None = None,
    explicit_org: str | None = None,
    x_org_id: str | None = None,
) -> str:
    """Pick org for public routes (checkout, catalog, web-to-lead)."""
    for candidate in (explicit_org, x_org_id):
        if candidate:
            normalized = normalize_org_id(candidate, default="")
            if normalized in (ORG_INNEXAR_US, ORG_INNEXAR_BR):
                return normalized

    if is_brazil_request(origin, referer):
        return ORG_INNEXAR_BR

    loc = (locale or "").strip().lower()
    if loc == "pt" and is_brazil_request(origin, referer):
        return ORG_INNEXAR_BR

    return ORG_INNEXAR_US


def default_currency_for_org(org_id: str) -> str:
    return "BRL" if org_id == ORG_INNEXAR_BR else "USD"


def region_code_for_org(org_id: str) -> str:
    """ISO-style region code for CRM/extra_data."""
    return "BR" if org_id == ORG_INNEXAR_BR else "US"


def region_label_for_org(org_id: str) -> str:
    """Human-readable region label."""
    return "Brasil" if org_id == ORG_INNEXAR_BR else "Estados Unidos"
