"""DockerHostingProvider: status/metrics/logs/restart/files/backups via Docker CLI.

Backend-only (docker.sock montado como no mail-admin). Nunca exposto ao frontend.
Segredos nunca em logs. File ops sempre via paths.py (contenção + blocklist).
"""

from __future__ import annotations

import io
import json
import logging
import os
import re
import subprocess
import tarfile
import time
from dataclasses import dataclass

from app.modules.hosting import paths
from app.modules.hosting.enums import RuntimeStatus

logger = logging.getLogger(__name__)

REDACT_RES = [
    re.compile(r"(?i)(bearer\s+)[A-Za-z0-9\-._~+/=]+"),
    re.compile(r"(?i)(authorization\s*:\s*)[^\s]+"),
    re.compile(r"(?i)(api[_-]?key\s*[=:]\s*)[^\s&;]+"),
    re.compile(r"(?i)(password\s*[=:]\s*)[^\s&;]+"),
    re.compile(r"(?i)(passwd\s*[=:]\s*)[^\s&;]+"),
    re.compile(r"(?i)(secret\s*[=:]\s*)[^\s&;]+"),
    re.compile(r"(?i)((?:set-)?cookie\s*:\s*)[^\n]+"),
    re.compile(r"(?i)(token\s*[=:]\s*)[^\s&;]+"),
]


def redact(text: str) -> str:
    for rx in REDACT_RES:
        text = rx.sub(r"\1[REDACTED]", text)
    return text


class HostingError(Exception):
    """Erro de domínio com código estável (exibido ao frontend)."""

    def __init__(self, code_or_message: str = "error", detail: str = ""):
        super().__init__(detail or code_or_message)
        # Uso com 1 arg (provider interno) => code genérico; 2 args => código.
        if detail:
            self.code = code_or_message
            self.detail = detail
        else:
            self.code = "job_failed"
            self.detail = code_or_message


def _docker(*args: str, timeout: int = 60, input_bytes: bytes | None = None) -> str:
    try:
        r = subprocess.run(
            ["docker", *args], input=input_bytes, capture_output=True,
            timeout=timeout, check=False,
        )
    except (subprocess.TimeoutExpired, FileNotFoundError) as e:
        raise HostingError(f"docker indisponível ({type(e).__name__})") from e
    if r.returncode != 0:
        err = (r.stderr or b"").decode(errors="replace").strip()[:200]
        raise HostingError(err or "docker falhou")
    return (r.stdout or b"").decode(errors="replace")


@dataclass
class ContainerStatus:
    name: str
    state: str  # RuntimeStatus
    health: str
    image: str
    uptime_seconds: int | None
    started_at: str | None


def _map_state(state: str, health: str) -> str:
    s = (state or "").lower()
    if s == "running":
        if (health or "").lower() == "unhealthy":
            return RuntimeStatus.DEGRADED.value
        return RuntimeStatus.ONLINE.value
    if s == "restarting":
        return RuntimeStatus.RESTARTING.value
    if s == "removing":
        return RuntimeStatus.STOPPING.value
    if s == "paused":
        return RuntimeStatus.DEGRADED.value
    if s in ("exited", "dead"):
        return RuntimeStatus.OFFLINE.value
    if s == "created":
        return RuntimeStatus.OFFLINE.value
    return RuntimeStatus.UNKNOWN.value


def _parse_size_to_bytes(raw: str) -> int | None:
    m = re.match(r"^\s*([\d.]+)\s*([KMGT]?i?B)?\s*$", (raw or "").strip(), re.I)
    if not m:
        return None
    num, unit = float(m.group(1)), (m.group(2) or "B").upper()
    mult = {"B": 1, "KB": 1000, "MB": 1000**2, "GB": 1000**3, "TB": 1000**4,
            "KIB": 1024, "MIB": 1024**2, "GIB": 1024**3, "TIB": 1024**4}
    return int(num * mult.get(unit, 1))


