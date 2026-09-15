"""Path security for the file manager (Fase 4, §33-36).

Strict: normalize -> decode traps -> blocklist -> containment.
"""

from __future__ import annotations

import os
from urllib.parse import unquote

MAX_READ_BYTES = 2 * 1024 * 1024
MAX_REVISION_BYTES = 100 * 1024

BLOCKED_NAMES = {
    ".env",
    ".env.local",
    ".env.production",
    ".env.example",
    "dockerfile",
    "docker-compose.yml",
    "docker-compose.yaml",
    "docker-compose.override.yml",
    ".dockerignore",
    ".git",
    ".ssh",
    ".traefik",
    "traefik.yml",
    "traefik.yaml",
    "id_rsa",
    "id_ed25519",
    "known_hosts",
}
BLOCKED_SUFFIXES = (".pem", ".key", ".p12", ".pfx", ".asc", ".gpg")
BLOCKED_SUBSTRINGS = ("secret", "credential", "passwd", "shadow")

ALLOWED_EDIT_EXTS = {
    ".html",
    ".htm",
    ".css",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".json",
    ".php",
    ".md",
    ".markdown",
    ".txt",
    ".yml",
    ".yaml",
    ".xml",
    ".svg",
    ".csv",
    ".htaccess",
}


class PathError(Exception):
    pass


def _decode_traps(rel: str) -> str:
    once = unquote(rel)
    twice = unquote(once)
    if twice != once:
        raise PathError("double encoding bloqueado")
    return once


def normalize(rel: str) -> str:
    """Retorna caminho relativo seguro (sem leading /) ou levanta PathError."""
    if not rel or not rel.strip():
        raise PathError("caminho vazio")
    if "\x00" in rel:
        raise PathError("null byte bloqueado")
    if "\\" in rel:
        raise PathError("separador alternativo bloqueado")
    rel = _decode_traps(rel.strip())
    if rel.startswith("/") or rel.startswith("~"):
        raise PathError("caminho absoluto bloqueado")
    parts: list[str] = []
    for part in rel.split("/"):
        if part in ("", "."):
            continue
        if part == "..":
            raise PathError("traversal bloqueado (..)")
        if any(ord(ch) < 32 for ch in part):
            raise PathError("caractere de controle bloqueado")
        parts.append(part)
    if not parts:
        return "."
    return "/".join(parts)


def check_name_allowed(rel: str, *, for_edit: bool = False) -> None:
    base = rel.rsplit("/", 1)[-1].lower()
    if base in BLOCKED_NAMES:
        raise PathError(f"arquivo bloqueado: {base}")
    if base.endswith(BLOCKED_SUFFIXES):
        raise PathError(f"extensão bloqueada: {base}")
    if any(s in base for s in BLOCKED_SUBSTRINGS):
        raise PathError(f"nome sensível bloqueado: {base}")
    if rel.lower().startswith((".git/", ".ssh/")):
        raise PathError("diretório bloqueado")
    if for_edit:
        ext = "." + base.rsplit(".", 1)[-1] if "." in base else ""
        if ext not in ALLOWED_EDIT_EXTS:
            raise PathError(f"edição não permitida para: {base}")


def contain(root_real: str, rel: str) -> str:
    """Junta root (já realpath) + rel normalizado; garante contenção (symlink escape)."""
    safe_rel = normalize(rel)
    full = os.path.realpath(os.path.join(root_real, safe_rel))
    if full != root_real and not full.startswith(root_real + os.sep):
        raise PathError("escape do root bloqueado (symlink?)")
    return full


def validate(rel: str, *, for_edit: bool = False) -> str:
    """Atalho: normalize + blocklist. Retorna rel seguro."""
    safe = normalize(rel)
    check_name_allowed(safe, for_edit=for_edit)
    return safe
