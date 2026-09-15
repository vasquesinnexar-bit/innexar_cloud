"""HostingService: business logic (Fase 4). Mirrors MailService patterns."""

from __future__ import annotations

import hashlib
import logging
import os
import re
import shutil
import socket
import ssl
import tarfile
import tempfile
import time
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import log_audit
from app.core.datetime_utils import utc_now
from app.models.customer import Customer
from app.modules.hosting import paths
from app.modules.hosting.enums import (
    BackupStatus,
    ComponentRole,
    HostingJobStatus,
    HostingJobType,
    HostingServiceStatus,
    RuntimeStatus,
    StackType,
)
from app.modules.hosting.models import (
    FileRevision,
    HostingBackup,
    HostingComponent,
    HostingJob,
    HostingServer,
    HostingService,
    HostingStack,
)
from app.modules.hosting.provider import DockerHostingProvider, HostingError

logger = logging.getLogger(__name__)

HOSTING_BACKUP_ROOT = os.environ.get(
    "HOSTING_BACKUP_ROOT", "/srv/innexar/backups/hosting")
SERVER_PUBLIC_IP = os.environ.get("HOSTING_SERVER_IP", "173.212.248.236")

# cache curto de metrics: {(container): (ts, data)}
_metrics_cache: dict[str, tuple[float, dict]] = {}
METRICS_TTL = 30

CONFLICTING_JOBS: dict[str, set[str]] = {
    HostingJobType.RESTART.value: {HostingJobType.RESTART.value,
                                   HostingJobType.STOP.value,
                                   HostingJobType.RESTORE.value},
    HostingJobType.BACKUP.value: {HostingJobType.RESTORE.value},
    HostingJobType.RESTORE.value: {HostingJobType.BACKUP.value,
                                   HostingJobType.RESTORE.value,
                                   HostingJobType.RESTART.value},
}


from app.modules.hosting.provider import DockerHostingProvider, HostingError


def _traefik_hosts(labels: dict) -> list[str]:
    hosts: list[str] = []
    for k, v in (labels or {}).items():
        if ".rule" in k and "Host(`" in str(v):
            hosts += re.findall(r"Host\(`([^`]+)`\)", str(v))
    return sorted(set(hosts))


def _ssl_info(domain: str) -> dict:
    """TLS ao vivo: issuer/datas/dias. Sem chave privada, só leitura."""
    out = {"ok": False, "issuer": None, "not_before": None,
           "not_after": None, "days_remaining": None}
    try:
        ctx = ssl.create_default_context()
        with socket.create_connection((domain, 443), timeout=10) as sock:
            with ctx.wrap_socket(sock, server_hostname=domain) as ss:
                cert = ss.getpeercert() or {}
        import datetime as _dt

        def _parse(v):
            try:
                return _dt.datetime.strptime(v, "%b %d %H:%M:%S %Y %Z")
            except (ValueError, TypeError):
                return None

        nb, na = _parse(cert.get("notBefore", "")), _parse(cert.get("notAfter", ""))
        out.update(ok=True,
                   issuer=" ".join(x[0][1] for x in cert.get("issuer", ())
                                   if x and x[0][0] == "organizationName") or None,
                   not_before=nb.isoformat() if nb else None,
                   not_after=na.isoformat() if na else None,
                   days_remaining=(na - _dt.datetime.utcnow()).days if na else None)
    except (OSError, ssl.SSLError, ValueError) as e:
        out["error"] = str(e)[:120]
    return out


def _dns_status(domain: str) -> dict:
    try:
        _, _, ips = socket.gethostbyname_ex(domain)
    except OSError:
        return {"ok": False, "ips": []}
    return {"ok": True, "ips": ips, "points_here": SERVER_PUBLIC_IP in ips}


