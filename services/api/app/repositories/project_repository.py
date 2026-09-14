"""Project repository: CRUD for workspace."""

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project_request import ProjectRequest
from app.modules.files.models import ProjectFile
from app.modules.projects.models import Project
from app.modules.projects.modification_request import ModificationRequest
from app.modules.projects.project_message import ProjectMessage
from app.modules.support.models import Ticket


class ProjectRepository:
    """Repository for Project aggregate."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def list_all(
        self, org_id: str | None = "innexar", order_desc: bool = True
    ) -> list[Project]:
        q = select(Project)
        if org_id is not None:
            q = q.where(Project.org_id == org_id)
        if order_desc:
            q = q.order_by(Project.id.desc())
        r = await self._db.execute(q)
        return list(r.scalars().all())

    async def get_by_id(
        self, project_id: int, org_id: str | None = None
    ) -> Project | None:
        q = select(Project).where(Project.id == project_id)
        if org_id is not None:
            q = q.where(Project.org_id == org_id)
        r = await self._db.execute(q)
        return r.scalar_one_or_none()

    async def get_by_id_and_customer(
        self, project_id: int, customer_id: int
    ) -> Project | None:
        """Get project by id scoped to customer (portal)."""
        r = await self._db.execute(
            select(Project)
            .where(
                Project.id == project_id,
                Project.customer_id == customer_id,
            )
            .limit(1)
        )
        return r.scalar_one_or_none()

    async def list_by_customer_id(
        self, customer_id: int, order_desc: bool = True
    ) -> list[Project]:
        """List projects for a customer (portal)."""
        q = (
            select(Project)
            .where(Project.customer_id == customer_id)
            .order_by(Project.id.desc() if order_desc else Project.id)
        )
        r = await self._db.execute(q)
        return list(r.scalars().all())

    async def get_by_subscription_id(self, subscription_id: int) -> Project | None:
        """Get project by subscription_id (for orders)."""
        r = await self._db.execute(
            select(Project).where(Project.subscription_id == subscription_id).limit(1)
        )
        return r.scalar_one_or_none()

    async def list_by_subscription_ids(
        self, subscription_ids: list[int]
    ) -> dict[int, Project]:
        """Return mapping subscription_id -> Project for given ids."""
        if not subscription_ids:
            return {}
        r = await self._db.execute(
            select(Project).where(Project.subscription_id.in_(subscription_ids))
        )
        return {p.subscription_id: p for p in r.scalars().all() if p.subscription_id}

    async def get_first_aguardando_briefing_without_briefing(
        self, customer_id: int
    ) -> Project | None:
        """First project aguardando_briefing with no linked ProjectRequest (portal)."""
        subq = select(ProjectRequest.project_id).where(
            ProjectRequest.project_id.isnot(None)
        )
        r = await self._db.execute(
            select(Project)
            .where(
                Project.customer_id == customer_id,
                Project.status == "aguardando_briefing",
                ~Project.id.in_(subq),
            )
            .order_by(Project.id.desc())
            .limit(1)
        )
        return r.scalar_one_or_none()

    async def get_project_counts_by_status(
        self, org_id: str | None = None
    ) -> tuple[dict[str, int], int]:
        """Returns (by_status: status -> count, total) for dashboard summary."""
        status_q = select(Project.status, func.count()).select_from(Project)
        total_q = select(func.count()).select_from(Project)
        if org_id is not None:
            status_q = status_q.where(Project.org_id == org_id)
            total_q = total_q.where(Project.org_id == org_id)
        r = await self._db.execute(status_q.group_by(Project.status))
        by_status: dict[str, int] = {str(row[0]): row[1] for row in r.all()}
        r = await self._db.execute(total_q)
        total = r.scalar() or 0
        return (by_status, total)

    def add(self, project: Project) -> None:
        self._db.add(project)

    async def flush_and_refresh(self, project: Project) -> None:
        await self._db.flush()
        await self._db.refresh(project)

    async def delete_all_for_customer(self, customer_id: int) -> None:
        """Remove projects and related rows so Customer delete does not violate FK/NOT NULL.

        Order: clear ticket/briefing refs → messages → mod requests → files → projects.
        """
        r = await self._db.execute(
            select(Project.id).where(Project.customer_id == customer_id)
        )
        pids = list(r.scalars().all())
        if not pids:
            return

        await self._db.execute(
            update(Ticket)
            .where(Ticket.project_id.in_(pids))
            .values(project_id=None)
        )
        await self._db.execute(
            update(ProjectRequest)
            .where(ProjectRequest.project_id.in_(pids))
            .values(project_id=None)
        )
        await self._db.execute(
            delete(ProjectMessage).where(ProjectMessage.project_id.in_(pids))
        )
        await self._db.execute(
            delete(ModificationRequest).where(
                ModificationRequest.project_id.in_(pids)
            )
        )
        await self._db.execute(
            delete(ProjectFile).where(ProjectFile.project_id.in_(pids))
        )
        await self._db.execute(delete(Project).where(Project.id.in_(pids)))
        await self._db.flush()
