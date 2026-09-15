"""Schemas do fulfillment (P0)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class FulfillmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    org_id: str
    customer_id: int
    customer_name: str | None = None
    contract_id: int
    contract_item_id: int
    product_id: int | None = None
    product_name: str | None = None
    invoice_id: int | None = None
    subscription_id: int | None = None
    service_id: int | None = None
    project_id: int | None = None
    strategy: str
    handler_key: str
    status: str
    current_step: str | None = None
    progress: int = 0
    last_error: str | None = None
    retryable: bool = False
    retry_count: int = 0
    next_retry_at: datetime | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class FulfillmentAction(BaseModel):
    note: str | None = None
