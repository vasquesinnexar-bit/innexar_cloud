"""Mail enums: service/domain/mailbox/job states (Fase 2)."""

import enum


class MailServiceStatus(enum.StrEnum):
    PENDING = "pending"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    CANCELLED = "cancelled"


class EmailDomainStatus(enum.StrEnum):
    PENDING = "pending"
    ACTIVE = "active"
    FAILED = "failed"


class MailboxStatus(enum.StrEnum):
    ACTIVE = "active"
    DISABLED = "disabled"
    PENDING_PAYMENT = "pending_payment"


class MailJobType(enum.StrEnum):
    CREATE_MAILBOX = "create_mailbox"
    UPDATE_MAILBOX = "update_mailbox"
    DISABLE_MAILBOX = "disable_mailbox"
    ENABLE_MAILBOX = "enable_mailbox"
    DELETE_MAILBOX = "delete_mailbox"


class MailJobStatus(enum.StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
