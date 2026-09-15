"""Pydantic schemas for workspace contracts (Fase 1)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

from app.modules.billing.enums import ContractStatus, PaymentProvider


class ContractItemCreate(BaseModel):
    """One sold line inside a contract."""

    product_id: int | None = None
    price_plan_id: int | None = None
    subscription_id: int | None = None
    description: str | None = None
    quantity: int = 1
    unit_amount: float | None = None


class ContractItemUpdate(BaseModel):
    """Partial update of a contract item (all optional)."""

    product_id: int | None = None
    price_plan_id: int | None = None
    subscription_id: int | None = None
    description: str | None = None
    quantity: int | None = None
    unit_amount: float | None = None


class ContractInvoiceCreate(BaseModel):
    """Generate an invoice from contract items."""

    due_date: datetime | None = None
    subscription_id: int | None = None


class ContractCreate(BaseModel):
    """Body for creating a contract."""

    customer_id: int
    currency: str | None = None
    billing_provider: str | None = None
    notes: str | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    billing_interval: str | None = None
    billing_day: int | None = None
    due_days: int | None = None
    timezone: str | None = None
    credit_balance: float | None = None
    items: list[ContractItemCreate] = []

    @field_validator("currency")
    @classmethod
    def _currency(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip().upper()
        if not v:
            return None
        if len(v) != 3 or not v.isalpha():
            raise ValueError("currency deve ser ISO-4217 (ex: BRL, USD)")
        return v

    @field_validator("billing_provider")
    @classmethod
    def _provider(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip().lower()
        if not v:
            return None
        if v not in (PaymentProvider.STRIPE.value, PaymentProvider.MERCADOPAGO.value):
            raise ValueError("billing_provider deve ser stripe ou mercadopago")
        return v


class ContractUpdate(BaseModel):
    """Body for updating a contract (partial). Cliente nunca altera billing via portal."""

    status: str | None = None
    currency: str | None = None
    billing_provider: str | None = None
    notes: str | None = None
    ends_at: datetime | None = None
    billing_interval: str | None = None
    billing_day: int | None = None
    due_days: int | None = None
    timezone: str | None = None
    credit_balance: float | None = None

    _currency = ContractCreate._currency
    _provider = ContractCreate._provider

    @field_validator("status")
    @classmethod
    def _status(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip().lower()
        valid = {s.value for s in ContractStatus}
        if v not in valid:
            raise ValueError(f"status deve ser um de {sorted(valid)}")
        return v


class ContractItemResponse(BaseModel):
    """Contract item in responses."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int | None
    price_plan_id: int | None
    subscription_id: int | None
    description: str | None
    quantity: int
    unit_amount: float | None


class ContractResponse(BaseModel):
    """Contract in list/detail."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_id: int
    org_id: str
    status: str
    currency: str | None
    billing_provider: str | None
    notes: str | None
    starts_at: datetime | None
    ends_at: datetime | None
    billing_interval: str | None = None
    billing_day: int | None = None
    due_days: int | None = None
    timezone: str | None = None
    credit_balance: float = 0
    created_at: datetime
    items: list[ContractItemResponse] = []
