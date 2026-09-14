"""Representative aggregate repository: data access only."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.reps.models import Representative


class RepresentativeRepository:
    """Repository for Representative. No business logic."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def list_all(
        self,
        *,
        org_id: str | None = None,
        status: str | None = None,
    ) -> list[Representative]:
        """List representatives ordered by newest first, with optional filters."""
        q = select(Representative)
        if org_id:
            q = q.where(Representative.org_id == org_id)
        if status:
            q = q.where(Representative.status == status)
        q = q.order_by(Representative.id.desc())
        r = await self._db.execute(q)
        return list(r.scalars().all())

    async def get_by_id(
        self, rep_id: int, org_id: str | None = None
    ) -> Representative | None:
        """Get representative by id. Optional org_id scopes to tenant."""
        q = select(Representative).where(Representative.id == rep_id)
        if org_id is not None:
            q = q.where(Representative.org_id == org_id)
        r = await self._db.execute(q.limit(1))
        return r.scalar_one_or_none()

    async def get_by_user_id(
        self, user_id: int, org_id: str | None = None
    ) -> Representative | None:
        """Get representative by linked staff user id."""
        q = select(Representative).where(Representative.user_id == user_id)
        if org_id is not None:
            q = q.where(Representative.org_id == org_id)
        r = await self._db.execute(q.limit(1))
        return r.scalar_one_or_none()

    def add(self, rep: Representative) -> None:
        """Add representative to session (caller must flush/commit)."""
        self._db.add(rep)

    async def delete(self, rep: Representative) -> None:
        """Delete representative from session (caller must flush/commit)."""
        await self._db.delete(rep)
