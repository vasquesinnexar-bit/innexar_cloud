"""Workspace hosting: servers, discovery, link, services, files, backups, jobs (Fase 4)."""

from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import log_audit
from app.core.database import get_db
from app.core.rbac import RequirePermission
from app.models.user import User
from app.modules.billing.dependencies import require_billing_enabled
from app.modules.hosting.models import (
    FileRevision,
    HostingBackup,
    HostingJob,
    HostingServer,
    HostingService,
)
from app.modules.hosting.provider import HostingError
from app.modules.hosting.schemas import (
    BackupCreateBody,
    DiffResponse,
    FileEntry,
    FileRenameBody,
    FileWriteBody,
    HostingServiceCreate,
    HostingServiceResponse,
    JobResponse,
    MkdirBody,
    RevisionResponse,
    ServerResponse,
)
from app.modules.hosting.service import HostingServiceLayer

router = APIRouter()

READ = RequirePermission("hosting.view")
ADMIN = RequirePermission("hosting.admin")
FILES_VIEW = RequirePermission("hosting.files.view")
FILES_EDIT = RequirePermission("hosting.files.edit")
FILES_UPLOAD = RequirePermission("hosting.files.upload")
FILES_DELETE = RequirePermission("hosting.files.delete")
BACKUPS_VIEW = RequirePermission("hosting.backups.view")
BACKUPS_CREATE = RequirePermission("hosting.backups.create")
BACKUPS_RESTORE = RequirePermission("hosting.backups.restore")
LOGS_VIEW = RequirePermission("hosting.logs.view")


def _err(e: Exception) -> HTTPException:
    code = getattr(e, "code", "job_failed")
    detail = getattr(e, "detail", str(e))
    mapping = {
        "unauthorized_hosting_access": status.HTTP_404_NOT_FOUND,
        "invalid_path": status.HTTP_422_UNPROCESSABLE_CONTENT,
        "job_conflict": status.HTTP_409_CONFLICT,
        "job_failed": status.HTTP_502_BAD_GATEWAY,
    }
    return HTTPException(mapping.get(code, status.HTTP_502_BAD_GATEWAY),
                         {"code": code, "message": detail})


def _layer(db: AsyncSession) -> HostingServiceLayer:
    return HostingServiceLayer(db)


@router.get("/hosting/servers", response_model=list[ServerResponse])
async def list_servers(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(READ)],
):
    rows = (await db.execute(select(HostingServer))).scalars().all()
    return list(rows)


@router.get("/hosting/discovery")
async def discovery(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(ADMIN)],
):
    """Containers existentes (somente leitura, sem vincular)."""
    return _layer(db).discovery()


@router.get("/hosting/servers/overview")
async def servers_overview(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(READ)],
):
    """Saúde do host: docker info + disco + contadores (sem segredos)."""
    import shutil

    from app.modules.hosting.provider import _docker

    try:
        info = __import__("json").loads(_docker("info", "--format", "{{json .}}"))
    except HostingError:
        info = {}
    disk = shutil.disk_usage("/srv/innexar/backups")
    rows = (
        await db.execute(select(HostingService))
    ).scalars().all()
    return {
        "containers_running": info.get("ContainersRunning"),
        "containers_total": info.get("Containers"),
        "images": info.get("Images"),
        "docker_version": (info.get("ServerVersion") or ""),
        "disk_total": disk.total,
        "disk_used": disk.used,
        "disk_free": disk.free,
        "services_total": len(rows),
        "services_suspended": sum(1 for s in rows if s.status == "suspended"),
    }


@router.get("/hosting/backups/recent")
async def recent_backups(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(BACKUPS_VIEW)],
    org_id: str | None = None,
    limit: int = 30,
):
    from app.core.router_org import router_org_list_filter

    of = router_org_list_filter(org_id)
    q = select(HostingBackup).order_by(HostingBackup.id.desc()).limit(
        max(1, min(limit, 100)))
    rows = (await db.execute(q)).scalars().all()
    if of is not None:
        rows = [b for b in rows if (b.hosting_service_id and True)]
    out = []
    for b in rows:
        svc = await db.get(HostingService, b.hosting_service_id)
        if of is not None and (not svc or svc.org_id != of):
            continue
        out.append({
            "id": b.id, "service_id": b.hosting_service_id,
            "domain": svc.primary_domain if svc else None,
            "customer_id": svc.customer_id if svc else None,
            "status": b.status, "size_bytes": b.size_bytes,
            "created_at": b.created_at, "completed_at": b.completed_at,
            "expires_at": b.expires_at,
        })
    return out


