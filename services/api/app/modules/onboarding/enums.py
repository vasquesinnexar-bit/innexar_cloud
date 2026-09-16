"""Onboarding enums (P1.3). Minúsculas, convenção do projeto."""

import enum


class OnboardingStatus(enum.StrEnum):
    PENDING = "pending"
    ACTIVE = "active"
    WAITING_CUSTOMER = "waiting_customer"
    WAITING_DNS = "waiting_dns"
    FAILED = "failed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class OnboardingStepStatus(enum.StrEnum):
    PENDING = "pending"
    ACTIVE = "active"
    COMPLETED = "completed"
    BLOCKED = "blocked"
    SKIPPED = "skipped"
    FAILED = "failed"


class OnboardingType(enum.StrEnum):
    PROFESSIONAL_EMAIL = "professional_email"
    WEBSITE_PROJECT = "website_project"
    HOSTING = "hosting"
    MANUAL = "manual"