class HostingServiceLayer:
    """Camada central de negócio do hosting."""

    def __init__(self, db: AsyncSession,
                 provider: DockerHostingProvider | None = None):
        self._db = db
        self._provider = provider or DockerHostingProvider()

    async def _audit(self, *, entity: str, entity_id: str | None, action: str,
                     actor_type: str, actor_id: str | None, org_id: str,
                     payload: dict | None = None) -> None:
        await log_audit(self._db, entity=entity, entity_id=entity_id,
                        action=action, actor_type=actor_type, actor_id=actor_id,
                        org_id=org_id, payload=payload)

    # -- discovery (somente leitura, sem vincular) -------------------------
    @staticmethod
    def _parse_ps_labels(raw) -> dict:
        if isinstance(raw, dict):
            return raw
        out: dict[str, str] = {}
        for part in str(raw or "").split(","):
            if "=" in part:
                k, _, v = part.partition("=")
                out[k.strip()] = v.strip()
        return out

    def discovery(self) -> list[dict]:
        rows = []
        for c in self._provider.list_containers():
            labels = self._parse_ps_labels(c.get("Labels"))
            rows.append({
                "name": (c.get("Names") or "?").lstrip("/"),
                "image": c.get("Image"),
                "status": c.get("State"),
                "ports": c.get("Ports"),
                "project": labels.get("com.docker.compose.project"),
                "workdir": labels.get("com.docker.compose.project.working_dir"),
                "service": labels.get("com.docker.compose.service"),
            })
        return rows

    # -- stacks (TAREFA 1: aplicação = N containers) ------------------------
    # Projetos compose que são infra da própria plataforma (nunca vinculáveis).
    PLATFORM_PROJECTS = frozenset({
        "traefik", "observability", "innexar-platform", "innexar-mail",
        "innexar-usa", "innexar-usa-workspace", "innexar-brasil-2-0", "portainer",
    })
    # Containers avulsos (sem compose) que são infra da plataforma.
    PLATFORM_CONTAINERS = frozenset({
        "portainer", "fixelo-traefik", "fixelo-attack-block",
        "innexar-mailserver", "innexar-mail-admin", "innexar-roundcube",
        "innexar-mail-autoconfig",
    })

    @staticmethod
    def _label_value(raw, key: str) -> str | None:
        """Extrai UM label de forma robusta (regex; valores traefik têm vírgula)."""
        if isinstance(raw, dict):
            v = raw.get(key)
            return str(v) if v is not None else None
        m = re.search(rf"{re.escape(key)}=([^,]+)", str(raw or ""))
        return m.group(1).strip() if m else None

    @classmethod
    def _is_platform(cls, project: str | None, container: str) -> bool:
        if project and project in cls.PLATFORM_PROJECTS:
            return True
        return container in cls.PLATFORM_CONTAINERS

    @staticmethod
    def infer_role(service: str | None, image: str | None) -> str:
        """Papel técnico do componente (heurística determinística)."""
        s = (service or "").lower()
        img = (image or "").lower()
        if any(k in img for k in ("postgres", "mysql", "mariadb", "mongo",
                                  "libsql", "sqlite", "pgbouncer")) \
                or s in ("db", "database", "postgres", "mysql", "pg",
                         "sqld", "pgbouncer"):
            return ComponentRole.DATABASE.value
        if any(k in img for k in ("redis", "memcached", "dragonfly")) \
                or s in ("redis", "cache", "valkey"):
            return ComponentRole.CACHE.value
        if any(k in img for k in ("minio/minio", "minio/mc", "seaweed", "s3")) \
                or s in ("minio", "storage", "s3", "minio-init"):
            return ComponentRole.STORAGE.value
        if any(k in img for k in ("rabbitmq", "nats", "kafka")) \
                or s in ("queue", "rabbitmq", "nats", "kafka"):
            return ComponentRole.QUEUE.value
        if any(k in img for k in ("traefik", "nginx", "caddy", "haproxy")) \
                or s in ("proxy", "traefik", "nginx", "lb"):
            return ComponentRole.PROXY.value
        if any(k in s for k in ("worker", "celery", "cron", "scheduler",
                                "evolution")) or "evolution-api" in img:
            return ComponentRole.WORKER.value
        if any(k in s for k in ("api", "backend", "server")) \
                or any(k in img for k in ("fastapi", "uvicorn", "gunicorn")):
            return ComponentRole.API.value
        if any(k in s for k in ("web", "frontend", "site", "app", "www")):
            return ComponentRole.WEB.value
        return ComponentRole.OTHER.value

    @classmethod
    def group_stacks(cls, rows: list[dict]) -> list[dict]:
        """Agrupa containers (discovery flat) por projeto compose.

        Sem label compose → stack standalone de 1 container (chave explícita,
        NUNCA por prefixo de nome).
        """
        groups: dict[str, dict] = {}
        for c in rows:
            raw_labels = c.get("_labels_raw")
            project = c.get("project") or cls._label_value(raw_labels, "com.docker.compose.project")
            cname = c.get("name", "?")
            key = f"compose:{project}" if project else f"standalone:{cname}"
            g = groups.get(key)
            if g is None:
                g = groups[key] = {
                    "key": key, "compose_project": project,
                    "name": project or cname, "containers": [],
                    "workdir": c.get("workdir"),
                }
                if not g["workdir"] and raw_labels is not None:
                    g["workdir"] = cls._label_value(
                        raw_labels, "com.docker.compose.project.working_dir")
            g["containers"].append(c)
        out = []
        for g in groups.values():
            domains = sorted({d for c in g["containers"]
                              for d in _traefik_hosts(
                                  cls._parse_ps_labels(c.get("_labels_raw")))})
            comp_rows = []
            for c in g["containers"]:
                role = cls.infer_role(c.get("service"), c.get("image"))
                if role == ComponentRole.OTHER.value and domains:
                    # Expõe domínio público mas papel desconhecido → é web.
                    role = ComponentRole.WEB.value
                comp_rows.append(
                    {"name": c.get("name"), "image": c.get("image"),
                     "status": c.get("status"), "ports": c.get("ports"),
                     "service": c.get("service"), "role": role})
            roles = sorted({c["role"] for c in comp_rows})
            states = [str(c.get("status") or "").lower()
                      for c in g["containers"]]
            running = sum(1 for s in states if s == "running")
            health = ("healthy" if running == len(states) and states
                      else "degraded" if running else "stopped")
            platform = cls._is_platform(
                g["compose_project"],
                g["containers"][0]["name"] if g["containers"] else "")
            # standalone: cada container decide sozinho
            if not g["compose_project"]:
                platform = all(cls._is_platform(
                    None, c["name"]) for c in g["containers"])
            out.append({
                "key": g["key"], "compose_project": g["compose_project"],
                "name": g["name"], "workdir": g["workdir"],
                "containers_total": len(g["containers"]),
                "containers_running": running, "health": health,
                "roles": roles, "domains": domains,
                "stack_type": (StackType.PLATFORM_INFRA.value if platform
                               else StackType.CUSTOMER_SERVICE.value),
                "containers": comp_rows,
            })
        return sorted(out, key=lambda g: (g["stack_type"], g["name"]))

    def discovery_stacks(self) -> list[dict]:
        """Discovery agrupado por stack + estado de vínculo (somente leitura)."""
        rows = []
        for c in self._provider.list_containers():
            raw = c.get("Labels")
            rows.append({
                "name": (c.get("Names") or "?").lstrip("/"),
                "image": c.get("Image"),
                "status": c.get("State"),
                "ports": c.get("Ports"),
                "project": self._label_value(raw, "com.docker.compose.project"),
                "workdir": self._label_value(
                    raw, "com.docker.compose.project.working_dir"),
                "service": self._label_value(raw, "com.docker.compose.service"),
                "_labels_raw": raw if isinstance(raw, dict) else raw,
            })
        return self.group_stacks(rows)

    async def stack_link_state(self, org_id: str | None = None) -> dict[str, dict]:
        """{(server,compose_project|standalone:name) -> vínculo} para o discovery."""
        server = await self._ensure_server(org_id or "innexar")
        q = select(HostingStack).where(HostingStack.server_id == server.id)
        if org_id:
            q = q.where(HostingStack.org_id == org_id)
        out: dict[str, dict] = {}
        for st in (await self._db.execute(q)).scalars().all():
            if st.compose_project:
                out[f"compose:{st.compose_project}"] = {
                    "stack_id": st.id, "customer_id": st.customer_id,
                    "name": st.name, "status": st.status,
                }
            else:
                for comp in st.components:
                    out[f"standalone:{comp.container_name}"] = {
                        "stack_id": st.id, "customer_id": st.customer_id,
                        "name": st.name, "status": st.status,
                    }
        return out

    async def link_stack(
        self, *, customer_id: int, org_id: str, compose_project: str | None,
        container_names: list[str], contract_item_id: int | None = None,
        name: str | None = None, primary_domain: str | None = None,
        stack_type: str = StackType.CUSTOMER_SERVICE.value,
        actor_type: str, actor_id: str | None,
    ) -> HostingStack:
        """Vincula a STACK inteira (gerência/metadados; não toca containers)."""
        names = sorted({c.strip() for c in container_names if c.strip()})
        if self._is_platform(compose_project, names[0] if names else ""):
            raise HostingError("platform_infra",
                               "Infra da plataforma não é vinculável a clientes")
        if stack_type == StackType.PLATFORM_INFRA.value:
            raise HostingError("platform_infra",
                               "Infra da plataforma não é vinculável a clientes")
        if not names:
            raise HostingError("empty_stack", "stack sem containers")
        server = await self._ensure_server(org_id)
        # Idempotência: mesma (server, compose_project) ou standalone.
        if compose_project:
            dup = (await self._db.execute(
                select(HostingStack).where(
                    HostingStack.server_id == server.id,
                    HostingStack.compose_project == compose_project,
                ))).scalar_one_or_none()
            if dup:
                await self._db.refresh(dup, ["components", "services"])
                return dup
            slug = compose_project
        else:
            slug = f"standalone-{container_names[0]}"
            dup = (await self._db.execute(
                select(HostingStack).where(
                    HostingStack.server_id == server.id,
                    HostingStack.slug == slug,
                ))).scalar_one_or_none()
            if dup:
                await self._db.refresh(dup, ["components", "services"])
                return dup
        stack = HostingStack(
            customer_id=customer_id, contract_item_id=contract_item_id,
            server_id=server.id, org_id=org_id,
            name=(name or compose_project or container_names[0]).strip(),
            slug=slug, compose_project=compose_project,
            primary_domain=(primary_domain or "").strip().lower() or None,
            status=HostingServiceStatus.ACTIVE.value, stack_type=stack_type,
            activated_at=utc_now(),
            meta={"containers": names},
        )
        self._db.add(stack)
        await self._db.flush()
        for cname in names:
            try:
                info = self._provider.inspect(cname)
            except HostingError:
                continue  # container sumiu entre discovery e link: ignora
            labels = (info.get("Config") or {}).get("Labels", {}) or {}
            svc_name = labels.get("com.docker.compose.service")
            image = (info.get("Config") or {}).get("Image")
            hosts = _traefik_hosts(labels)
            role = self.infer_role(svc_name, image)
            if role == ComponentRole.OTHER.value and hosts:
                role = ComponentRole.WEB.value
            comp = HostingComponent(
                stack_id=stack.id, container_name=info.get("Name", "").lstrip("/"),
                container_id=info.get("Id"), role=role, image=image,
                status=(info.get("State") or {}).get("Status"),
                is_public=bool(hosts), internal_only=not hosts,
                ports=None,
                meta={"compose_service": svc_name, "domains": hosts},
            )
            self._db.add(comp)
            await self._db.flush()
            svc = HostingService(
                customer_id=customer_id, contract_item_id=contract_item_id,
                server_id=server.id, stack_id=stack.id, org_id=org_id,
                container_name=comp.container_name, container_id=comp.container_id,
                project_name=compose_project, root_path="/app",
                path_mode="container", primary_domain=stack.primary_domain,
                environment="production",
                status=HostingServiceStatus.ACTIVE.value,
                activated_at=utc_now(),
            )
            self._db.add(svc)
        await self._db.flush()
        await self._audit(entity="hosting_stack", entity_id=str(stack.id),
                          action="hosting_stack_linked", actor_type=actor_type,
                          actor_id=actor_id, org_id=org_id,
                          payload={"project": compose_project,
                                   "containers": names,
                                   "contract_item_id": contract_item_id})
        await self._db.flush()
        await self._db.refresh(stack, ["components", "services"])
        return stack

    # -- link (admin) -------------------------------------------------------
    async def link_service(
        self, *, customer_id: int, org_id: str, container_name: str,
        root_path: str, path_mode: str = "container",
        primary_domain: str | None = None, environment: str = "production",
        actor_type: str, actor_id: str | None,
    ) -> HostingService:
        info = self._provider.inspect(container_name)
        real_name = info.get("Name", "").lstrip("/")
        server = await self._ensure_server(org_id)
        existing = (
            await self._db.execute(
                select(HostingService).where(
                    HostingService.customer_id == customer_id,
                    HostingService.container_name == real_name,
                )
            )
        ).scalar_one_or_none()
        if existing:
            return existing
        if path_mode not in ("container", "host"):
            raise HostingError("invalid_path", "path_mode deve ser container|host")
        if path_mode == "host" and not os.path.isdir(
                os.path.realpath(root_path)):
            raise HostingError("invalid_path", "root_path do host inexistente")
        svc = HostingService(
            customer_id=customer_id, org_id=org_id, server_id=server.id,
            container_name=real_name,
            container_id=info.get("Id"),
            project_name=(info.get("Config") or {}).get("Labels", {}).get(
                "com.docker.compose.project"),
            root_path=root_path, path_mode=path_mode,
            primary_domain=(primary_domain or "").strip().lower() or None,
            environment=environment, status=HostingServiceStatus.ACTIVE.value,
            activated_at=utc_now(),
        )
        self._db.add(svc)
        await self._db.flush()
        await self._audit(entity="hosting_service", entity_id=str(svc.id),
                          action="hosting_linked", actor_type=actor_type,
                          actor_id=actor_id, org_id=org_id,
                          payload={"container": real_name, "root_path": root_path})
        await self._db.flush()
        return svc

    async def _ensure_server(self, org_id: str) -> HostingServer:
        # Nome estável: hostname do container muda a cada recreate.
        hostname = socket.gethostname()
        r = await self._db.execute(
            select(HostingServer).where(HostingServer.name == "primary"))
        server = r.scalar_one_or_none()
        if server:
            if server.hostname != hostname:
                server.hostname = hostname
                await self._db.flush()
            return server
        server = HostingServer(name="primary", hostname=hostname, provider="docker",
                               region="hetzner-fsn?", environment="production",
                               status="unknown",
                               capabilities={"docker": True, "traefik": True})
        self._db.add(server)
        await self._db.flush()
        return server

    # -- tenant-scoped getters ----------------------------------------------
    async def _require_service(
        self, service_id: int, customer_id: int | None, org_id: str | None,
    ) -> HostingService:
        q = select(HostingService).where(HostingService.id == service_id)
        if customer_id is not None:
            q = q.where(HostingService.customer_id == customer_id)
        if org_id:
            q = q.where(HostingService.org_id == org_id)
        svc = (await self._db.execute(q)).scalar_one_or_none()
        if not svc:
            raise HostingError("unauthorized_hosting_access",
                                "Serviço não encontrado")
        return svc

    async def list_services(
        self, customer_id: int | None, org_id: str | None = None,
    ) -> list[HostingService]:
        q = select(HostingService).order_by(HostingService.id.desc())
        if customer_id is not None:
            q = q.where(HostingService.customer_id == customer_id)
        if org_id:
            q = q.where(HostingService.org_id == org_id)
        return list((await self._db.execute(q)).scalars().all())

    # -- overview -------------------------------------------------------------
    async def overview(self, svc: HostingService) -> dict:
        cname = svc.container_name or ""
        try:
            st = self._provider.status(cname)
            state, health, image = st.state, st.health, st.image
            uptime = st.uptime_seconds
        except HostingError:
            state, health, image, uptime = (
                RuntimeStatus.UNKNOWN.value, "unknown", "", None)
        if svc.status == HostingServiceStatus.SUSPENDED.value:
            state = RuntimeStatus.SUSPENDED.value
        try:
            metrics = self.metrics(cname)
        except HostingError:
            metrics = {}
        domains = self._service_domains(svc)
        ssl_info = _ssl_info(svc.primary_domain) if svc.primary_domain else {}
        dns = _dns_status(svc.primary_domain) if svc.primary_domain else {}
        return {
            "id": svc.id, "status": svc.status, "runtime": state,
            "health": health, "image": image, "uptime_seconds": uptime,
            "container": cname, "project": svc.project_name,
            "primary_domain": svc.primary_domain, "domains": domains,
            "ssl": ssl_info, "dns": dns, "metrics": metrics,
            "environment": svc.environment,
            "internal_port": svc.internal_port,
            "last_deploy_at": svc.last_deploy_at.isoformat()
            if svc.last_deploy_at else None,
            "last_backup_at": svc.last_backup_at.isoformat()
            if svc.last_backup_at else None,
        }

    def _service_domains(self, svc: HostingService) -> list[str]:
        if not svc.container_name:
            return []
        try:
            info = self._provider.inspect(svc.container_name)
        except HostingError:
            return []
        return _traefik_hosts((info.get("Config") or {}).get("Labels", {}))

    def metrics(self, container: str) -> dict:
        now = time.time()
        hit = _metrics_cache.get(container)
        if hit and now - hit[0] < 30:
            return hit[1]
        data = self._provider.metrics(container)
        _metrics_cache[container] = (now, data)
        return data

    def deploy_info(self, svc: HostingService) -> dict:
        out: dict = {"branch": None, "commit": None, "container_started": None,
                     "image": None}
        if svc.container_name:
            try:
                info = self._provider.inspect(svc.container_name)
                out["container_started"] = (info.get("State") or {}).get("StartedAt")
                out["image"] = (info.get("Config") or {}).get("Image")
            except HostingError:
                pass
        if svc.path_mode == "host" and svc.root_path:
            git_dir = os.path.join(os.path.realpath(svc.root_path), ".git")
            if os.path.isdir(git_dir):
                import subprocess as _sp

                for args, key in ((["branch", "--show-current"], "branch"),
                                  (["rev-parse", "--short", "HEAD"], "commit")):
                    try:
                        r = _sp.run(["git", "-C", os.path.realpath(svc.root_path),
                                     *args], capture_output=True, text=True, timeout=10)
                        if r.returncode == 0:
                            out[key] = r.stdout.strip() or None
                    except (OSError, _sp.TimeoutExpired):
                        pass
        return out

    # -- jobs ------------------------------------------------------------------
    async def _conflict_job(self, service_id: int, job_type: str) -> bool:
        conflicts = CONFLICTING_JOBS.get(job_type, set())
        if not conflicts:
            return False
        r = await self._db.execute(
            select(HostingJob).where(
                HostingJob.hosting_service_id == service_id,
                HostingJob.job_type.in_(conflicts),
                HostingJob.status.in_(["pending", "processing"]),
            )
        )
        return r.scalars().first() is not None

    async def enqueue_job(
        self, *, service_id: int, org_id: str, job_type: str,
        payload: dict | None = None, invoice_id: int | None = None,
        idempotency_key: str | None = None,
    ) -> HostingJob:
        if await self._conflict_job(service_id, job_type):
            raise HostingError("job_conflict",
                                "Já existe operação conflitante em andamento")
        if idempotency_key:
            existing = (
                await self._db.execute(
                    select(HostingJob).where(
                        HostingJob.idempotency_key == idempotency_key)
                )
            ).scalar_one_or_none()
            if existing:
                return existing
        job = HostingJob(
            hosting_service_id=service_id, org_id=org_id, job_type=job_type,
            status="pending", payload=payload, invoice_id=invoice_id,
            idempotency_key=idempotency_key,
        )
        self._db.add(job)
        await self._db.flush()
        return job

    async def run_job(self, job: HostingJob) -> None:
        job.status = "processing"
        job.attempts = (job.attempts or 0) + 1
        await self._db.flush()
        try:
            svc = await self._db.get(HostingService, job.hosting_service_id)
            if not svc or not svc.container_name:
                raise HostingError("job_failed", "serviço sem container")
            cname = svc.container_name
            if job.job_type == "hosting_restart":
                self._provider.restart(cname)
            elif job.job_type == "hosting_start":
                self._provider.start(cname)
            elif job.job_type == "hosting_stop":
                self._provider.stop(cname)
            elif job.job_type == "hosting_suspend":
                self._provider.stop(cname)
                svc.status = HostingServiceStatus.SUSPENDED.value
            elif job.job_type == "hosting_reactivate":
                self._provider.start(cname)
                svc.status = HostingServiceStatus.ACTIVE.value
            elif job.job_type == "hosting_backup":
                ref = await self._do_backup(svc, job)
                svc.last_backup_at = utc_now()
                job.payload = {**(job.payload or {}), "storage_reference": ref}
            elif job.job_type == "hosting_restore":
                await self._do_restore(svc, job)
            else:
                raise HostingError("job_failed", f"tipo {job.job_type} desconhecido")
            job.status = "completed"
            job.completed_at = utc_now()
        except Exception as e:  # noqa: BLE001 (worker não pode morrer)
            job.status = "failed"
            job.last_error = str(e)[:500]
            logger.exception("hosting job %s failed", job.id)
        await self._db.flush()

    # -- backups -----------------------------------------------------------------
    async def _do_backup(self, svc: HostingService,
                         job: HostingJob) -> str:
        payload = job.payload or {}
        retention = int(payload.get("retention", 5))
        dest_dir = os.path.join(HOSTING_BACKUP_ROOT, str(svc.id))
        os.makedirs(dest_dir, exist_ok=True)
        ts = utc_now().strftime("%Y%m%d-%H%M%S")
        if svc.path_mode == "host" and svc.root_path:
            root_real = os.path.realpath(svc.root_path)
            if not os.path.isdir(root_real):
                raise HostingError("job_failed", "root_path inexistente")
            fname = f"backup-{ts}.tgz"
            dest = os.path.join(dest_dir, fname)
            with tarfile.open(dest, "w:gz") as tf:
                tf.add(root_real, arcname=".")
        else:
            if not svc.container_name:
                raise HostingError("job_failed", "sem container")
            base = (svc.root_path or "/app").strip() or "/app"
            raw = self._provider._read_cp(  # noqa: SLF001 (mesmo módulo lógico)
                svc.container_name, base)
            fname = f"backup-{ts}.tgz"
            dest = os.path.join(dest_dir, fname)
            with open(dest, "wb") as f:
                f.write(raw)
        size = os.path.getsize(dest)
        sha = hashlib.sha256()
        with open(dest, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                sha.update(chunk)
        from app.modules.hosting.models import HostingBackup

        self._db.add(HostingBackup(
            hosting_service_id=svc.id, backup_type="files",
            status="completed", size_bytes=size,
            checksum=sha.hexdigest(), storage_reference=dest,
            created_by=(job.payload or {}).get("actor"),
            started_at=job.updated_at, completed_at=utc_now(),
        ))
        # retention: expira além dos N mais recentes
        rows = (
            await self._db.execute(
                select(HostingBackup).where(
                    HostingBackup.hosting_service_id == svc.id,
                    HostingBackup.status == "completed",
                ).order_by(HostingBackup.id.desc())
            )
        ).scalars().all()
        for old in rows[retention:]:
            try:
                if old.storage_reference and os.path.isfile(old.storage_reference):
                    os.remove(old.storage_reference)
            except OSError:
                pass
            old.status = "expired"
        await self._db.flush()
        return dest

    async def _do_restore(self, svc: HostingService, job: HostingJob) -> None:
        from app.modules.hosting.models import HostingBackup

        payload = job.payload or {}
        backup_id = payload.get("backup_id")
        if not backup_id:
            raise HostingError("job_failed", "backup_id ausente")
        bak = await self._db.get(HostingBackup, int(backup_id))
        if not bak or not bak.storage_reference or not os.path.isfile(
                bak.storage_reference):
            raise HostingError("job_failed", "backup indisponível")
        if svc.path_mode == "host" and svc.root_path:
            root_real = os.path.realpath(svc.root_path)
            with tarfile.open(bak.storage_reference, "r:gz") as tf:
                tf.extractall(root_real)
        else:
            if not svc.container_name:
                raise HostingError("job_failed", "sem container")
            import subprocess as _sp

            with open(bak.storage_reference, "rb") as f:
                r = _sp.run(["docker", "cp", "-",
                             f"{svc.container_name}:{(svc.root_path or '/app').strip() or '/app'}"],
                            input=f.read(), capture_output=True, timeout=300,
                            check=False)
            if r.returncode != 0:
                raise HostingError("job_failed", "restore falhou")

    # -- files ---------------------------------------------------------------------
    def _base(self, svc: HostingService) -> tuple[str, str]:
        if svc.path_mode == "host":
            if not svc.root_path or not os.path.isdir(os.path.realpath(svc.root_path)):
                raise HostingError("invalid_path", "root_path inválido")
            return ("host", os.path.realpath(svc.root_path))
        if not svc.container_name:
            raise HostingError("invalid_path", "sem container vinculado")
        return ("container", (svc.root_path or "/app").strip() or "/app")

    def list_files(self, svc: HostingService, rel: str) -> list[dict]:
        mode, base = self._base(svc)
        if mode == "host":
            return DockerHostingProvider.host_list(base, rel or ".")
        return self._provider.list_files(svc.container_name or "", base, rel or ".")

    def read_file(self, svc: HostingService, rel: str) -> bytes:
        mode, base = self._base(svc)
        if mode == "host":
            return DockerHostingProvider.host_read(base, rel)
        return self._provider.read_file(svc.container_name or "", base, rel)

    async def write_file(
        self, svc: HostingService, rel: str, data: bytes,
        *, actor_type: str, actor_id: str | None,
    ) -> dict:
        from app.modules.hosting.models import FileRevision

        mode, base = self._base(svc)
        # revision ANTES de editar
        before: bytes | None = None
        try:
            before = self.read_file(svc, rel)
        except HostingError:
            before = None
        rev = FileRevision(
            hosting_service_id=svc.id, path=paths.validate(rel, for_edit=True),
            checksum_before=(hashlib.sha256(before).hexdigest() if before else None),
            content_before=(before.decode(errors="replace")
                            if before and len(before) <= paths.MAX_REVISION_BYTES
                            else None),
            actor_id=actor_id,
        )
        self._db.add(rev)
        await self._db.flush()
        if mode == "host":
            DockerHostingProvider.host_write(base, rel, data)
        else:
            self._provider.write_file(svc.container_name or "", base, rel, data)
        rev.checksum_after = hashlib.sha256(data).hexdigest()
        await self._audit(entity="file_revision", entity_id=str(rev.id),
                          action="hosting_file_updated", actor_type=actor_type,
                          actor_id=actor_id, org_id=svc.org_id,
                          payload={"service_id": svc.id, "path": rev.path})
        await self._db.flush()
        return {"revision_id": rev.id, "path": rev.path}