@router.post("/hosting/services", response_model=HostingServiceResponse,
             status_code=201)
async def link_service(
    body: HostingServiceCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(ADMIN)],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
):
    from app.core.router_org import router_org_write

    try:
        svc = await _layer(db).link_service(
            customer_id=body.customer_id,
            org_id=router_org_write(current, org_id),
            container_name=body.container_name, root_path=body.root_path,
            path_mode=body.path_mode, primary_domain=body.primary_domain,
            environment=body.environment,
            actor_type="staff", actor_id=str(current.id),
        )
    except HostingError as e:
        raise _err(e)
    return svc


@router.get("/hosting/services", response_model=list[HostingServiceResponse])
async def list_services(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(READ)],
    org_id: str | None = None,
    customer_id: int | None = None,
):
    from app.core.router_org import router_org_list_filter

    of = router_org_list_filter(org_id)
    q = select(HostingService).order_by(HostingService.id.desc())
    if of is not None:
        q = q.where(HostingService.org_id == of)
    if customer_id is not None:
        q = q.where(HostingService.customer_id == customer_id)
    return list((await db.execute(q)).scalars().all())


@router.get("/hosting/services/{service_id}/overview")
async def service_overview(
    service_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(READ)],
    org_id: str | None = None,
):
    from app.core.router_org import router_org_list_filter

    layer = _layer(db)
    try:
        svc = await layer._require_service(  # noqa: SLF001 (mesma camada)
            service_id, None, router_org_list_filter(org_id))
        return await layer.overview(svc)
    except HostingError as e:
        raise _err(e)


@router.get("/hosting/services/{service_id}/deploy")
async def deploy_info(
    service_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(READ)],
    org_id: str | None = None,
):
    from app.core.router_org import router_org_list_filter

    layer = _layer(db)
    try:
        svc = await layer._require_service(
            service_id, None, router_org_list_filter(org_id))
        return layer.deploy_info(svc)
    except HostingError as e:
        raise _err(e)


@router.get("/hosting/services/{service_id}/logs")
async def service_logs(
    service_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(LOGS_VIEW)],
    org_id: str | None = None,
    tail: int = 200,
):
    from app.core.router_org import router_org_list_filter

    layer = _layer(db)
    try:
        svc = await layer._require_service(
            service_id, None, router_org_list_filter(org_id))
        if not svc.container_name:
            raise HostingError("job_failed", "sem container vinculado")
        return {"logs": layer._provider.logs(  # noqa: SLF001
            svc.container_name, tail=min(max(tail, 1), 1000))}
    except HostingError as e:
        raise _err(e)


@router.post("/hosting/services/{service_id}/restart", response_model=JobResponse)
async def restart_service(
    service_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(ADMIN)],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
):
    from app.core.router_org import router_org_list_filter

    layer = _layer(db)
    try:
        svc = await layer._require_service(
            service_id, None, router_org_list_filter(org_id))
        job = await layer.enqueue_job(
            service_id=svc.id, org_id=svc.org_id, job_type="hosting_restart")
        await layer.run_job(job)
        await log_audit(db, entity="hosting_service", entity_id=str(svc.id),
                        action="hosting_restart", actor_type="staff",
                        actor_id=str(current.id), org_id=svc.org_id)
        await db.flush()
        return job
    except HostingError as e:
        raise _err(e)


@router.post("/hosting/services/{service_id}/stop", response_model=JobResponse)
async def stop_service(
    service_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(ADMIN)],
    org_id: str | None = None,
):
    from app.core.router_org import router_org_list_filter

    layer = _layer(db)
    try:
        svc = await layer._require_service(
            service_id, None, router_org_list_filter(org_id))
        job = await layer.enqueue_job(
            service_id=svc.id, org_id=svc.org_id, job_type="hosting_stop")
        await layer.run_job(job)
        await log_audit(db, entity="hosting_service", entity_id=str(svc.id),
                        action="hosting_stop", actor_type="staff",
                        actor_id=str(current.id), org_id=svc.org_id)
        await db.flush()
        return job
    except HostingError as e:
        raise _err(e)


@router.post("/hosting/services/{service_id}/start", response_model=JobResponse)
async def start_service(
    service_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(ADMIN)],
    org_id: str | None = None,
):
    from app.core.router_org import router_org_list_filter

    layer = _layer(db)
    try:
        svc = await layer._require_service(
            service_id, None, router_org_list_filter(org_id))
        job = await layer.enqueue_job(
            service_id=svc.id, org_id=svc.org_id, job_type="hosting_start")
        await layer.run_job(job)
        await log_audit(db, entity="hosting_service", entity_id=str(svc.id),
                        action="hosting_start", actor_type="staff",
                        actor_id=str(current.id), org_id=svc.org_id)
        await db.flush()
        return job
    except HostingError as e:
        raise _err(e)


