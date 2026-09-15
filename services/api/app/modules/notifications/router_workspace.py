"""Workspace: audit log leitura + notifications leitura (Fase 5, somente leitura)."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.rbac import RequirePermission
from app.models.audit_log import AuditLog
from app.models.notification import Notification
from app.models.user import User

router = APIRouter()


@router.get("/audit", response_model=list[dict])
async def list_audit(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(RequirePermission("dashboard:read"))],
    entity: str | None = None,
    action: str | None = None,
    q: str | None = None,
    limit: int = 50,
):
    """AuditLog paginado simples (leitura; sem JSON bruto no frontend)."""
    query = select(AuditLog).order_by(desc(AuditLog.id)).limit(
        max(1, min(limit, 200)))
    if entity:
        query = query.where(AuditLog.entity == entity.strip().lower())
    if action:
        query = query.where(AuditLog.action == action.strip().lower())
    if q:
        like = f"%{q.strip()[:64]}%"
        query = query.where(or_(
            AuditLog.entity_id.ilike(like),
            AuditLog.actor_id.ilike(like),
        ))
    rows = (await db.execute(query)).scalars().all()
    return [{
        "id": r.id, "entity": r.entity, "entity_id": r.entity_id,
        "action": r.action, "actor_type": r.actor_type, "actor_id": r.actor_id,
        "payload": r.payload, "created_at": r.created_at,
    } for r in rows]


@router.get("/notifications", response_model=list[dict])
async def list_notifications(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(RequirePermission("dashboard:read"))],
    unread_only: bool = False,
    limit: int = 50,
):
    """Central de notificações do staff (leitura + contagem)."""
    query = select(Notification).order_by(desc(Notification.id)).limit(
        max(1, min(limit, 200)))
    if unread_only:
        query = query.where(Notification.read_at.is_(None))
    rows = (await db.execute(query)).scalars().all()
    return [{
        "id": r.id, "title": r.title, "body": r.body,
        "channel": r.channel, "read_at": r.read_at,
        "customer_user_id": r.customer_user_id, "user_id": r.user_id,
        "created_at": r.created_at,
    } for r in rows]
