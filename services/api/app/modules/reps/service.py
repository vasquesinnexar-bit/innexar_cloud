"""Reps service: representative business logic. Uses RepresentativeRepository only."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.reps.models import Representative
from app.modules.reps.schemas import (
    RepresentativeCreate,
    RepresentativeResponse,
    RepresentativeUpdate,
)
from app.repositories.representative_repository import RepresentativeRepository


def _to_response(r: Representative) -> RepresentativeResponse:
    """Map Representative entity to Pydantic response."""
    return RepresentativeResponse.model_validate(r)


class RepresentativeService:
    """Representative business logic. Depends on RepresentativeRepository."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._repo = RepresentativeRepository(db)

    async def list_representatives(
        self,
        *,
        org_id: str | None = None,
        status: str | None = None,
    ) -> list[RepresentativeResponse]:
        """List representatives, optionally filtered by org or status."""
        reps = await self._repo.list_all(org_id=org_id, status=status)
        return [_to_response(r) for r in reps]

    async def get_representative(
        self, rep_id: int, org_id: str | None = None
    ) -> RepresentativeResponse | None:
        """Get representative by id. Returns None if not found."""
        r = await self._repo.get_by_id(rep_id, org_id=org_id)
        if not r:
            return None
        return _to_response(r)

    async def get_representative_for_user(
        self, user_id: int, org_id: str | None = None
    ) -> Representative | None:
        """Return the ORM Representative linked to this staff user, or None.

        Used by other modules (e.g. crm) to decide whether the calling staff
        user should have their lead list scoped to only their own leads.
        """
        return await self._repo.get_by_user_id(user_id, org_id=org_id)

    async def create_representative(
        self, body: RepresentativeCreate, org_id: str
    ) -> RepresentativeResponse:
        """Create representative profile for the given org."""
        rep = Representative(
            org_id=org_id,
            user_id=body.user_id,
            name=body.name,
            region=body.region,
            commission_pct=body.commission_pct,
            status=body.status or "active",
        )
        self._repo.add(rep)
        await self._db.flush()
        await self._db.refresh(rep)
        return _to_response(rep)

    async def update_representative(
        self, rep_id: int, body: RepresentativeUpdate, org_id: str | None = None
    ) -> RepresentativeResponse | None:
        """Update representative. Returns None if not found."""
        r = await self._repo.get_by_id(rep_id, org_id=org_id)
        if not r:
            return None
        for field in ("name", "region", "commission_pct", "status"):
            value = getattr(body, field)
            if value is not None:
                setattr(r, field, value)
        await self._db.flush()
        await self._db.refresh(r)
        return _to_response(r)

    async def delete_representative(
        self, rep_id: int, org_id: str | None = None
    ) -> bool:
        """Delete representative. Returns True if existed, False if not found."""
        r = await self._repo.get_by_id(rep_id, org_id=org_id)
        if not r:
            return False
        await self._repo.delete(r)
        await self._db.flush()
        return True
