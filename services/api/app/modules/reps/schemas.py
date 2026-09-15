"""Reps schemas."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel

REP_STATUSES = ("active", "inactive")


class RepresentativeCreate(BaseModel):
    """Create representative. user_id must reference an existing staff User."""

    user_id: int
    name: str
    region: str | None = None
    commission_pct: Decimal = Decimal("0")
    status: str = "active"


class RepresentativeUpdate(BaseModel):
    """Update representative (partial)."""

    name: str | None = None
    region: str | None = None
    commission_pct: Decimal | None = None
    status: str | None = None


class RepresentativeResponse(BaseModel):
    """Representative response."""

    id: int
    org_id: str
    user_id: int
    name: str
    region: str | None
    commission_pct: Decimal
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
