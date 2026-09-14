"""Resolve org for public product catalog requests."""

from fastapi import Request

from app.core.org import resolve_public_org


def resolve_products_org(request: Request, locale: str | None = None) -> str:
    return resolve_public_org(
        origin=request.headers.get("origin"),
        referer=request.headers.get("referer"),
        locale=locale,
        x_org_id=request.headers.get("x-org-id"),
    )
