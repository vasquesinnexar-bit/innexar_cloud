"""Cloudflare por cliente (P1.3): conexão scoped, nunca token global.

Armazena em IntegrationConfig (scope=customer, criptografado). Token nunca
volta ao frontend depois de salvo; nunca entra em log/audit payload.
"""

from __future__ import annotations

import json
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import log_audit
from app.core.datetime_utils import utc_now
from app.core.encryption import decrypt_value, encrypt_value
from app.models.integration_config import IntegrationConfig
from app.providers.cloudflare.client import CloudflareClient

logger = logging.getLogger(__name__)

PROVIDER = "cloudflare"
KEY = "customer_api_credentials"


async def get_customer_client(
    db: AsyncSession, customer_id: int
) -> tuple[CloudflareClient | None, IntegrationConfig | None]:
    """Client da CONTA DO CLIENTE (nunca o token global/org da Innexar)."""
    r = await db.execute(
        select(IntegrationConfig).where(
            IntegrationConfig.provider == PROVIDER,
            IntegrationConfig.key == KEY,
            IntegrationConfig.scope == "customer",
            IntegrationConfig.customer_id == customer_id,
            IntegrationConfig.enabled.is_(True),
        )
    )
    cfg = r.scalar_one_or_none()
    if not cfg or not cfg.value_encrypted:
        return None, None
    try:
        data = json.loads(decrypt_value(cfg.value_encrypted) or "{}")
    except (TypeError, ValueError):
        return None, None
    token = (data.get("api_token") or "").strip()
    if not token:
        return None, None
    return (
        CloudflareClient(
            api_token=token, account_id=(data.get("account_id") or "").strip() or None
        ),
        cfg,
    )


async def connection_status(db: AsyncSession, customer_id: int) -> dict:
    """Status sem expor segredo."""
    r = await db.execute(
        select(IntegrationConfig).where(
            IntegrationConfig.provider == PROVIDER,
            IntegrationConfig.key == KEY,
            IntegrationConfig.scope == "customer",
            IntegrationConfig.customer_id == customer_id,
        )
    )
    cfg = r.scalar_one_or_none()
    if not cfg:
        return {"connected": False}
    return {
        "connected": bool(cfg.enabled and cfg.value_encrypted),
        "account_id": _account_id_of(cfg),
        "mode": cfg.mode,
        "updated_at": cfg.updated_at,
    }


def _account_id_of(cfg: IntegrationConfig) -> str | None:
    try:
        data = json.loads(decrypt_value(cfg.value_encrypted) or "{}")
        return (data.get("account_id") or "").strip() or None
    except (TypeError, ValueError):
        return None


async def save_connection(
    db: AsyncSession,
    *,
    customer_id: int,
    org_id: str,
    api_token: str,
    account_id: str | None,
    actor_type: str,
    actor_id: str | None,
) -> dict:
    """Valida o token (1 chamada read-only) e salva criptografado."""
    api_token = (api_token or "").strip()
    if len(api_token) < 20:
        raise ValueError("token inválido")
    client = CloudflareClient(
        api_token=api_token, account_id=(account_id or "").strip() or None
    )
    try:
        import anyio

        zones = await anyio.to_thread.run_sync(client.list_zones)
    except Exception as e:  # noqa: BLE001
        raise ValueError(f"token rejeitado pela Cloudflare: {e}") from e
    _ = zones
    value = encrypt_value(
        json.dumps(
            {"api_token": api_token, "account_id": (account_id or "").strip() or None}
        )
    )
    r = await db.execute(
        select(IntegrationConfig).where(
            IntegrationConfig.provider == PROVIDER,
            IntegrationConfig.key == KEY,
            IntegrationConfig.scope == "customer",
            IntegrationConfig.customer_id == customer_id,
        )
    )
    cfg = r.scalar_one_or_none()
    if cfg:
        cfg.value_encrypted = value
        cfg.enabled = True
        cfg.mode = "live"
        cfg.updated_at = utc_now()
    else:
        cfg = IntegrationConfig(
            org_id=org_id,
            scope="customer",
            customer_id=customer_id,
            provider=PROVIDER,
            key=KEY,
            value_encrypted=value,
            mode="live",
            enabled=True,
        )
        db.add(cfg)
    await db.flush()
    await log_audit(
        db,
        entity="integration",
        entity_id=str(cfg.id),
        action="dns_connection_created",
        actor_type=actor_type,
        actor_id=actor_id,
        org_id=org_id,
        payload={"provider": PROVIDER},  # sem segredo
    )
    await db.flush()
    return await connection_status(db, customer_id)


async def revoke_connection(
    db: AsyncSession,
    *,
    customer_id: int,
    org_id: str,
    actor_type: str,
    actor_id: str | None,
) -> None:
    r = await db.execute(
        select(IntegrationConfig).where(
            IntegrationConfig.provider == PROVIDER,
            IntegrationConfig.key == KEY,
            IntegrationConfig.scope == "customer",
            IntegrationConfig.customer_id == customer_id,
        )
    )
    cfg = r.scalar_one_or_none()
    if cfg:
        cfg.value_encrypted = None
        cfg.enabled = False
        await log_audit(
            db,
            entity="integration",
            entity_id=str(cfg.id),
            action="dns_connection_revoked",
            actor_type=actor_type,
            actor_id=actor_id,
            org_id=org_id,
            payload={"provider": PROVIDER},
        )
        await db.flush()
