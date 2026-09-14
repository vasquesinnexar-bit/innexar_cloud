"""Pydantic schemas do hosting (Fase 4)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ServerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    hostname: str
    provider: str
    region: str
    environment: str
    status: str


class HostingServiceCreate(BaseModel):
    customer_id: int
    container_name: str
    root_path: str = "/app"
    path_mode: str = "container"
    primary_domain: str | None = None
    environment: str = "production"
    contract_item_id: int | None = None


class HostingServiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_id: int
    container_name: str | None
    project_name: str | None
    root_path: str | None
    path_mode: str
    primary_domain: str | None
    environment: str
    status: str
    last_deploy_at: datetime | None
    last_backup_at: datetime | None


class FileEntry(BaseModel):
    name: str
    type: str
    size: int | None = None
    mtime: str | int | None = None
    perms: str = ""


class FileWriteBody(BaseModel):
    content: str


class FileRenameBody(BaseModel):
    new_path: str


class MkdirBody(BaseModel):
    path: str


class BackupCreateBody(BaseModel):
    retention: int = 5


class BackupResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    backup_type: str
    status: str
    size_bytes: int | None
    created_at: datetime
    completed_at: datetime | None
    expires_at: datetime | None


class JobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    job_type: str
    status: str
    attempts: int
    last_error: str | None
    created_at: datetime
    completed_at: datetime | None


class RevisionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    path: str
    checksum_before: str | None
    checksum_after: str | None
    actor_id: str | None
    created_at: datetime


class DiffResponse(BaseModel):
    path: str
    before: str | None
    after: str | None
    diff: list[str]
