"""Workspace dashboard: summary (counts and totals) and revenue series."""

from datetime import datetime
from typing import Annotated

from app.core.router_org import router_org_list_filter
from app.core.database import get_db
from app.core.rbac import RequirePermission
from app.models.user import User
from app.modules.dashboard.schemas import (
    DashboardRevenueResponse,
    DashboardSummaryResponse,
)
from app.modules.dashboard.workspace_service import (
    DashboardWorkspaceService,
    PeriodType,
)
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/dashboard", tags=["workspace-dashboard"])


def get_dashboard_service(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DashboardWorkspaceService:
    return DashboardWorkspaceService(db)


@router.get("/summary", response_model=DashboardSummaryResponse)
async def get_dashboard_summary(
    current: Annotated[User, Depends(RequirePermission("dashboard:read"))],
    service: Annotated[DashboardWorkspaceService, Depends(get_dashboard_service)],
    org_id: str | None = None,
) -> DashboardSummaryResponse:
    """Get dashboard summary: active customers, invoices, subscriptions, tickets, projects."""
    return await service.get_summary(router_org_list_filter(org_id))


@router.get("/revenue", response_model=DashboardRevenueResponse)
async def get_dashboard_revenue(
    current: Annotated[User, Depends(RequirePermission("dashboard:read"))],
    service: Annotated[DashboardWorkspaceService, Depends(get_dashboard_service)],
    period_type: PeriodType = Query(  # noqa: B008
        "month", description="day, week, or month"
    ),
    start_date: datetime | None = Query(  # noqa: B008
        None, description="Start of range (UTC)"
    ),
    end_date: datetime | None = Query(  # noqa: B008
        None, description="End of range (UTC)"
    ),
    org_id: str | None = None,
) -> DashboardRevenueResponse:
    """Get revenue time series (paid invoices) for charts."""
    return await service.get_revenue(
        router_org_list_filter(org_id),
        period_type=period_type,
        start_date=start_date,
        end_date=end_date,
    )
