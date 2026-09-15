"""CRM schemas."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel

LEAD_STATUSES = (
    "new",
    "contacted",
    "qualified",
    "converted",
    "lost",
    # Commercial pipeline stages (added for the Representantes Comerciais module).
    "proposal",
    "negotiation",
    "closed_won",
    "closed_lost",
)


class ContactCreate(BaseModel):
    """Create contact."""

    name: str
    email: str | None = None
    phone: str | None = None
    customer_id: int | None = None
    source: str | None = None
    message: str | None = None
    status: str = "new"
    extra_data: dict[str, Any] | None = None
    assigned_rep_id: int | None = None


class ContactUpdate(BaseModel):
    """Update contact (partial)."""

    name: str | None = None
    email: str | None = None
    phone: str | None = None
    customer_id: int | None = None
    source: str | None = None
    message: str | None = None
    status: str | None = None
    extra_data: dict[str, Any] | None = None
    assigned_rep_id: int | None = None


class ContactResponse(BaseModel):
    """Contact response."""

    id: int
    org_id: str
    customer_id: int | None
    name: str
    email: str | None
    phone: str | None
    source: str | None
    message: str | None
    status: str
    extra_data: dict[str, Any] | None
    assigned_rep_id: int | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ContactActivityCreate(BaseModel):
    """Create a contact activity/note entry."""

    activity_type: str = "note"
    note: str | None = None


class ContactActivityResponse(BaseModel):
    """Contact activity response."""

    id: int
    org_id: str
    contact_id: int
    rep_id: int | None
    activity_type: str
    note: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
