"""Hosting models: server, service link, backups, file revisions, jobs."""

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, BigInteger, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.datetime_utils import utc_now
from app.modules.hosting.enums import (
    BackupStatus,
    HostingJobStatus,
    HostingServiceStatus,
)


class HostingServer(Base):
    """Docker host real (este servidor, auto-registrado). Sem segredos aqui."""

    __tablename__ = "hosting_servers"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    hostname: Mapped[str] = mapped_column(String(255), nullable=False)
    provider: Mapped[str] = mapped_column(String(64), default="docker")
    region: Mapped[str] = mapped_column(String(64), default="unknown")
    environment: Mapped[str] = mapped_column(String(32), default="production")
    status: Mapped[str] = mapped_column(String(32), default="unknown", index=True)
    capabilities: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    meta: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )

    services: Mapped[list["HostingService"]] = relationship(
        "HostingService", back_populates="server"
    )


class HostingService(Base):
    """Operational link: customer service -> real infrastructure (admin-linked)."""

    __tablename__ = "hosting_services"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id"), nullable=False, index=True
    )
    contract_item_id: Mapped[int | None] = mapped_column(
        ForeignKey("billing_contract_items.id"), nullable=True, index=True
    )
    server_id: Mapped[int | None] = mapped_column(
        ForeignKey("hosting_servers.id"), nullable=True, index=True
    )
    org_id: Mapped[str] = mapped_column(String(64), default="innexar", index=True)
    runtime_type: Mapped[str] = mapped_column(String(32), default="docker")
    container_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    container_name: Mapped[str | None] = mapped_column(
        String(128), nullable=True, index=True
    )
    project_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    root_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    path_mode: Mapped[str] = mapped_column(
        String(16), default="container"
    )  # container|host
    primary_domain: Mapped[str | None] = mapped_column(
        String(255), nullable=True, index=True
    )
    environment: Mapped[str] = mapped_column(String(32), default="production")
    internal_port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cpu_limit: Mapped[str | None] = mapped_column(String(32), nullable=True)
    memory_limit: Mapped[str | None] = mapped_column(String(32), nullable=True)
    disk_limit: Mapped[str | None] = mapped_column(String(32), nullable=True)
    status: Mapped[str] = mapped_column(
        String(32), default=HostingServiceStatus.PENDING.value, index=True
    )
    activated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    suspended_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_deploy_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_backup_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    meta: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )

    server: Mapped["HostingServer | None"] = relationship(
        "HostingServer", back_populates="services"
    )
    backups: Mapped[list["HostingBackup"]] = relationship(
        "HostingBackup", back_populates="hosting_service",
        cascade="all, delete-orphan",
    )


class HostingBackup(Base):
    """Backup de aplicação (async job). Conteúdo em storage_reference, nunca no banco."""

    __tablename__ = "hosting_backups"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    hosting_service_id: Mapped[int] = mapped_column(
        ForeignKey("hosting_services.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    provider: Mapped[str] = mapped_column(String(32), default="docker")
    backup_type: Mapped[str] = mapped_column(String(32), default="files")
    status: Mapped[str] = mapped_column(
        String(32), default=BackupStatus.PENDING.value, index=True
    )
    size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    checksum: Mapped[str | None] = mapped_column(String(128), nullable=True)
    storage_reference: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_by: Mapped[str | None] = mapped_column(String(128), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )

    hosting_service: Mapped["HostingService"] = relationship(
        "HostingService", back_populates="backups"
    )


class FileRevision(Base):
    """Snapshot antes de cada edição via Portal (restore + diff)."""

    __tablename__ = "file_revisions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    hosting_service_id: Mapped[int] = mapped_column(
        ForeignKey("hosting_services.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    path: Mapped[str] = mapped_column(String(512), nullable=False)
    checksum_before: Mapped[str | None] = mapped_column(String(128), nullable=True)
    checksum_after: Mapped[str | None] = mapped_column(String(128), nullable=True)
    content_before: Mapped[str | None] = mapped_column(Text, nullable=True)
    storage_reference: Mapped[str | None] = mapped_column(String(512), nullable=True)
    actor_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )


class HostingJob(Base):
    """Async ops com lock por serviço (sem restart storm / backup duplicado)."""

    __tablename__ = "hosting_jobs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    hosting_service_id: Mapped[int] = mapped_column(
        ForeignKey("hosting_services.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    invoice_id: Mapped[int | None] = mapped_column(
        ForeignKey("billing_invoices.id"), nullable=True, index=True
    )
    org_id: Mapped[str] = mapped_column(String(64), default="innexar", index=True)
    job_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    status: Mapped[str] = mapped_column(
        String(32), default=HostingJobStatus.PENDING.value, index=True
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
