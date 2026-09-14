"""ProjectRequest (briefing) repository: data access only."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import Customer
from app.models.project_request import ProjectRequest


class ProjectRequestRepository:
    """Repository for ProjectRequest (briefings). No business logic."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def list_with_customer_name(
        self,
        project_id: int | None = None,
        org_id: str | None = None,
        order_desc: bool = True,
    ) -> list[tuple[ProjectRequest, str, str]]:
        """List briefings with customer name and org_id."""
        q = (
            select(
                ProjectRequest,
                Customer.name.label("customer_name"),
                Customer.org_id.label("customer_org_id"),
            )
            .join(Customer, ProjectRequest.customer_id == Customer.id)
            .order_by(
                ProjectRequest.created_at.desc()
                if order_desc
                else ProjectRequest.created_at
            )
        )
        if org_id is not None:
            q = q.where(Customer.org_id == org_id)
        if project_id is not None:
            q = q.where(ProjectRequest.project_id == project_id)
        r = await self._db.execute(q)
        return [(row[0], row[1] or "", row[2] or "innexar") for row in r.all()]

    async def get_by_id_with_customer_name(
        self, briefing_id: int
    ) -> tuple[ProjectRequest, str] | None:
        """Get briefing by id with customer name. Returns None if not found."""
        r = await self._db.execute(
            select(ProjectRequest, Customer.name.label("customer_name"))
            .join(Customer, ProjectRequest.customer_id == Customer.id)
            .where(ProjectRequest.id == briefing_id)
            .limit(1)
        )
        row = r.one_or_none()
        if not row:
            return None
        return (row[0], row[1] or "")

    def add(self, req: ProjectRequest) -> None:
        """Add project request to session."""
        self._db.add(req)

    async def flush_and_refresh(self, req: ProjectRequest) -> None:
        """Flush and refresh project request."""
        await self._db.flush()
        await self._db.refresh(req)
