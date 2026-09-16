"""Onboarding models: sessão genérica + steps persistentes (P1.3)."""

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.datetime_utils import utc_now
from app.modules.onboarding.enums import OnboardingStatus, OnboardingStepStatus


class OnboardingSession(Base):
    """Uma sessão por (fulfillment) — idempotente por chave. Sem secrets em meta."""

    __tablename__ = "onboarding_sessions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    org_id: Mapped[str] = mapped_column(String(64), default="innexar", index=True)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id"), nullable=False, index=True
    )
    contract_item_id: Mapped[int | None] = mapped_column(
        ForeignKey("billing_contract_items.id"), nullable=True, index=True
    )
    fulfillment_id: Mapped[int | None] = mapped_column(
        ForeignKey("fulfillment_fulfillments.id"), nullable=True, index=True
    )
    product_id: Mapped[int | None] = mapped_column(
        ForeignKey("billing_products.id"), nullable=True, index=True
    )
    type: Mapped[str] = mapped_column(String(64), default="manual", index=True)
    status: Mapped[str] = mapped_column(
        String(32), default=OnboardingStatus.PENDING.value, index=True
    )
    current_step: Mapped[str | None] = mapped_column(String(128), nullable=True)
    progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    idempotency_key: Mapped[str] = mapped_column(
        String(128), nullable=False, unique=True, index=True
    )
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_activity_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    meta: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )

    steps: Mapped[list["OnboardingStep"]] = relationship(
        "OnboardingStep",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="OnboardingStep.position",
    )


class OnboardingStep(Base):
    """Etapa persistente de uma sessão (stateless fora daqui: sem state no React)."""

    __tablename__ = "onboarding_steps"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    onboarding_id: Mapped[int] = mapped_column(
        ForeignKey("onboarding_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    step_key: Mapped[str] = mapped_column(String(128), nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    required: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    status: Mapped[str] = mapped_column(
        String(32), default=OnboardingStepStatus.PENDING.value, index=True
    )
    data: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    validation_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )

    session: Mapped["OnboardingSession"] = relationship(
        "OnboardingSession", back_populates="steps"
    )
