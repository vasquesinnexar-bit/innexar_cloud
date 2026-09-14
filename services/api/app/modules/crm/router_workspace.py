"""Workspace CRM routes: contacts. Thin layer: validate → call service → return response."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.rbac import RequirePermission
from app.core.router_org import router_org_id, router_org_list_filter, router_org_write
from app.models.user import User
from app.modules.crm.schemas import (
    ContactActivityCreate,
    ContactActivityResponse,
    ContactCreate,
    ContactResponse,
    ContactUpdate,
)
from app.modules.crm.service import ContactService
from app.modules.reps.service import RepresentativeService

router = APIRouter(prefix="/crm", tags=["workspace-crm"])


def get_contact_service(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ContactService:
    """Dependency: contact service with repository layer."""
    return ContactService(db)


def get_representative_service(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RepresentativeService:
    """Dependency: representative service, used here to resolve rep-scoping."""
    return RepresentativeService(db)


async def _resolve_rep_scope(
    current: User, rep_service: RepresentativeService
) -> int | None:
    """If the current staff user is a sales rep, return their rep id so lead
    lists get scoped to only their own leads. Admin/back-office staff (no
    linked Representative row) get None, i.e. unfiltered by rep."""
    rep = await rep_service.get_representative_for_user(current.id, router_org_id(current))
    return rep.id if rep else None


@router.get("/contacts", response_model=list[ContactResponse])
async def list_contacts(
    service: Annotated[ContactService, Depends(get_contact_service)],
    rep_service: Annotated[RepresentativeService, Depends(get_representative_service)],
    current: Annotated[User, Depends(RequirePermission("crm:read"))],
    org_id: str | None = None,
    status: str | None = None,
    source: str | None = None,
) -> list[ContactResponse]:
    """List contacts (workspace). Optional org_id filter (Brasil vs USA).

    Automatically scoped to the caller's own leads if they're a sales rep.
    """
    return await service.list_contacts(
        org_id=router_org_list_filter(org_id),
        status=status,
        source=source,
        assigned_rep_id=await _resolve_rep_scope(current, rep_service),
    )


@router.get("/leads", response_model=list[ContactResponse])
async def list_leads(
    service: Annotated[ContactService, Depends(get_contact_service)],
    rep_service: Annotated[RepresentativeService, Depends(get_representative_service)],
    current: Annotated[User, Depends(RequirePermission("crm:read"))],
    org_id: str | None = None,
    status: str | None = None,
    source: str | None = None,
) -> list[ContactResponse]:
    """List leads (contacts from website/forms). Same as contacts with filters.

    Automatically scoped to the caller's own leads if they're a sales rep.
    """
    return await service.list_contacts(
        org_id=router_org_list_filter(org_id),
        status=status,
        source=source,
        assigned_rep_id=await _resolve_rep_scope(current, rep_service),
    )


@router.post(
    "/contacts", response_model=ContactResponse, status_code=status.HTTP_201_CREATED
)
async def create_contact(
    body: ContactCreate,
    service: Annotated[ContactService, Depends(get_contact_service)],
    current: Annotated[User, Depends(RequirePermission("crm:write"))],
    org_id: str | None = None,
) -> ContactResponse:
    """Create contact."""
    return await service.create_contact(body, router_org_write(current, org_id))


@router.get("/contacts/{contact_id}", response_model=ContactResponse)
async def get_contact(
    contact_id: int,
    service: Annotated[ContactService, Depends(get_contact_service)],
    _: Annotated[User, Depends(RequirePermission("crm:read"))],
    org_id: str | None = None,
) -> ContactResponse:
    """Get contact by id."""
    result = await service.get_contact(
        contact_id, org_id=router_org_list_filter(org_id)
    )
    if not result:
        raise HTTPException(status_code=404, detail="Contact not found")
    return result


@router.patch("/contacts/{contact_id}", response_model=ContactResponse)
async def update_contact(
    contact_id: int,
    body: ContactUpdate,
    service: Annotated[ContactService, Depends(get_contact_service)],
    _: Annotated[User, Depends(RequirePermission("crm:write"))],
    org_id: str | None = None,
) -> ContactResponse:
    """Update contact."""
    result = await service.update_contact(
        contact_id, body, org_id=router_org_list_filter(org_id)
    )
    if not result:
        raise HTTPException(status_code=404, detail="Contact not found")
    return result


@router.delete("/contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact(
    contact_id: int,
    service: Annotated[ContactService, Depends(get_contact_service)],
    _: Annotated[User, Depends(RequirePermission("crm:write"))],
    org_id: str | None = None,
) -> None:
    """Delete contact."""
    existed = await service.delete_contact(
        contact_id, org_id=router_org_list_filter(org_id)
    )
    if not existed:
        raise HTTPException(status_code=404, detail="Contact not found")


@router.get(
    "/contacts/{contact_id}/activities", response_model=list[ContactActivityResponse]
)
async def list_contact_activities(
    contact_id: int,
    service: Annotated[ContactService, Depends(get_contact_service)],
    _: Annotated[User, Depends(RequirePermission("crm:read"))],
    org_id: str | None = None,
) -> list[ContactActivityResponse]:
    """List activity/note entries for a contact."""
    return await service.list_activities(
        contact_id, org_id=router_org_list_filter(org_id)
    )


@router.post(
    "/contacts/{contact_id}/activities",
    response_model=ContactActivityResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_contact_activity(
    contact_id: int,
    body: ContactActivityCreate,
    service: Annotated[ContactService, Depends(get_contact_service)],
    rep_service: Annotated[RepresentativeService, Depends(get_representative_service)],
    current: Annotated[User, Depends(RequirePermission("crm:write"))],
    org_id: str | None = None,
) -> ContactActivityResponse:
    """Log a new activity/note entry against a contact."""
    rep_id = await _resolve_rep_scope(current, rep_service)
    return await service.add_activity(
        contact_id, body, rep_id, router_org_write(current, org_id)
    )
