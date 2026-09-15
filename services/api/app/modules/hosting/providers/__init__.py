"""Hosting providers (Fase 4): base protocol + Docker + legacy Hestia concept."""

from app.modules.hosting.providers.base import DockerHostingProviderProtocol
from app.modules.hosting.providers.hestia import (
    HestiaHostingProtocol,
    HostingProviderProtocol,
)

__all__ = [
    "DockerHostingProviderProtocol",
    "HestiaHostingProtocol",
    "HostingProviderProtocol",
]
