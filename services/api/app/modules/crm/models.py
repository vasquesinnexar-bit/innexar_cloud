"""CRM models: Contact, ContactActivity."""

from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.core.database import Base
from app.core.datetime_utils import utc_now

if TYPE_CHECKING:
    from app.models.customer import Customer


class Contact(Base):
    """Contact (CRM / Lead)."""

    __tablename__ = "crm_contacts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    org_id: Mapped[str] = mapped_column(String(64), default="innexar", index=True)
    customer_id: Mapped[int | None] = mapped_column(
        ForeignKey("customers.id"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), index=True, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    source: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="new", index=True)
    extra_data: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    assigned_rep_id: Mapped[int | None] = mapped_column(
        ForeignKey("representatives.id"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )

    customer: Mapped["Customer | None"] = relationship(
        "Customer", back_populates="contacts"
    )


class ContactActivity(Base):
    """Activity/note log entry for a Contact (CRM pipeline), logged by a rep."""

    __tablename__ = "crm_contact_activities"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    org_id: Mapped[str] = mapped_column(String(64), default="innexar", index=True)
    contact_id: Mapped[int] = mapped_column(
        ForeignKey("crm_contacts.id"), nullable=False, index=True
    )
    rep_id: Mapped[int | None] = mapped_column(
        ForeignKey("representatives.id"), nullable=True, index=True
    )
    activity_type: Mapped[str] = mapped_column(String(32), default="note")
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
