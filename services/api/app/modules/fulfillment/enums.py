"""Fulfillment enums (P0). Convenção do projeto: status em minúsculas."""

import enum


class FulfillmentStatus(enum.StrEnum):
    PENDING = "pending"
    WAITING_INPUT = "waiting_input"
    READY = "ready"
    QUEUED = "queued"
    PROVISIONING = "provisioning"
    ACTIVE = "active"
    FAILED = "failed"
    MANUAL_REVIEW = "manual_review"
    SUSPENDED = "suspended"
    CANCELLED = "cancelled"


class FulfillmentStrategy(enum.StrEnum):
    AUTOMATIC = "automatic"
    GUIDED = "guided"
    PROJECT = "project"
    MANUAL = "manual"
    INTEGRATION = "integration"
    HYBRID = "hybrid"


class FulfillmentHandler(enum.StrEnum):
    MAIL = "mail"
    HESTIA = "hestia"
    PROJECT = "project"
    MANUAL = "manual"
