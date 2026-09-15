"""Portal hosting: customer-scoped Innexar Cloud (Fase 4).

Cliente: view + restart + files + backups(create) + revisions.
Sem start/stop/restore-backup/delete (admin/workspace).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_customer import get_current_customer
from app.core.database import get_db
from app.models.customer_user import CustomerUser
from app.modules.billing.dependencies import require_billing_enabled
from app.modules.hosting.provider import HostingError
from app.modules.hosting.schemas import (
    BackupCreateBody,
    FileWriteBody,
)
from app.modules.hosting.service import HostingServiceLayer

router = APIRouter(tags=["portal-hosting"])
limiter = Limiter(key_func=get_remote_address)


def _err(e: Exception) -> HTTPException:
    code = getattr(e, "code", "job_failed")
    detail = getattr(e, "detail", str(e))
    mapping = {
        "unauthorized_hosting_access": status.HTTP_404_NOT_FOUND,
        "invalid_path": status.HTTP_422_UNPROCESSABLE_CONTENT,
        "job_conflict": status.HTTP_409_CONFLICT,
        "job_failed": status.HTTP_502_BAD_GATEWAY,
    }
    return HTTPException(
        mapping.get(code, status.HTTP_502_BAD_GATEWAY),
        {"code": code, "message": detail},
    )


async def _own(db: AsyncSession, current: CustomerUser, service_id: int):
    from app.models.customer import Customer

    layer = HostingServiceLayer(db)
    cust = await db.get(Customer, current.customer_id)
    if not cust:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Customer não encontrado")
    try:
        svc = await layer._require_service(  # noqa: SLF001
            service_id, current.customer_id, str(cust.org_id)
        )
    except HostingError as e:
        raise _err(e) from e
    return layer, svc


@router.get("/hosting/services")
async def my_services(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[CustomerUser, Depends(get_current_customer)],
    _: Annotated[None, Depends(require_billing_enabled)],
):
    layer = HostingServiceLayer(db)
    services = await layer.list_services(current.customer_id)
    out = []
    for svc in services:
        try:
            ov = await layer.overview(svc)
        except HostingError:
            ov = {"id": svc.id, "status": svc.status, "runtime": "unknown"}
        out.append(
            {
                "id": svc.id,
                "primary_domain": svc.primary_domain,
                "status": svc.status,
                "runtime": ov.get("runtime", "unknown"),
                "project": svc.project_name,
                "environment": svc.environment,
            }
        )
    return out


@router.get("/hosting/services/{service_id}/overview")
async def service_overview(
    service_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[CustomerUser, Depends(get_current_customer)],
    _: Annotated[None, Depends(require_billing_enabled)],
):
    layer, svc = await _own(db, current, service_id)
    try:
        ov = await layer.overview(svc)
        ov["deploy"] = layer.deploy_info(svc)
        return ov
    except HostingError as e:
        raise _err(e) from e


@router.get("/hosting/services/{service_id}/logs")
async def service_logs(
    service_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[CustomerUser, Depends(get_current_customer)],
    _: Annotated[None, Depends(require_billing_enabled)],
    tail: int = 200,
):
    layer, svc = await _own(db, current, service_id)
    if not svc.container_name:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sem container")
    try:
        return {
            "logs": layer._provider.logs(  # noqa: SLF001
                svc.container_name, tail=min(max(tail, 1), 1000)
            )
        }
    except HostingError as e:
        raise _err(e) from e


@router.post("/hosting/services/{service_id}/restart")
@limiter.limit("5/minute")
async def restart_service(
    service_id: int,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[CustomerUser, Depends(get_current_customer)],
    _: Annotated[None, Depends(require_billing_enabled)],
):
    """Restart pelo cliente (serviço ativo). Rate limited. Via job auditado."""
    from app.core.audit import log_audit

    layer, svc = await _own(db, current, service_id)
    if svc.status != "active":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            {"code": "service_not_active", "message": "Serviço não está ativo"},
        )
    try:
        job = await layer.enqueue_job(
            service_id=svc.id, org_id=svc.org_id, job_type="hosting_restart"
        )
        await layer.run_job(job)
        await log_audit(
            db,
            entity="hosting_service",
            entity_id=str(svc.id),
            action="hosting_restart",
            actor_type="customer",
            actor_id=str(current.id),
            org_id=svc.org_id,
        )
        await db.flush()
        return {"job_id": job.id, "status": job.status}
    except HostingError as e:
        raise _err(e) from e


@router.get("/hosting/services/{service_id}/files")
async def list_files(
    service_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[CustomerUser, Depends(get_current_customer)],
    _: Annotated[None, Depends(require_billing_enabled)],
    path: str = ".",
):
    layer, svc = await _own(db, current, service_id)
    try:
        return layer.list_files(svc, path)
    except HostingError as e:
        raise _err(e) from e


@router.get("/hosting/services/{service_id}/files/read")
async def read_file(
    service_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[CustomerUser, Depends(get_current_customer)],
    _: Annotated[None, Depends(require_billing_enabled)],
    path: str = "",
):
    layer, svc = await _own(db, current, service_id)
    try:
        data = layer.read_file(svc, path)
        try:
            return {"path": path, "content": data.decode("utf-8"), "binary": False}
        except UnicodeDecodeError:
            return {"path": path, "content": None, "binary": True, "size": len(data)}
    except HostingError as e:
        raise _err(e) from e


@router.put("/hosting/services/{service_id}/files/write")
async def write_file(
    service_id: int,
    body: FileWriteBody,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[CustomerUser, Depends(get_current_customer)],
    _: Annotated[None, Depends(require_billing_enabled)],
    path: str = "",
):
    layer, svc = await _own(db, current, service_id)
    try:
        return await layer.write_file(
            svc,
            path,
            body.content.encode("utf-8"),
            actor_type="customer",
            actor_id=str(current.id),
        )
    except HostingError as e:
        raise _err(e) from e


@router.get("/hosting/services/{service_id}/backups")
async def list_backups(
    service_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[CustomerUser, Depends(get_current_customer)],
    _: Annotated[None, Depends(require_billing_enabled)],
):
    from sqlalchemy import select

    from app.modules.hosting.models import HostingBackup

    _, svc = await _own(db, current, service_id)
    rows = (
        (
            await db.execute(
                select(HostingBackup)
                .where(HostingBackup.hosting_service_id == svc.id)
                .order_by(HostingBackup.id.desc())
                .limit(20)
            )
        )
        .scalars()
        .all()
    )
    return [
        {
            "id": b.id,
            "status": b.status,
            "size_bytes": b.size_bytes,
            "created_at": b.created_at,
            "completed_at": b.completed_at,
            "expires_at": b.expires_at,
        }
        for b in rows
    ]


@router.post("/hosting/services/{service_id}/backups", status_code=201)
async def create_backup(
    service_id: int,
    body: BackupCreateBody,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[CustomerUser, Depends(get_current_customer)],
    _: Annotated[None, Depends(require_billing_enabled)],
):
    from app.core.audit import log_audit

    layer, svc = await _own(db, current, service_id)
    try:
        job = await layer.enqueue_job(
            service_id=svc.id,
            org_id=svc.org_id,
            job_type="hosting_backup",
            payload={
                "retention": max(1, min(body.retention, 30)),
                "actor": f"customer:{current.id}",
            },
        )
        await log_audit(
            db,
            entity="hosting_service",
            entity_id=str(svc.id),
            action="hosting_backup_created",
            actor_type="customer",
            actor_id=str(current.id),
            org_id=svc.org_id,
            payload={"job_id": job.id},
        )
        await db.flush()
        return {"job_id": job.id, "status": job.status}
    except HostingError as e:
        raise _err(e) from e
