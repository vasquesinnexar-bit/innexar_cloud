"""Workspace reps routes: representatives directory. Thin layer: validate → call service → return response."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth_staff import get_current_staff
from app.core.rbac import RequirePermission
from app.core.router_org import router_org_list_filter, router_org_write
from app.models.user import User
from app.modules.reps.schemas import (
    RepresentativeCreate,
    RepresentativeResponse,
    RepresentativeUpdate,
)
from app.modules.reps.service import RepresentativeService

router = APIRouter(prefix="/reps", tags=["workspace-reps"])


def get_representative_service(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RepresentativeService:
    """Dependency: representative service with repository layer."""
    return RepresentativeService(db)


@router.get("/me", response_model=RepresentativeResponse | None)
async def get_my_representative_profile(
    service: Annotated[RepresentativeService, Depends(get_representative_service)],
    current: Annotated[User, Depends(get_current_staff)],
) -> RepresentativeResponse | None:
    """Return the Representative profile linked to the current staff user, if any."""
    rep = await service.get_representative_for_user(current.id)
    if not rep:
        return None
    return RepresentativeResponse.model_validate(rep)


@router.get("", response_model=list[RepresentativeResponse])
async def list_representatives(
    service: Annotated[RepresentativeService, Depends(get_representative_service)],
    _: Annotated[User, Depends(RequirePermission("reps:read"))],
    org_id: str | None = None,
    status: str | None = None,
) -> list[RepresentativeResponse]:
    """List representatives (workspace). Optional org_id filter (Brasil vs USA)."""
    return await service.list_representatives(
        org_id=router_org_list_filter(org_id), status=status
    )


@router.post("", response_model=RepresentativeResponse, status_code=status.HTTP_201_CREATED)
async def create_representative(
    body: RepresentativeCreate,
    service: Annotated[RepresentativeService, Depends(get_representative_service)],
    current: Annotated[User, Depends(RequirePermission("reps:write"))],
    org_id: str | None = None,
) -> RepresentativeResponse:
    """Create representative profile."""
    return await service.create_representative(body, router_org_write(current, org_id))


@router.get("/{rep_id}", response_model=RepresentativeResponse)
async def get_representative(
    rep_id: int,
    service: Annotated[RepresentativeService, Depends(get_representative_service)],
    _: Annotated[User, Depends(RequirePermission("reps:read"))],
    org_id: str | None = None,
) -> RepresentativeResponse:
    """Get representative by id."""
    result = await service.get_representative(
        rep_id, org_id=router_org_list_filter(org_id)
    )
    if not result:
        raise HTTPException(status_code=404, detail="Representative not found")
    return result


@router.patch("/{rep_id}", response_model=RepresentativeResponse)
async def update_representative(
    rep_id: int,
    body: RepresentativeUpdate,
    service: Annotated[RepresentativeService, Depends(get_representative_service)],
    _: Annotated[User, Depends(RequirePermission("reps:write"))],
    org_id: str | None = None,
) -> RepresentativeResponse:
    """Update representative."""
    result = await service.update_representative(
        rep_id, body, org_id=router_org_list_filter(org_id)
    )
    if not result:
        raise HTTPException(status_code=404, detail="Representative not found")
    return result


@router.delete("/{rep_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_representative(
    rep_id: int,
    service: Annotated[RepresentativeService, Depends(get_representative_service)],
    _: Annotated[User, Depends(RequirePermission("reps:write"))],
    org_id: str | None = None,
) -> None:
    """Delete representative."""
    existed = await service.delete_representative(
        rep_id, org_id=router_org_list_filter(org_id)
    )
    if not existed:
        raise HTTPException(status_code=404, detail="Representative not found")
