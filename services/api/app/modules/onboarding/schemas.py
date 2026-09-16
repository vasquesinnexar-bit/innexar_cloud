"""Schemas do onboarding (P1.3)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class OnboardingStepResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    step_key: str
    position: int
    required: bool
    status: str
    data: dict | None = None
    validation_error: str | None = None
    completed_at: datetime | None = None


class OnboardingSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_id: int
    customer_name: str | None = None
    fulfillment_id: int | None = None
    product_name: str | None = None
    type: str
    status: str
    current_step: str | None = None
    progress: int = 0
    last_error: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    last_activity_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    steps: list[OnboardingStepResponse] = []


class StepSubmit(BaseModel):
    data: dict = {}


class DnsConnect(BaseModel):
    api_token: str
    account_id: str | None = None


class DnsApply(BaseModel):
    zone_id: str
    confirmed_conflicts: bool = False


class MailboxSubmit(BaseModel):
    local_part: str
    password: str
    display_name: str | None = None
    quota: str | None = None


class NoteBody(BaseModel):
    note: str | None = None