@router.get("/hosting/services/{service_id}/files", response_model=list[FileEntry])
async def list_files(
    service_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(FILES_VIEW)],
    org_id: str | None = None,
    path: str = ".",
):
    from app.core.router_org import router_org_list_filter

    layer = _layer(db)
    try:
        svc = await layer._require_service(
            service_id, None, router_org_list_filter(org_id))
        return layer.list_files(svc, path)
    except HostingError as e:
        raise _err(e)


@router.get("/hosting/services/{service_id}/files/read")
async def read_file(
    service_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(FILES_VIEW)],
    org_id: str | None = None,
    path: str = "",
):
    from app.core.router_org import router_org_list_filter

    layer = _layer(db)
    try:
        svc = await layer._require_service(
            service_id, None, router_org_list_filter(org_id))
        data = layer.read_file(svc, path)
        try:
            return {"path": path, "content": data.decode("utf-8"), "binary": False}
        except UnicodeDecodeError:
            return {"path": path, "content": None, "binary": True,
                    "size": len(data)}
    except HostingError as e:
        raise _err(e)


@router.put("/hosting/services/{service_id}/files/write")
async def write_file(
    service_id: int,
    body: FileWriteBody,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(FILES_EDIT)],
    org_id: str | None = None,
    path: str = "",
):
    from app.core.router_org import router_org_list_filter

    layer = _layer(db)
    try:
        svc = await layer._require_service(
            service_id, None, router_org_list_filter(org_id))
        return await layer.write_file(
            svc, path, body.content.encode("utf-8"),
            actor_type="staff", actor_id=str(current.id))
    except HostingError as e:
        raise _err(e)


@router.post("/hosting/services/{service_id}/files/mkdir")
async def make_dir(
    service_id: int,
    body: MkdirBody,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(FILES_EDIT)],
    org_id: str | None = None,
):
    from app.core.router_org import router_org_list_filter

    from app.modules.hosting.provider import DockerHostingProvider

    layer = _layer(db)
    try:
        svc = await layer._require_service(
            service_id, None, router_org_list_filter(org_id))
        mode, base = layer._base(svc)  # noqa: SLF001
        if mode == "host":
            import os

            from app.modules.hosting import paths as _paths

            os.makedirs(_paths.contain(base, body.path), exist_ok=True)
        else:
            DockerHostingProvider().make_dir(svc.container_name or "", base,
                                             body.path)
        await log_audit(db, entity="hosting_service", entity_id=str(svc.id),
                        action="hosting_file_created", actor_type="staff",
                        actor_id=str(current.id), org_id=svc.org_id,
                        payload={"path": body.path})
        await db.flush()
        return {"ok": True}
    except HostingError as e:
        raise _err(e)


@router.delete("/hosting/services/{service_id}/files")
async def delete_file(
    service_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(FILES_DELETE)],
    org_id: str | None = None,
    path: str = "",
    recursive: bool = False,
):
    from app.core.router_org import router_org_list_filter

    from app.modules.hosting.provider import DockerHostingProvider

    layer = _layer(db)
    try:
        svc = await layer._require_service(
            service_id, None, router_org_list_filter(org_id))
        mode, base = layer._base(svc)  # noqa: SLF001
        if mode == "host":
            import os
            import shutil

            from app.modules.hosting import paths as _paths

            full = _paths.contain(base, path)
            if os.path.isdir(full) and not os.path.islink(full):
                if not recursive:
                    raise HostingError("invalid_path",
                                       "diretório exige recursive=true")
                shutil.rmtree(full)
            else:
                os.remove(full)
        else:
            DockerHostingProvider().delete_path(svc.container_name or "", base,
                                                path, recursive)
        await log_audit(db, entity="hosting_service", entity_id=str(svc.id),
                        action="hosting_file_deleted", actor_type="staff",
                        actor_id=str(current.id), org_id=svc.org_id,
                        payload={"path": path})
        await db.flush()
        return {"ok": True}
    except HostingError as e:
        raise _err(e)


