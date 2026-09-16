"""OnboardingRegistry (P1.3): tipo → handler. Sem if slug espalhado."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from app.modules.onboarding.enums import OnboardingType


@dataclass(frozen=True)
class StepDef:
    key: str
    position: int
    required: bool = True
    auto: bool = False  # executado pelo motor/cron, sem input do cliente


@dataclass
class StepResult:
    ok: bool
    error: str | None = None
    step_data: dict | None = None
    advance: bool = True


class OnboardingHandler(Protocol):
    """Contrato dos handlers de onboarding por tipo."""

    type: str

    def steps(self) -> list[StepDef]: ...  # pragma: no cover

    async def submit(
        self,
        db,
        session,
        step_key: str,
        data: dict,
        *,
        actor_type: str,
        actor_id: str | None,
    ) -> StepResult: ...  # pragma: no cover

    async def auto_run(self, db, session, step_key: str) -> StepResult:
        """Execução automática de step auto (cron/motor). Default: pula."""
        return StepResult(ok=True)  # pragma: no cover


# fulfillment.handler_key → onboarding type
HANDLER_TO_ONBOARDING: dict[str, str] = {
    "mail": OnboardingType.PROFESSIONAL_EMAIL.value,
    "project": OnboardingType.WEBSITE_PROJECT.value,
    "hestia": OnboardingType.MANUAL.value,
    "manual": OnboardingType.MANUAL.value,
}

_REGISTRY: dict[str, type] = {}


def register(type_key: str, cls: type) -> None:
    _REGISTRY[type_key] = cls


def get_handler(type_key: str):
    from app.modules.onboarding import handlers as _h

    _h.register_all()
    cls = _REGISTRY.get(type_key) or _REGISTRY[OnboardingType.MANUAL.value]
    return cls()


def resolve_type_for_fulfillment(handler_key: str | None) -> str:
    return HANDLER_TO_ONBOARDING.get(handler_key or "", OnboardingType.MANUAL.value)
