"""ProvisioningRegistry (P0): resolve handler explícito, sem fuzzy de nome.

Ordem: Product.fulfillment_handler (explícito) → legado (provisioning_type,
slug/categoria de e-mail) → manual. NUNCA por substring de nome.
"""

from __future__ import annotations

from typing import Protocol

from app.modules.fulfillment.enums import FulfillmentHandler, FulfillmentStrategy


class ProvisionResult:
    """Resultado máquina de um handler (sem exceção para casos esperados)."""

    def __init__(
        self,
        *,
        ok: bool,
        waiting_input: str | None = None,
        retryable: bool = False,
        error: str | None = None,
        step: str | None = None,
        progress: int = 0,
        meta: dict | None = None,
    ) -> None:
        self.ok = ok
        self.waiting_input = waiting_input
        self.retryable = retryable
        self.error = error
        self.step = step
        self.progress = progress
        self.meta = meta or {}


class ProvisionContext:
    """Tudo que um handler precisa (montado pela facade, sem queries extras)."""

    def __init__(
        self,
        *,
        db,
        fulfillment,
        invoice,
        subscription=None,
        product=None,
        price_plan=None,
        customer=None,
        org_id: str = "innexar",
        actor_type: str = "system",
        actor_id: str | None = None,
    ) -> None:
        self.db = db
        self.fulfillment = fulfillment
        self.invoice = invoice
        self.subscription = subscription
        self.product = product
        self.price_plan = price_plan
        self.customer = customer
        self.org_id = org_id
        self.actor_type = actor_type
        self.actor_id = actor_id


class Provisioner(Protocol):
    """Interface estável dos handlers."""

    key: str

    async def provision(
        self, ctx: ProvisionContext
    ) -> ProvisionResult: ...  # pragma: no cover


DEFAULT_STRATEGY: dict[str, str] = {
    FulfillmentHandler.MAIL.value: FulfillmentStrategy.GUIDED.value,
    FulfillmentHandler.HESTIA.value: FulfillmentStrategy.GUIDED.value,
    FulfillmentHandler.PROJECT.value: FulfillmentStrategy.PROJECT.value,
    FulfillmentHandler.MANUAL.value: FulfillmentStrategy.MANUAL.value,
}

_LEGACY_BY_TYPE: dict[str, tuple[str, str]] = {
    "hestia_hosting": (
        FulfillmentStrategy.GUIDED.value,
        FulfillmentHandler.HESTIA.value,
    ),
    "site_delivery": (
        FulfillmentStrategy.PROJECT.value,
        FulfillmentHandler.PROJECT.value,
    ),
}


def resolve_handler(product) -> tuple[str, str]:
    """(strategy, handler_key) explícitos. product pode ser None → manual."""
    if product is not None:
        explicit = (getattr(product, "fulfillment_handler", None) or "").strip()
        if explicit:
            strategy = (getattr(product, "fulfillment_strategy", None) or "").strip()
            return (strategy or DEFAULT_STRATEGY.get(explicit, "manual"), explicit)
        ptype = (getattr(product, "provisioning_type", None) or "").lower()
        if ptype in _LEGACY_BY_TYPE:
            return _LEGACY_BY_TYPE[ptype]
        slug = (getattr(product, "slug", None) or "").lower()
        category = (getattr(product, "category", None) or "").lower()
        if slug == "professional-email" or category == "email":
            return (FulfillmentStrategy.GUIDED.value, FulfillmentHandler.MAIL.value)
    return (FulfillmentStrategy.MANUAL.value, FulfillmentHandler.MANUAL.value)


_REGISTRY: dict[str, type] = {}


HANDLER_SPECS: dict[str, dict] = {
    # Especificação tipada por handler (P1.4A): dependências, onboarding,
    # critérios de ativação. Substitui ifs espalhados por produto.
    FulfillmentHandler.MAIL.value: {
        "requires_domain": True,  # via onboarding (não no checkout)
        "requires_domain_at_checkout": False,
        "requires_briefing": False,
        "onboarding": "professional_email",
        "activation": "domínio verificado + DNS válido + ≥1 mailbox ativa + provider",
    },
    FulfillmentHandler.HESTIA.value: {
        "requires_domain": True,
        "requires_domain_at_checkout": True,
        "requires_briefing": False,
        "onboarding": "manual",
        "activation": "user + domínio + mail criados no painel",
    },
    FulfillmentHandler.PROJECT.value: {
        "requires_domain": False,
        "requires_domain_at_checkout": False,
        "requires_briefing": True,
        "onboarding": "website_project",
        "activation": "projeto criado; ACTIVE só após produção manual",
    },
    FulfillmentHandler.MANUAL.value: {
        "requires_domain": False,
        "requires_domain_at_checkout": False,
        "requires_briefing": False,
        "onboarding": "manual",
        "activation": "acompanhamento manual (MANUAL_REVIEW)",
    },
}


def handler_spec(handler_key: str | None) -> dict | None:
    """Spec do handler ou None se desconhecido (venda bloqueada)."""
    if not handler_key:
        return None
    return HANDLER_SPECS.get(handler_key)


def register(key: str, cls: type) -> None:
    _REGISTRY[key] = cls


def get_provisioner(key: str):
    """Instancia o handler; manual como fallback seguro (nunca None)."""
    from app.modules.fulfillment import handlers as _h

    _h.register_all()
    cls = _REGISTRY.get(key) or _REGISTRY[FulfillmentHandler.MANUAL.value]
    return cls()