@router.put("/hosting/services/{service_id}/files/rename")
async def rename_file(
    service_id: int,
    body: FileRenameBody,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(FILES_EDIT)],
    org_id: str | None = None,
    path: str = "",
):
    from app.core.router_org import router_org_list_filter

    from app.modules.hosting.provider import DockerHostingProvider

    layer = _layer(db)
    try:
        svc = await layer._require_service(
            service_id, None, router_org_list_filter(org_id))
        mode, base = layer._base(svc)  # noqa: SLF001
        if mode == "host":
            import os

            from app.modules.hosting import paths as _paths

            old_full = _paths.contain(base, path)
            new_rel = _paths.validate(body.new_path, for_edit=True)
            new_full = _paths.contain(base, new_rel)
            os.rename(old_full, new_full)
        else:
            DockerHostingProvider().rename(svc.container_name or "", base,
                                           path, body.new_path)
        await log_audit(db, entity="hosting_service", entity_id=str(svc.id),
                        action="hosting_file_updated", actor_type="staff",
                        actor_id=str(current.id), org_id=svc.org_id,
                        payload={"from": path, "to": body.new_path})
        await db.flush()
        return {"ok": True}
    except HostingError as e:
        raise _err(e)


@router.post("/hosting/services/{service_id}/files/upload")
async def upload_file(
    service_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(FILES_UPLOAD)],
    org_id: str | None = None,
    path: str = "",
    file: UploadFile = File(...),
):
    from app.core.router_org import router_org_list_filter

    from app.modules.hosting import paths as _paths

    layer = _layer(db)
    try:
        svc = await layer._require_service(
            service_id, None, router_org_list_filter(org_id))
        _paths.validate(path, for_edit=True)
        data = await file.read(2 * 1024 * 1024 + 1)
        if len(data) > 2 * 1024 * 1024:
            raise HostingError("invalid_path", "upload excede 2MB")
        mode, base = layer._base(svc)  # noqa: SLF001
        if mode == "host":
            from app.modules.hosting.provider import DockerHostingProvider

            DockerHostingProvider.host_write(base, path, data)
        else:
            layer._provider.write_file(  # noqa: SLF001
                svc.container_name or "", base, path, data)
        await log_audit(db, entity="hosting_service", entity_id=str(svc.id),
                        action="hosting_file_uploaded", actor_type="staff",
                        actor_id=str(current.id), org_id=svc.org_id,
                        payload={"path": path, "size": len(data)})
        await db.flush()
        return {"ok": True, "size": len(data)}
    except HostingError as e:
        raise _err(e)


@router.get("/hosting/services/{service_id}/backups")
async def list_backups(
    service_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(BACKUPS_VIEW)],
    org_id: str | None = None,
):
    from app.core.router_org import router_org_list_filter

    layer = _layer(db)
    try:
        svc = await layer._require_service(
            service_id, None, router_org_list_filter(org_id))
        rows = (
            await db.execute(
                select(HostingBackup).where(
                    HostingBackup.hosting_service_id == svc.id)
                .order_by(HostingBackup.id.desc()).limit(50)
            )
        ).scalars().all()
        return [{"id": b.id, "backup_type": b.backup_type, "status": b.status,
                 "size_bytes": b.size_bytes, "created_at": b.created_at,
                 "completed_at": b.completed_at, "expires_at": b.expires_at}
                for b in rows]
    except HostingError as e:
        raise _err(e)


@router.post("/hosting/services/{service_id}/backups", response_model=JobResponse,
             status_code=201)
async def create_backup(
    service_id: int,
    body: BackupCreateBody,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(BACKUPS_CREATE)],
    org_id: str | None = None,
):
    from app.core.router_org import router_org_list_filter

    layer = _layer(db)
    try:
        svc = await layer._require_service(
            service_id, None, router_org_list_filter(org_id))
        job = await layer.enqueue_job(
            service_id=svc.id, org_id=svc.org_id, job_type="hosting_backup",
            payload={"retention": max(1, min(body.retention, 30)),
                     "actor": f"staff:{current.id}"})
        await log_audit(db, entity="hosting_service", entity_id=str(svc.id),
                        action="hosting_backup_created", actor_type="staff",
                        actor_id=str(current.id), org_id=svc.org_id,
                        payload={"job_id": job.id})
        await db.flush()
        return job
    except HostingError as e:
        raise _err(e)


@router.post("/hosting/backups/{backup_id}/restore", response_model=JobResponse)
async def restore_backup(
    backup_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(BACKUPS_RESTORE)],
):
    """Restore: permissão backups.restore + confirmação forte no frontend."""
    from app.modules.hosting.models import HostingBackup as _Bak

    layer = _layer(db)
    bak = await db.get(_Bak, backup_id)
    if not bak:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Backup não encontrado")
    svc = await db.get(HostingService, bak.hosting_service_id)
    if not svc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Serviço não encontrado")
    try:
        job = await layer.enqueue_job(
            service_id=svc.id, org_id=svc.org_id, job_type="hosting_restore",
            payload={"backup_id": bak.id, "actor": f"staff:{current.id}"})
        await log_audit(db, entity="hosting_service", entity_id=str(svc.id),
                        action="hosting_backup_restored", actor_type="staff",
                        actor_id=str(current.id), org_id=svc.org_id,
                        payload={"backup_id": bak.id})
        await db.flush()
        return job
    except HostingError as e:
        raise _err(e)


