"""Contact aggregate repository: data access only."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.crm.models import Contact


class ContactRepository:
    """Repository for Contact. No business logic."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def list_all(
        self,
        *,
        org_id: str | None = None,
        status: str | None = None,
        source: str | None = None,
        assigned_rep_id: int | None = None,
    ) -> list[Contact]:
        """List contacts ordered by newest first, with optional filters."""
        q = select(Contact)
        if org_id:
            q = q.where(Contact.org_id == org_id)
        if status:
            q = q.where(Contact.status == status)
        if source:
            q = q.where(Contact.source == source)
        if assigned_rep_id is not None:
            q = q.where(Contact.assigned_rep_id == assigned_rep_id)
        q = q.order_by(Contact.id.desc())
        r = await self._db.execute(q)
        return list(r.scalars().all())

    async def get_by_id(
        self, contact_id: int, org_id: str | None = None
    ) -> Contact | None:
        """Get contact by id. Optional org_id scopes to tenant."""
        q = select(Contact).where(Contact.id == contact_id)
        if org_id is not None:
            q = q.where(Contact.org_id == org_id)
        r = await self._db.execute(q.limit(1))
        return r.scalar_one_or_none()

    def add(self, contact: Contact) -> None:
        """Add contact to session (caller must flush/commit)."""
        self._db.add(contact)

    async def delete(self, contact: Contact) -> None:
        """Delete contact from session (caller must flush/commit)."""
        await self._db.delete(contact)
