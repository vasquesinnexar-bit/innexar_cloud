"""Validador central de venda (P1.4A): produto pode ser vendido neste canal?

Usado por website (checkout), Portal (purchase) e Workspace (add-item).
Retorna lista de issues; vazia = vendável. Nunca levanta exceção.
"""

from __future__ import annotations


def validate_product_for_sale(
    product,
    plan=None,
    *,
    channel: str,
    customer=None,
    domain: str | None = None,
) -> list[dict]:
    """Valida configuração comercial + entrega. Canais: website|portal|admin."""
    from app.modules.fulfillment.registry import (
        get_provisioner,
        handler_spec,
        resolve_handler,
    )

    issues: list[dict] = []

    def issue(code: str, message: str) -> None:
        issues.append({"code": code, "message": message})

    if product is None:
        issue("no_product", "Produto não encontrado.")
        return issues
    if not getattr(product, "is_active", False):
        issue("inactive", "Produto inativo.")
    if channel == "website" and not getattr(product, "website_sellable", False):
        issue("channel_closed", "Produto não liberado para venda no site.")
    if channel == "portal" and not getattr(product, "portal_sellable", False):
        issue("channel_closed", "Produto não liberado para venda no Portal.")
    if channel == "admin" and not getattr(product, "admin_assignable", True):
        issue("channel_closed", "Produto não atribuível manualmente.")

    explicit = (getattr(product, "fulfillment_handler", None) or "").strip()
    if explicit and get_provisioner(explicit).key != explicit:
        issue("unknown_handler", f"Handler '{explicit}' não registrado.")
        return issues
    strategy, handler = resolve_handler(product)
    spec = handler_spec(handler)
    if spec is None:
        issue("unknown_handler", "Handler de provisionamento desconhecido.")
        return issues

    if plan is not None:
        if getattr(plan, "product_id", None) != product.id:
            issue("plan_mismatch", "Plano não pertence ao produto.")
        else:
            amount = getattr(plan, "amount", None)
            if amount is None:
                issue("no_price", "Plano sem preço configurado.")
            currency = (getattr(plan, "currency", None) or "").upper()
            if not currency:
                issue("no_currency", "Plano sem moeda configurada.")
            if customer is not None:
                from app.modules.marketplace.service import customer_currency

                if currency and currency != customer_currency(customer):
                    issue(
                        "currency_mismatch",
                        "Moeda do plano incompatível com a do cliente.",
                    )
    if spec.get("requires_domain_at_checkout") and not (domain or "").strip():
        issue("domain_required", "Domínio obrigatório para este produto.")
    return issues


def is_sellable(*args, **kwargs) -> bool:
    return not validate_product_for_sale(*args, **kwargs)
