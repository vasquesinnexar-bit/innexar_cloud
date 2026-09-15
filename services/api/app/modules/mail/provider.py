"""Mail provider backed by docker-mailserver's `setup` CLI.

Runs `docker exec <MAIL_CONTAINER> setup ...` (same pattern as mail-admin).
Passwords are passed as argv like the official CLI expects and are NEVER logged.
"""

from __future__ import annotations

import os
import re
import subprocess
from dataclasses import dataclass


MAIL_CONTAINER = os.environ.get("MAIL_CONTAINER", "innexar-mailserver")

_ACCOUNT_RE = re.compile(
    r"^\*\s+(?P<email>[^\s]+)\s+\(\s*(?P<used>[^/]+)/\s*(?P<quota>[^)]+)\)"
    r"(?:\s*\[(?P<pct>\d+)%\])?"
)
_ALIAS_RE = re.compile(r"^\*\s+(?P<alias>[^\s]+)\s+(?P<target>.+)$")


class MailProviderError(Exception):
    pass


@dataclass
class MailboxInfo:
    address: str
    used: str
    quota: str
    pct: str


@dataclass
class AliasInfo:
    alias: str
    target: str


def _run(*args: str, timeout: int = 120) -> str:
    """Run setup CLI. Raises MailProviderError without leaking secrets."""
    try:
        r = subprocess.run(
            ["docker", "exec", MAIL_CONTAINER, "setup", *args],
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except (subprocess.TimeoutExpired, FileNotFoundError) as e:
        raise MailProviderError(f"mail provider unavailable ({type(e).__name__})") from e
    if r.returncode != 0:
        # Never include argv (may contain password).
        raise MailProviderError((r.stderr or r.stdout or "setup failed").strip()[:300])
    return r.stdout or ""


class DockerMailserverProvider:
    """Concrete MailProvider for docker-mailserver."""

    name = "docker-mailserver"

    # -- mailboxes ------------------------------------------------------
    def list_mailboxes(self) -> list[MailboxInfo]:
        out = _run("email", "list")
        result: list[MailboxInfo] = []
        for line in out.splitlines():
            m = _ACCOUNT_RE.match(line.strip())
            if m:
                result.append(
                    MailboxInfo(
                        address=m.group("email"),
                        used=m.group("used").strip(),
                        quota=m.group("quota").strip(),
                        pct=m.group("pct") or "0",
                    )
                )
        return result

    def mailbox_exists(self, address: str) -> bool:
        addr = address.strip().lower()
        return any(m.address.lower() == addr for m in self.list_mailboxes())

    def create_mailbox(self, address: str, password: str) -> None:
        _run("email", "add", address.strip().lower(), password)

    def change_password(self, address: str, password: str) -> None:
        _run("email", "update", address.strip().lower(), password)

    def delete_mailbox(self, address: str) -> None:
        _run("email", "del", address.strip().lower())

    def set_quota(self, address: str, quota: str | None) -> None:
        if quota:
            _run("quota", "set", address.strip().lower(), quota.strip())
        else:
            _run("quota", "del", address.strip().lower())

    def _restricted(self, direction: str) -> set[str]:
        """Addresses currently restricted (idempotency guard — `restrict add`
        falha se já restrito)."""
        try:
            out = _run("email", "restrict", "list", direction)
        except MailProviderError:
            return set()
        addrs: set[str] = set()
        for line in out.splitlines():
            parts = line.split()
            if parts:
                addrs.add(parts[0].strip().lower())
        return addrs

    def disable_mailbox(self, address: str) -> None:
        """Reversible: reject send+receive, password untouched (idempotent)."""
        addr = address.strip().lower()
        for direction in ("send", "receive"):
            if addr not in self._restricted(direction):
                _run("email", "restrict", "add", direction, addr)

    def enable_mailbox(self, address: str) -> None:
        """Idempotent: remove restrictions only where present."""
        addr = address.strip().lower()
        for direction in ("send", "receive"):
            if addr in self._restricted(direction):
                _run("email", "restrict", "del", direction, addr)

    # -- aliases --------------------------------------------------------
    def list_aliases(self) -> list[AliasInfo]:
        out = _run("alias", "list")
        result: list[AliasInfo] = []
        for line in out.splitlines():
            m = _ALIAS_RE.match(line.strip())
            if m:
                result.append(
                    AliasInfo(alias=m.group("alias"), target=m.group("target").strip())
                )
        return result

    # -- domains --------------------------------------------------------
    def list_domains(self) -> list[str]:
        """Domains known to the mailserver (from accounts + DKIM key dirs)."""
        domains: set[str] = set()
        for m in self.list_mailboxes():
            if "@" in m.address:
                domains.add(m.address.split("@", 1)[1].lower())
        try:
            r = subprocess.run(
                ["docker", "exec", MAIL_CONTAINER, "ls",
                 "/tmp/docker-mailserver/opendkim/keys"],
                capture_output=True, text=True, timeout=30, check=False,
            )
            if r.returncode == 0:
                domains.update(d.strip().lower() for d in r.stdout.split() if "." in d)
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass
        return sorted(domains)

    def read_dkim_txt(self, domain: str) -> str | None:
        """Chave pública DKIM (mail.txt) para colar no DNS. Sem segredos."""
        import re as _re

        domain = (domain or "").strip().lower()
        if not _re.fullmatch(r"(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}", domain):
            return None
        try:
            r = subprocess.run(
                ["docker", "exec", MAIL_CONTAINER, "cat",
                 f"/tmp/docker-mailserver/opendkim/keys/{domain}/mail.txt"],
                capture_output=True, text=True, timeout=30, check=False,
            )
        except (subprocess.TimeoutExpired, FileNotFoundError):
            return None
        if r.returncode != 0:
            return None
        return r.stdout.strip() or None
