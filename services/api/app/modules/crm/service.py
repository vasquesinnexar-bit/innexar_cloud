"""CRM service: contact/lead business logic. Uses ContactRepository only."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.crm.models import Contact, ContactActivity
from app.modules.crm.schemas import (
    ContactActivityCreate,
    ContactActivityResponse,
    ContactCreate,
    ContactResponse,
    ContactUpdate,
)
from app.repositories.contact_activity_repository import ContactActivityRepository
from app.repositories.contact_repository import ContactRepository


def _to_response(c: Contact) -> ContactResponse:
    """Map Contact entity to Pydantic response."""
    return ContactResponse.model_validate(c)


def _activity_to_response(a: ContactActivity) -> ContactActivityResponse:
    """Map ContactActivity entity to Pydantic response."""
    return ContactActivityResponse.model_validate(a)


class ContactService:
    """Contact business logic. Depends on ContactRepository."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._repo = ContactRepository(db)
        self._activity_repo = ContactActivityRepository(db)

    async def list_contacts(
        self,
        *,
        org_id: str | None = None,
        status: str | None = None,
        source: str | None = None,
        assigned_rep_id: int | None = None,
    ) -> list[ContactResponse]:
        """List contacts, optionally filtered by org, lead status, source or rep.

        assigned_rep_id: when set (e.g. the caller is a sales rep, not an
        admin), the list is scoped to only leads assigned to that rep - see
        router_workspace.py for how this is resolved from the current user.
        """
        contacts = await self._repo.list_all(
            org_id=org_id,
            status=status,
            source=source,
            assigned_rep_id=assigned_rep_id,
        )
        return [_to_response(c) for c in contacts]

    async def list_activities(
        self, contact_id: int, org_id: str | None = None
    ) -> list[ContactActivityResponse]:
        """List activity/note entries for a contact."""
        activities = await self._activity_repo.list_for_contact(
            contact_id, org_id=org_id
        )
        return [_activity_to_response(a) for a in activities]

    async def add_activity(
        self,
        contact_id: int,
        body: ContactActivityCreate,
        rep_id: int | None,
        org_id: str,
    ) -> ContactActivityResponse:
        """Log a new activity/note entry against a contact."""
        activity = ContactActivity(
            org_id=org_id,
            contact_id=contact_id,
            rep_id=rep_id,
            activity_type=body.activity_type or "note",
            note=body.note,
        )
        self._activity_repo.add(activity)
        await self._db.flush()
        await self._db.refresh(activity)
        return _activity_to_response(activity)

    async def get_contact(
        self, contact_id: int, org_id: str | None = None
    ) -> ContactResponse | None:
        """Get contact by id. Returns None if not found."""
        c = await self._repo.get_by_id(contact_id, org_id=org_id)
        if not c:
            return None
        return _to_response(c)

    async def create_contact(
        self, body: ContactCreate, org_id: str
    ) -> ContactResponse:
        """Create contact for the given org."""
        contact = Contact(
            org_id=org_id,
            name=body.name,
            email=body.email,
            phone=body.phone,
            customer_id=body.customer_id,
            source=body.source,
            message=body.message,
            status=body.status or "new",
            extra_data=body.extra_data,
            assigned_rep_id=body.assigned_rep_id,
        )
        self._repo.add(contact)
        await self._db.flush()
        await self._db.refresh(contact)
        return _to_response(contact)

    async def update_contact(
        self, contact_id: int, body: ContactUpdate, org_id: str | None = None
    ) -> ContactResponse | None:
        """Update contact. Returns None if not found."""
        c = await self._repo.get_by_id(contact_id, org_id=org_id)
        if not c:
            return None
        for field in (
            "name",
            "email",
            "phone",
            "customer_id",
            "source",
            "message",
            "status",
            "extra_data",
            "assigned_rep_id",
        ):
            value = getattr(body, field)
            if value is not None:
                setattr(c, field, value)
        await self._db.flush()
        await self._db.refresh(c)
        return _to_response(c)

    async def delete_contact(self, contact_id: int, org_id: str | None = None) -> bool:
        """Delete contact. Returns True if existed, False if not found."""
        c = await self._repo.get_by_id(contact_id, org_id=org_id)
        if not c:
            return False
        await self._repo.delete(c)
        await self._db.flush()
        return True
