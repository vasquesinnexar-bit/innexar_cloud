"""System integration config service: list, create, update, test."""

import json
import smtplib
from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import log_audit
from app.core.encryption import decrypt_value, encrypt_value, mask_value
from app.core.org import ORG_INNEXAR_BR, ORG_INNEXAR_US
from app.core.router_org import router_org_list_filter, router_org_write
from app.models.integration_config import IntegrationConfig
from app.models.user import User
from app.repositories.integration_config_repository import (
    IntegrationConfigRepository,
)

from .schemas import (
    IntegrationConfigCreate,
    IntegrationConfigResponse,
    IntegrationConfigUpdate,
    IntegrationTestResponse,
)


def _config_to_response(c: IntegrationConfig) -> IntegrationConfigResponse:
    """Build response with value masked (never return decrypted)."""
    plain = decrypt_value(c.value_encrypted)
    return IntegrationConfigResponse(
        id=c.id,
        org_id=c.org_id,
        scope=c.scope,
        customer_id=c.customer_id,
        provider=c.provider,
        key=c.key,
        value_masked=mask_value(plain),
        mode=c.mode,
        enabled=c.enabled,
        last_tested_at=c.last_tested_at,
        created_at=c.created_at,
        updated_at=c.updated_at,
    )


def _staff_can_access_config(c: IntegrationConfig) -> bool:
    return c.org_id in (ORG_INNEXAR_US, ORG_INNEXAR_BR)


