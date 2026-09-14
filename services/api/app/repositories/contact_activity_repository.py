"""ContactActivity aggregate repository: data access only."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.crm.models import ContactActivity


class ContactActivityRepository:
    """Repository for ContactActivity. No business logic."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def list_for_contact(
        self, contact_id: int, org_id: str | None = None
    ) -> list[ContactActivity]:
        """List activities for a contact, newest first."""
        q = select(ContactActivity).where(ContactActivity.contact_id == contact_id)
        if org_id:
            q = q.where(ContactActivity.org_id == org_id)
        q = q.order_by(ContactActivity.id.desc())
        r = await self._db.execute(q)
        return list(r.scalars().all())

    def add(self, activity: ContactActivity) -> None:
        """Add activity to session (caller must flush/commit)."""
        self._db.add(activity)
