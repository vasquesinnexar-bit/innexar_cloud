"""Fulfillment model: processo entre ContractItem e entrega (P0)."""

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.datetime_utils import utc_now
from app.modules.fulfillment.enums import FulfillmentStatus


class Fulfillment(Base):
    """Um ContractItem entregável = um Fulfillment (idempotente por item)."""

    __tablename__ = "fulfillment_fulfillments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    org_id: Mapped[str] = mapped_column(String(64), default="innexar", index=True)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id"), nullable=False, index=True
    )
    contract_id: Mapped[int] = mapped_column(
        ForeignKey("billing_contracts.id"), nullable=False, index=True
    )
    contract_item_id: Mapped[int] = mapped_column(
        ForeignKey("billing_contract_items.id"), nullable=False, index=True
    )
    product_id: Mapped[int | None] = mapped_column(
        ForeignKey("billing_products.id"), nullable=True, index=True
    )
    invoice_id: Mapped[int | None] = mapped_column(
        ForeignKey("billing_invoices.id"), nullable=True, index=True
    )
    subscription_id: Mapped[int | None] = mapped_column(
        ForeignKey("billing_subscriptions.id"), nullable=True, index=True
    )
    service_id: Mapped[int | None] = mapped_column(
        ForeignKey("mail_services.id"), nullable=True, index=True
    )
    project_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    strategy: Mapped[str] = mapped_column(String(32), default="manual")
    handler_key: Mapped[str] = mapped_column(String(32), default="manual", index=True)
    status: Mapped[str] = mapped_column(
        String(32), default=FulfillmentStatus.PENDING.value, index=True
    )
    current_step: Mapped[str | None] = mapped_column(String(128), nullable=True)
    progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    retryable: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    next_retry_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    idempotency_key: Mapped[str] = mapped_column(
        String(128), nullable=False, unique=True, index=True
    )
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    meta: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )
