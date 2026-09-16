"""Cache TTL em processo para leituras caras e idempotentes.

Uso: agregações de status/uso (docker exec, TLS, DNS) que toleram segundos
de defasagem. Single-worker: sem dependência externa, sem falha em cascata
— qualquer erro interno retorna MISS (nunca quebra a resposta).
"""

from __future__ import annotations

import contextlib
import time

_store: dict[str, tuple[float, object]] = {}


def get(key: str, ttl_s: float):
    """Retorna (hit, value). Nunca levanta exceção."""
    try:
        ts, value = _store.get(key, (0.0, None))
        if ts and (time.monotonic() - ts) < ttl_s:
            return True, value
    except Exception:  # noqa: BLE001 (cache nunca quebra resposta)
        pass
    return False, None


def put(key: str, value: object) -> None:
    with contextlib.suppress(Exception):
        _store[key] = (time.monotonic(), value)


def invalidate(*keys: str) -> None:
    for key in keys:
        _store.pop(key, None)


def invalidate_prefix(prefix: str) -> None:
    for key in [k for k in _store if k.startswith(prefix)]:
        _store.pop(key, None)
