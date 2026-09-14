"""Workspace config: Hestia settings (get, update)."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.router_org import router_org_write
from app.core.rbac import RequirePermission
from app.models.user import User
from app.repositories.hestia_settings_repository import (
    HestiaSettingsRepository,
)

from .hestia_config_service import SystemHestiaConfigService
from .schemas import HestiaSettingsResponse, HestiaSettingsUpdate

hestia_config_router = APIRouter(
    prefix="/config/hestia", tags=["workspace-config-hestia"]
)


def get_hestia_config_service(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SystemHestiaConfigService:
    return SystemHestiaConfigService(
        hestia_repo=HestiaSettingsRepository(db),
    )


@hestia_config_router.get("/settings", response_model=HestiaSettingsResponse)
async def get_hestia_settings(
    current: Annotated[User, Depends(RequirePermission("config:read"))],
    service: Annotated[SystemHestiaConfigService, Depends(get_hestia_config_service)],
    org_id: str | None = None,
) -> HestiaSettingsResponse:
    """Get Hestia provisioning settings. Creates default if missing."""
    return await service.get_or_create_settings(router_org_write(current, org_id))


@hestia_config_router.put("/settings", response_model=HestiaSettingsResponse)
async def update_hestia_settings(
    body: HestiaSettingsUpdate,
    current: Annotated[User, Depends(RequirePermission("config:write"))],
    service: Annotated[SystemHestiaConfigService, Depends(get_hestia_config_service)],
    org_id: str | None = None,
) -> HestiaSettingsResponse:
    """Update Hestia provisioning settings."""
    return await service.update_settings(router_org_write(current, org_id), body)
