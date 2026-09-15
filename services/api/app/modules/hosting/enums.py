"""Hosting enums (Fase 4)."""

import enum


class HostingServiceStatus(enum.StrEnum):
    PENDING = "pending"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    CANCELLED = "cancelled"


class RuntimeStatus(enum.StrEnum):
    ONLINE = "online"
    OFFLINE = "offline"
    STARTING = "starting"
    STOPPING = "stopping"
    RESTARTING = "restarting"
    DEGRADED = "degraded"
    UNKNOWN = "unknown"
    SUSPENDED = "suspended"


class HostingJobType(enum.StrEnum):
    RESTART = "hosting_restart"
    START = "hosting_start"
    STOP = "hosting_stop"
    BACKUP = "hosting_backup"
    RESTORE = "hosting_restore"
    SUSPEND = "hosting_suspend"
    REACTIVATE = "hosting_reactivate"
    LINK = "hosting_link"


class HostingJobStatus(enum.StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class BackupStatus(enum.StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    EXPIRED = "expired"


class StackType(enum.StrEnum):
    """Classificação da stack: serviço de cliente vs infra da plataforma."""

    CUSTOMER_SERVICE = "customer_service"
    PLATFORM_INFRA = "platform_infra"


class ComponentRole(enum.StrEnum):
    """Papel técnico de um componente dentro da stack."""

    WEB = "web"
    API = "api"
    DATABASE = "database"
    STORAGE = "storage"
    CACHE = "cache"
    WORKER = "worker"
    QUEUE = "queue"
    PROXY = "proxy"
    OTHER = "other"
