"""Mail models: Service (operational), EmailDomain, EmailMailbox, MailProvisioningJob.

Commercial side lives in Contract/ContractItem (Fase 1). Never store passwords here.
"""

from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.datetime_utils import utc_now
from app.modules.mail.enums import (
    EmailDomainStatus,
    MailboxStatus,
    MailJobStatus,
    MailServiceStatus,
)

if TYPE_CHECKING:
    from app.models.customer import Customer


class Service(Base):
    """Operational service being delivered (vs Product = sold, ContractItem = contracted)."""

    __tablename__ = "mail_services"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id"), nullable=False, index=True
    )
    contract_item_id: Mapped[int | None] = mapped_column(
        ForeignKey("billing_contract_items.id"), nullable=True, index=True
    )
    org_id: Mapped[str] = mapped_column(String(64), default="innexar", index=True)
    service_type: Mapped[str] = mapped_column(
        String(64), default="professional_email", index=True
    )
    status: Mapped[str] = mapped_column(
        String(32), default=MailServiceStatus.PENDING.value, index=True
    )
    provider: Mapped[str] = mapped_column(String(32), default="docker-mailserver")
    external_reference: Mapped[str | None] = mapped_column(String(255), nullable=True)
    activated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    suspended_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    meta: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )

    domains: Mapped[list["EmailDomain"]] = relationship(
        "EmailDomain", back_populates="service", cascade="all, delete-orphan"
    )
    mailboxes: Mapped[list["EmailMailbox"]] = relationship(
        "EmailMailbox", back_populates="service", cascade="all, delete-orphan"
    )


class EmailDomain(Base):
    """Customer-owned mail domain managed by Innexar (tenant-isolated)."""

    __tablename__ = "mail_domains"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id"), nullable=False, index=True
    )
    service_id: Mapped[int | None] = mapped_column(
        ForeignKey("mail_services.id"), nullable=True, index=True
    )
    org_id: Mapped[str] = mapped_column(String(64), default="innexar", index=True)
    domain: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(32), default="docker-mailserver")
    external_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(
        String(32), default=EmailDomainStatus.PENDING.value, index=True
    )
    verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )

    service: Mapped["Service | None"] = relationship(
        "Service", back_populates="domains"
    )
    mailboxes: Mapped[list["EmailMailbox"]] = relationship(
        "EmailMailbox", back_populates="email_domain", cascade="all, delete-orphan"
    )


class EmailMailbox(Base):
    """Mirror of a real mailbox on the mailserver. No passwords stored."""

    __tablename__ = "mail_mailboxes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id"), nullable=False, index=True
    )
    service_id: Mapped[int | None] = mapped_column(
        ForeignKey("mail_services.id"), nullable=True, index=True
    )
    email_domain_id: Mapped[int] = mapped_column(
        ForeignKey("mail_domains.id"), nullable=False, index=True
    )
    org_id: Mapped[str] = mapped_column(String(64), default="innexar", index=True)
    address: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    local_part: Mapped[str] = mapped_column(String(128), nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    quota: Mapped[str | None] = mapped_column(
        String(32), nullable=True
    )  # e.g. "2G", NULL = unlimited
    provider: Mapped[str] = mapped_column(String(32), default="docker-mailserver")
    external_id: Mapped[str | None] = mapped_column(
        String(320), nullable=True, index=True
    )  # address on provider (idempotency)
    status: Mapped[str] = mapped_column(
        String(32), default=MailboxStatus.ACTIVE.value, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )

    service: Mapped["Service | None"] = relationship(
        "Service", back_populates="mailboxes"
    )
    email_domain: Mapped["EmailDomain"] = relationship(
        "EmailDomain", back_populates="mailboxes"
    )


class MailProvisioningJob(Base):
    """Async technical operation on the mailserver (never block HTTP on it)."""

    __tablename__ = "mail_provisioning_jobs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    mailbox_id: Mapped[int | None] = mapped_column(
        ForeignKey("mail_mailboxes.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    invoice_id: Mapped[int | None] = mapped_column(
        ForeignKey("billing_invoices.id"), nullable=True, index=True
    )
    org_id: Mapped[str] = mapped_column(String(64), default="innexar", index=True)
    job_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    status: Mapped[str] = mapped_column(
        String(32), default=MailJobStatus.PENDING.value, index=True
    )
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    idempotency_key: Mapped[str | None] = mapped_column(
        String(128), nullable=True, unique=True, index=True
    )
    payload: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