class SystemIntegrationService:
    """Service for workspace integration config (list, create, update, test)."""

    def __init__(
        self,
        integration_repo: IntegrationConfigRepository,
        db: AsyncSession,
    ) -> None:
        self._repo = integration_repo
        self._db = db

    async def list_integrations(
        self, current: User, org_id: str | None = None
    ) -> list[IntegrationConfigResponse]:
        """List integration configs for org filter (value masked)."""
        org_filter = router_org_list_filter(org_id)
        if org_filter is None:
            configs = await self._repo.list_all()
        else:
            configs = await self._repo.list_by_org(org_filter)
        return [_config_to_response(c) for c in configs]

    async def create_integration(
        self, body: IntegrationConfigCreate, current: User, org_id: str | None = None
    ) -> IntegrationConfigResponse:
        """Create integration config (value stored encrypted)."""
        encrypted = encrypt_value(body.value)
        if encrypted is None:
            raise HTTPException(status_code=500, detail="Encryption not available")
        target_org = router_org_write(current, org_id)
        c = IntegrationConfig(
            org_id=target_org,
            scope=body.scope,
            customer_id=body.customer_id,
            provider=body.provider,
            key=body.key,
            value_encrypted=encrypted,
            mode=body.mode,
            enabled=body.enabled,
        )
        self._repo.add(c)
        await self._repo.flush_and_refresh(c)
        await log_audit(
            self._db,
            entity="integration_config",
            entity_id=str(c.id),
            action="create",
            actor_type="staff",
            actor_id=str(current.id),
            org_id=target_org,
        )
        return _config_to_response(c)

    async def update_integration(
        self, config_id: int, body: IntegrationConfigUpdate, current: User
    ) -> IntegrationConfigResponse:
        """Update integration config (value encrypted if provided)."""
        c = await self._repo.get_by_id(config_id)
        if not c:
            raise HTTPException(status_code=404, detail="Integration config not found")
        if not _staff_can_access_config(c):
            raise HTTPException(status_code=404, detail="Integration config not found")
        if body.value is not None:
            enc = encrypt_value(body.value)
            if enc is None:
                raise HTTPException(status_code=500, detail="Encryption not available")
            c.value_encrypted = enc
        if body.mode is not None:
            c.mode = body.mode
        if body.enabled is not None:
            c.enabled = body.enabled
        await self._repo.flush_and_refresh(c)
        await log_audit(
            self._db,
            entity="integration_config",
            entity_id=str(c.id),
            action="update",
            actor_type="staff",
            actor_id=str(current.id),
            org_id=c.org_id or "innexar",
        )
        return _config_to_response(c)

    async def test_integration(
        self, config_id: int, current: User
    ) -> IntegrationTestResponse:
        """Test integration (Stripe, SMTP, Hestia); updates last_tested_at on success."""
        c = await self._repo.get_by_id(config_id)
        if not c:
            raise HTTPException(status_code=404, detail="Integration config not found")
        if not _staff_can_access_config(c):
            raise HTTPException(status_code=404, detail="Integration config not found")
        plain = decrypt_value(c.value_encrypted) if c.value_encrypted else None
        provider = (c.provider or "").lower()
        try:
            if provider == "stripe":
                if not plain:
                    return IntegrationTestResponse(
                        ok=False, error="No secret key configured"
                    )
                try:
                    import stripe as stripe_lib
                except ImportError:
                    return IntegrationTestResponse(
                        ok=False, error="stripe package not installed"
                    )
                stripe_lib.api_key = plain
                stripe_lib.Balance.retrieve()
                c.last_tested_at = datetime.now(UTC)
                await self._repo.flush_and_refresh(c)
                return IntegrationTestResponse(ok=True, message="Stripe connection OK")
            if provider == "smtp":
                if not plain:
                    return IntegrationTestResponse(
                        ok=False, error="No SMTP config configured"
                    )
                try:
                    data = json.loads(plain)
                except (json.JSONDecodeError, TypeError):
                    return IntegrationTestResponse(
                        ok=False, error="Invalid SMTP config JSON"
                    )
                host = data.get("host") or "localhost"
                port = int(data.get("port") or 587)
                user = data.get("user") or ""
                password = data.get("password") or ""
                with smtplib.SMTP(host, port, timeout=10) as server:
                    server.starttls()
                    if user and password:
                        server.login(user, password)
                c.last_tested_at = datetime.now(UTC)
                await self._repo.flush_and_refresh(c)
                return IntegrationTestResponse(ok=True, message="SMTP connection OK")
            if provider == "mercadopago":
                return IntegrationTestResponse(
                    ok=False, error="Test not implemented for Mercado Pago"
                )
            if provider == "hestia":
                if not plain:
                    return IntegrationTestResponse(
                        ok=False, error="No Hestia config configured"
                    )
                try:
                    data = json.loads(plain)
                except (json.JSONDecodeError, TypeError):
                    return IntegrationTestResponse(
                        ok=False, error="Invalid Hestia config JSON"
                    )
                from app.providers.hestia.client import HestiaClient

                base_url = (data.get("base_url") or "").rstrip("/")
                access_key = data.get("access_key") or ""
                secret_key = data.get("secret_key") or ""
                if not base_url or not access_key or not secret_key:
                    return IntegrationTestResponse(
                        ok=False,
                        error="Missing base_url, access_key or secret_key",
                    )
                client = HestiaClient(
                    base_url=base_url,
                    access_key=access_key,
                    secret_key=secret_key,
                )
                client.request("v-list-users", returncode=True)
                c.last_tested_at = datetime.now(UTC)
                await self._repo.flush_and_refresh(c)
                return IntegrationTestResponse(ok=True, message="Hestia connection OK")
            return IntegrationTestResponse(
                ok=False, error=f"Unknown provider: {provider}"
            )
        except Exception as e:
            err_msg = str(e)
            if provider == "hestia" and (
                "522" in err_msg
                or "timed out" in err_msg.lower()
                or "connection" in err_msg.lower()
            ):
                err_msg = (
                    f"{err_msg}. Verifique: URL acessível a partir do backend "
                    "(porta típica 8083), rede/firewall e Cloudflare (se aplicável). "
                    "Veja docs/SETUP.md#erro-522-na-integração-hestia."
                )
            return IntegrationTestResponse(ok=False, error=err_msg)