class DockerHostingProvider:
    """Implementação Docker do HostingProvider."""

    name = "docker"

    # -- discovery / status -------------------------------------------
    def list_containers(self) -> list[dict]:
        out = _docker("ps", "-a", "--format", "{{json .}}")
        rows = []
        for line in out.splitlines():
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue
        return rows

    def inspect(self, name: str) -> dict:
        try:
            return json.loads(_docker("inspect", name))[0]
        except (HostingError, IndexError, json.JSONDecodeError) as e:
            raise HostingError(f"container {name} inacessível") from e

    def status(self, name: str) -> ContainerStatus:
        info = self.inspect(name)
        state = (info.get("State") or {})
        started = state.get("StartedAt")
        uptime = None
        try:
            if state.get("Running") and started:
                uptime = max(
                    0, int(time.time() - time.mktime(time.strptime(
                        started[:19], "%Y-%m-%dT%H:%M:%S"))))
        except (ValueError, OverflowError):
            uptime = None
        return ContainerStatus(
            name=info.get("Name", "").lstrip("/"),
            state=_map_state(state.get("Status", ""), state.get("Health", {}).get("Status", "")
                             if isinstance(state.get("Health"), dict) else ""),
            health=(state.get("Health", {}) or {}).get("Status", "") or "none",
            image=(info.get("Config") or {}).get("Image", ""),
            uptime_seconds=uptime,
            started_at=started,
        )

    def metrics(self, name: str) -> dict:
        """Uma coleta (sem stream). Retorna dict serializável."""
        try:
            line = _docker("stats", "--no-stream", "--format", "{{json .}}", name,
                           timeout=30).splitlines()[0]
            s = json.loads(line)
        except (HostingError, IndexError, json.JSONDecodeError) as e:
            raise HostingError(f"metrics indisponíveis p/ {name}") from e
        mem_used_raw, _, mem_lim_raw = (s.get("MemUsage") or "/").partition("/")
        net_rx_raw, _, net_tx_raw = (s.get("NetIO") or "/").partition("/")
        st = self.status(name)
        return {
            "cpu_pct": (s.get("CPUPerc") or "").strip(),
            "mem_used_bytes": _parse_size_to_bytes(mem_used_raw),
            "mem_limit_bytes": _parse_size_to_bytes(mem_lim_raw),
            "net_rx_bytes": _parse_size_to_bytes(net_rx_raw),
            "net_tx_bytes": _parse_size_to_bytes(net_tx_raw),
            "uptime_seconds": st.uptime_seconds,
            "state": st.state,
        }

    def logs(self, name: str, tail: int = 200) -> str:
        tail = max(1, min(int(tail or 200), 1000))
        return redact(_docker("logs", "--tail", str(tail), name, timeout=30))

    # -- power (idempotentes) ------------------------------------------
    def restart(self, name: str, timeout: int = 90) -> None:
        before = self.status(name)
        if before.state == RuntimeStatus.RESTARTING.value:
            return
        _docker("restart", "-t", "15", name, timeout=timeout)

    def start(self, name: str) -> None:
        if self.status(name).state == RuntimeStatus.ONLINE.value:
            return
        _docker("start", name)

    def stop(self, name: str, timeout: int = 60) -> None:
        if self.status(name).state == RuntimeStatus.OFFLINE.value:
            return
        _docker("stop", "-t", "15", name, timeout=timeout)

    # -- files -----------------------------------------------------------
    @staticmethod
    def _cjoin(base: str, rel: str) -> str:
        """Junta base (abs no container) + rel validado, sem escape."""
        import posixpath

        safe = paths.validate(rel or ".", for_edit=False)
        base_n = "/" + (base or "").strip("/")
        joined = posixpath.normpath(posixpath.join(base_n, safe))
        if joined != base_n and not joined.startswith(base_n.rstrip("/") + "/"):
            raise HostingError("escape do root bloqueado")
        return joined

    def _exec_ls(self, container: str, path: str) -> list[dict]:
        out = _docker("exec", container, "ls", "-la", "--", path, timeout=30)
        entries = []
        for line in out.splitlines()[1:]:  # pula "total N"
            parts = line.split(None, 8)
            if len(parts) < 9:
                continue
            perms, _, _, _, size, mon, day, timeyear, fname = parts
            if fname in (".", ".."):
                continue
            ftype = "dir" if perms.startswith("d") else (
                "link" if perms.startswith("l") else "file")
            try:
                size_n: int | None = int(size)
            except ValueError:
                size_n = None
            entries.append({"name": fname, "type": ftype, "size": size_n,
                            "mtime": f"{mon} {day} {timeyear}", "perms": perms})
        return entries

    def _resolve_container(self, container: str, base: str, rel: str) -> str:
        """readlink -f + contenção ANTES de operar (anti-symlink-escape)."""
        full = self._cjoin(base, rel)
        base_n = "/" + (base or "").strip("/")
        try:
            resolved = _docker("exec", container, "readlink", "-f", "--",
                               full, timeout=30).strip()
        except HostingError:
            # alvo inexistente (ex. novo arquivo): valida o pai existente
            parent = full.rsplit("/", 1)[0] or "/"
            if parent == base_n:
                return full
            resolved_parent = _docker("exec", container, "readlink", "-f", "--",
                                      parent, timeout=30).strip()
            if resolved_parent != base_n and not resolved_parent.startswith(
                    base_n.rstrip("/") + "/"):
                raise HostingError("invalid_path", "escape do root bloqueado")
            return full
        if resolved != base_n and not resolved.startswith(base_n.rstrip("/") + "/"):
            raise HostingError("invalid_path",
                               "escape do root bloqueado (symlink)")
        return resolved

    def list_files(self, container: str, base: str, rel: str) -> list[dict]:
        return self._exec_ls(container, self._cjoin(base, rel or "."))

    def read_file(self, container: str, base: str, rel: str) -> bytes:
        data = self._read_cp(container, self._resolve_container(container, base, rel))
        if len(data) > paths.MAX_READ_BYTES:
            raise HostingError("arquivo excede 2MB")
        return data

    def _read_cp(self, container: str, abspath: str) -> bytes:
        raw = subprocess.run(
            ["docker", "cp", f"{container}:{abspath}", "-"],
            capture_output=True, timeout=60, check=False,
        ).stdout or b""
        try:
            with tarfile.open(fileobj=io.BytesIO(raw)) as tf:
                member = next((m for m in tf.getmembers() if m.isfile()), None)
                if not member:
                    raise HostingError("não é arquivo regular")
                f = tf.extractfile(member)
                return f.read() if f else b""
        except (tarfile.TarError, StopIteration) as e:
            raise HostingError("leitura falhou") from e

    def write_file(self, container: str, base: str, rel: str, data: bytes) -> None:
        full = self._resolve_container(container, base, rel)
        paths.validate(rel, for_edit=True)
        if len(data) > paths.MAX_READ_BYTES:
            raise HostingError("arquivo excede 2MB")
        name = full.rsplit("/", 1)[-1]
        buf = io.BytesIO()
        with tarfile.open(fileobj=buf, mode="w") as tf:
            ti = tarfile.TarInfo(name=name)
            ti.size = len(data)
            ti.mtime = int(time.time())
            tf.addfile(ti, io.BytesIO(data))
        parent = full.rsplit("/", 1)[0] or "/"
        r = subprocess.run(
            ["docker", "cp", "-", f"{container}:{parent}"],
            input=buf.getvalue(), capture_output=True, timeout=60, check=False,
        )
        if r.returncode != 0:
            raise HostingError("escrita falhou")
        resolved = _docker("exec", container, "readlink", "-f", "--",
                           full, timeout=30).strip()
        base_n = "/" + (base or "").strip("/")
        if resolved != base_n and not resolved.startswith(base_n.rstrip("/") + "/"):
            raise HostingError("verificação pós-escrita falhou")

    def make_dir(self, container: str, base: str, rel: str) -> None:
        _docker("exec", container, "mkdir", "-p", "--",
                self._resolve_container(container, base, rel), timeout=30)

    def rename(self, container: str, base: str, old_rel: str, new_rel: str) -> None:
        old = self._resolve_container(container, base, old_rel)
        new = self._cjoin(base, new_rel)
        paths.validate(new_rel, for_edit=True)
        _docker("exec", container, "mv", "--", old, new, timeout=30)

    def delete_path(self, container: str, base: str, rel: str,
                    recursive: bool = False) -> None:
        full = self._resolve_container(container, base, rel)
        base_n = "/" + (base or "").strip("/")
        if full == base_n:
            raise HostingError("recusa: apagar o root")
        args = ["exec", container, "rm", "-rf" if recursive else "-f", "--", full]
        _docker(*args, timeout=60)

    # -- host-mode files (root_path em disco) ------------------------------
    @staticmethod
    def host_list(root_real: str, rel: str) -> list[dict]:
        full = paths.contain(root_real, rel or ".")
        if not os.path.isdir(full):
            raise HostingError("não é diretório")
        entries = []
        with os.scandir(full) as it:
            for e in it:
                try:
                    st = e.stat(follow_symlinks=False)
                except OSError:
                    continue
                entries.append({
                    "name": e.name,
                    "type": "dir" if e.is_dir(follow_symlinks=False)
                    else ("link" if e.is_symlink() else "file"),
                    "size": st.st_size, "mtime": int(st.st_mtime), "perms": "",
                })
        return entries

    @staticmethod
    def host_read(root_real: str, rel: str) -> bytes:
        full = paths.contain(root_real, rel)  # resolve symlinks + contenção
        if not os.path.isfile(full):
            raise HostingError("não é arquivo regular")
        if os.path.getsize(full) > paths.MAX_READ_BYTES:
            raise HostingError("arquivo excede 2MB")
        with open(full, "rb") as f:
            return f.read()

    @staticmethod
    def host_write(root_real: str, rel: str, data: bytes) -> None:
        paths.validate(rel, for_edit=True)
        if len(data) > paths.MAX_READ_BYTES:
            raise HostingError("arquivo excede 2MB")
        full = paths.contain(root_real, rel)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "wb") as f:
            f.write(data)