@router.get("/hosting/services/{service_id}/revisions",
            response_model=list[RevisionResponse])
async def list_revisions(
    service_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(FILES_VIEW)],
    org_id: str | None = None,
):
    from app.core.router_org import router_org_list_filter
    from app.modules.hosting.models import FileRevision as _Rev

    layer = _layer(db)
    try:
        svc = await layer._require_service(
            service_id, None, router_org_list_filter(org_id))
        rows = (
            await db.execute(
                select(_Rev).where(_Rev.hosting_service_id == svc.id)
                .order_by(_Rev.id.desc()).limit(50)
            )
        ).scalars().all()
        return list(rows)
    except HostingError as e:
        raise _err(e)


@router.get("/hosting/revisions/{revision_id}/diff")
async def revision_diff(
    revision_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(FILES_VIEW)],
):
    import difflib

    from app.modules.hosting.models import FileRevision as _Rev

    rev = await db.get(_Rev, revision_id)
    if not rev:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Revisão não encontrada")
    before = ""
    if rev.content_before:
        before = rev.content_before
    elif rev.checksum_before:
        before = f"(snapshot externo: {rev.checksum_before})"
    current_content = ""
    try:
        layer = HostingServiceLayer(db)
        svc = await db.get(HostingService, rev.hosting_service_id)
        if svc:
            data = layer.read_file(svc, rev.path)
            current_content = data.decode(errors="replace")[:200000]
    except HostingError:
        current_content = ""
    diff = list(difflib.unified_diff(
        before.splitlines(), current_content.splitlines(),
        fromfile="antes", tofile="atual", lineterm="", n=3))[:500]
    return {"path": rev.path, "before": before[:200000] or None,
            "after": current_content or None, "diff": diff}


@router.post("/hosting/revisions/{revision_id}/restore")
async def revision_restore(
    revision_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(FILES_EDIT)],
):
    from app.modules.hosting.models import FileRevision as _Rev

    rev = await db.get(_Rev, revision_id)
    if not rev or not rev.content_before:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Revisão sem conteúdo")
    layer = HostingServiceLayer(db)
    svc = await db.get(HostingService, rev.hosting_service_id)
    if not svc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Serviço não encontrado")
    try:
        mode, base = layer._base(svc)
        if mode == "host":
            from app.modules.hosting.provider import DockerHostingProvider

            DockerHostingProvider.host_write(base, rev.path,
                                             rev.content_before.encode())
        else:
            layer._provider.write_file(  # noqa: SLF001
                svc.container_name or "", base, rev.path,
                rev.content_before.encode())
        await log_audit(db, entity="file_revision", entity_id=str(rev.id),
                        action="hosting_revision_restored", actor_type="staff",
                        actor_id=str(current.id), org_id=svc.org_id,
                        payload={"path": rev.path})
        await db.flush()
        return {"ok": True}
    except HostingError as e:
        raise _err(e)


@router.get("/hosting/services/{service_id}/jobs", response_model=list[JobResponse])
async def list_jobs(
    service_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(READ)],
    org_id: str | None = None,
):
    from app.core.router_org import router_org_list_filter

    layer = _layer(db)
    try:
        svc = await layer._require_service(
            service_id, None, router_org_list_filter(org_id))
        rows = (
            await db.execute(
                select(HostingJob).where(
                    HostingJob.hosting_service_id == svc.id)
                .order_by(HostingJob.id.desc()).limit(30)
            )
        ).scalars().all()
        return list(rows)
    except HostingError as e:
        raise _err(e)


@router.get("/hosting/services/{service_id}/download")
async def download_file(
    service_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(FILES_VIEW)],
    org_id: str | None = None,
    path: str = "",
):
    from fastapi.responses import Response as _Response

    from app.core.router_org import router_org_list_filter

    layer = _layer(db)
    try:
        svc = await layer._require_service(
            service_id, None, router_org_list_filter(org_id))
        data = layer.read_file(svc, path)
        name = path.rsplit("/", 1)[-1] or "download"
        return _Response(content=data, media_type="application/octet-stream",
                         headers={"Content-Disposition":
                                  f'attachment; filename="{name}"'})
    except HostingError as e:
        raise _err(e)
