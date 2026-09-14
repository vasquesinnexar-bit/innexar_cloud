"""Workspace API: staff auth + project messages and modification-requests (thin)."""

from typing import Annotated

from fastapi import (  # noqa: I001
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Request,
    status,
)
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_staff import get_current_staff
from app.core.database import get_db
from app.core.router_org import router_org_list_filter
from app.core.workspace_auth_service import (
    staff_change_password as svc_change_password,
)
from app.core.workspace_auth_service import (
    staff_forgot_password as svc_forgot_password,
)
from app.core.workspace_auth_service import (
    staff_login as svc_login,
)
from app.core.workspace_auth_service import (
    staff_reset_password as svc_reset_password,
)
from app.models.user import User
from app.modules.projects.router_workspace import get_project_workspace_service
from app.modules.projects.schemas import (
    ModificationRequestListItem,
    ModificationRequestUpdateBody,
    ModificationRequestUpdateResponse,
    ProjectMessageResponse,
    StaffSendMessageBody,
)
from app.modules.projects.workspace_service import ProjectWorkspaceService
from app.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    StaffLoginResponse,
    StaffMeResponse,
    StaffResetPasswordRequest,
)

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


@router.post("/auth/staff/login", response_model=StaffLoginResponse)
@limiter.limit("10/minute")
async def staff_login(
    request: Request,
    body: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> StaffLoginResponse:
    """Workspace: staff login. Returns JWT for /api/workspace/*."""
    try:
        return await svc_login(db, body.email, body.password)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        ) from e


@router.get("/me", response_model=StaffMeResponse)
async def staff_me(
    current_user: Annotated[User, Depends(get_current_staff)],
) -> StaffMeResponse:
    """Workspace: current staff profile."""
    return StaffMeResponse(
        id=current_user.id,
        email=current_user.email,
        role=current_user.role,
        org_id=current_user.org_id,
    )


@router.post("/auth/staff/forgot-password", status_code=200)
async def staff_forgot_password(
    body: ForgotPasswordRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    background_tasks: BackgroundTasks,
) -> MessageResponse:
    """Public: request staff password reset. Sends email with link if account exists. Always 200."""
    return await svc_forgot_password(db, body.email, background_tasks)


@router.post("/auth/staff/reset-password", status_code=200)
async def staff_reset_password(
    body: StaffResetPasswordRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MessageResponse:
    """Public: set new staff password using token from email. Invalidates token."""
    try:
        return await svc_reset_password(db, body.token, body.new_password)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e


@router.patch("/me/password", status_code=200)
async def staff_change_password(
    body: ChangePasswordRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_staff)],
) -> MessageResponse:
    """Workspace: change password for current staff (current + new password)."""
    try:
        return await svc_change_password(
            db, current_user, body.current_password, body.new_password
        )
    except ValueError as e:
        msg = str(e)
        if "Senha atual incorreta" in msg:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=msg,
            ) from e
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=msg,
        ) from e


# ============================================================
# Project Messages — Staff side (thin: service only)
# ============================================================


@router.get(
    "/projects/{project_id}/messages", response_model=list[ProjectMessageResponse]
)
async def staff_list_project_messages(
    project_id: int,
    service: Annotated[ProjectWorkspaceService, Depends(get_project_workspace_service)],
    _: Annotated[User, Depends(get_current_staff)],
    org_id: str | None = None,
) -> list[ProjectMessageResponse]:
    """Staff: list messages for a project."""
    result = await service.list_project_messages(
        project_id, org_id=router_org_list_filter(org_id)
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return result


@router.post(
    "/projects/{project_id}/messages",
    response_model=ProjectMessageResponse,
    status_code=201,
)
async def staff_send_project_message(
    project_id: int,
    body: StaffSendMessageBody,
    service: Annotated[ProjectWorkspaceService, Depends(get_project_workspace_service)],
    current_user: Annotated[User, Depends(get_current_staff)],
    org_id: str | None = None,
) -> ProjectMessageResponse:
    """Staff: send a message in a project thread."""
    result = await service.send_project_message(
        project_id, body.body, current_user, org_id=router_org_list_filter(org_id)
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return result


# ============================================================
# Modification Requests — Staff side (thin: service only)
# ============================================================


@router.get(
    "/projects/{project_id}/modification-requests",
    response_model=list[ModificationRequestListItem],
)
async def staff_list_modification_requests(
    project_id: int,
    service: Annotated[ProjectWorkspaceService, Depends(get_project_workspace_service)],
    _: Annotated[User, Depends(get_current_staff)],
    org_id: str | None = None,
) -> list[ModificationRequestListItem]:
    """Staff: list modification requests for a project."""
    result = await service.list_modification_requests(
        project_id, org_id=router_org_list_filter(org_id)
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return result


@router.patch(
    "/modification-requests/{request_id}",
    response_model=ModificationRequestUpdateResponse,
    status_code=200,
)
async def staff_update_modification_request(
    request_id: int,
    body: ModificationRequestUpdateBody,
    service: Annotated[ProjectWorkspaceService, Depends(get_project_workspace_service)],
    _: Annotated[User, Depends(get_current_staff)],
    org_id: str | None = None,
) -> ModificationRequestUpdateResponse:
    """Staff: update a modification request (status, notes)."""
    result = await service.update_modification_request(
        request_id,
        status=body.status,
        staff_notes=body.staff_notes,
        org_id=router_org_list_filter(org_id),
    )
    if not result:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada")
    return result
