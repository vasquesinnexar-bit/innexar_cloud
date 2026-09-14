"""Projects workspace service: CRUD via repository + messages/modification requests."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.models.user import User
from app.core.org import staff_org_id
from app.modules.projects.models import Project
from app.modules.projects.project_message import ProjectMessage
from app.modules.projects.schemas import (
    ModificationRequestListItem,
    ModificationRequestUpdateResponse,
    ProjectCreate,
    ProjectMessageResponse,
    ProjectUpdate,
)
from app.repositories.customer_repository import CustomerRepository
from app.repositories.project_activity_repository import ProjectActivityRepository
from app.repositories.project_repository import ProjectRepository

ALLOWED_STATUSES = (
    "aguardando_briefing",
    "briefing_recebido",
    "design",
    "desenvolvimento",
    "revisao",
    "entrega",
    "projeto_concluido",
    "active",
    "delivered",
    "cancelled",
)


class ProjectWorkspaceService:
    """Workspace projects CRUD. Uses ProjectRepository."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._repo = ProjectRepository(db)
        self._activity_repo = ProjectActivityRepository(db)

    async def list_projects(self, org_id: str | None) -> list[Project]:
        return await self._repo.list_all(org_id=org_id)

    async def get_project(self, project_id: int, org_id: str | None = None) -> Project | None:
        return await self._repo.get_by_id(project_id, org_id=org_id)

    async def create_project(self, body: ProjectCreate, org_id: str) -> Project:
        org = staff_org_id(org_id)
        customer = await CustomerRepository(self._db).get_by_id_with_users(
            body.customer_id, org_id=org
        )
        if not customer:
            raise ValueError("Customer not found in your organization")
        p = Project(
            org_id=org,
            customer_id=body.customer_id,
            name=body.name,
            status=body.status,
            subscription_id=body.subscription_id,
        )
        self._repo.add(p)
        await self._repo.flush_and_refresh(p)
        return p

    async def update_project(
        self, project_id: int, body: ProjectUpdate, org_id: str | None = None
    ) -> Project | None:
        p = await self._repo.get_by_id(project_id, org_id=org_id)
        if not p:
            return None
        if body.name is not None:
            p.name = body.name
        if body.status is not None:
            if body.status not in ALLOWED_STATUSES:
                raise ValueError(
                    f"status must be one of: {', '.join(ALLOWED_STATUSES)}"
                )
            p.status = body.status
        if body.expected_delivery_at is not None:
            p.expected_delivery_at = body.expected_delivery_at
        if body.delivery_info is not None:
            p.delivery_info = body.delivery_info
        await self._repo.flush_and_refresh(p)
        return p

    async def list_project_messages(
        self, project_id: int, org_id: str | None = None
    ) -> list[ProjectMessageResponse] | None:
        """List messages for a project. Returns None if project not found."""
        project = await self._repo.get_by_id(project_id, org_id=org_id)
        if not project:
            return None
        messages = await self._activity_repo.list_messages_by_project_id(project_id)
        return [ProjectMessageResponse.model_validate(m) for m in messages]

    async def send_project_message(
        self, project_id: int, body: str, staff_user: User, org_id: str | None = None
    ) -> ProjectMessageResponse | None:
        """Add staff message to project. Returns None if project not found."""
        project = await self._repo.get_by_id(project_id, org_id=org_id)
        if not project:
            return None
        sender_name = staff_user.email.split("@")[0].replace(".", " ").title()
        msg = ProjectMessage(
            project_id=project_id,
            sender_type="staff",
            sender_id=staff_user.id,
            sender_name=sender_name,
            body=body,
        )
        self._activity_repo.add_message(msg)
        await self._activity_repo.flush_and_refresh_message(msg)

        # Create in_app notifications for all customer users of this customer
        cust_repo = CustomerRepository(self._db)
        customer = await cust_repo.get_by_id_with_users(project.customer_id)
        if customer and customer.users:
            preview = (body or "").strip()[:200]
            notif = Notification(
                customer_user_id=customer.users[0].id,
                channel="in_app",
                title="New message in your project",
                body=f"{sender_name}: {preview}",
            )
            self._db.add(notif)
            for cu in customer.users[1:]:
                self._db.add(
                    Notification(
                        customer_user_id=cu.id,
                        channel="in_app",
                        title="New message in your project",
                        body=f"{sender_name}: {preview}",
                    )
                )
            await self._db.flush()

        return ProjectMessageResponse.model_validate(msg)

    async def list_modification_requests(
        self, project_id: int, org_id: str | None = None
    ) -> list[ModificationRequestListItem] | None:
        """List modification requests for a project. Returns None if project not found."""
        project = await self._repo.get_by_id(project_id, org_id=org_id)
        if not project:
            return None
        reqs = await self._activity_repo.list_modification_requests_by_project_id(
            project_id
        )
        return [ModificationRequestListItem.model_validate(r) for r in reqs]

    async def update_modification_request(
        self,
        request_id: int,
        status: str | None = None,
        staff_notes: str | None = None,
        org_id: str | None = None,
    ) -> ModificationRequestUpdateResponse | None:
        """Update modification request status/notes. Returns None if not found."""
        req = await self._activity_repo.get_modification_request_by_id(request_id)
        if not req:
            return None
        project = await self._repo.get_by_id(req.project_id, org_id=org_id)
        if not project:
            return None
        if status:
            req.status = status
        if staff_notes is not None:
            req.staff_notes = staff_notes
        await self._activity_repo.flush_and_refresh_modification_request(req)
        return ModificationRequestUpdateResponse.model_validate(req)
