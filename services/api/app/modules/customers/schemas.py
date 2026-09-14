"""Pydantic schemas for workspace customers."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator

from app.modules.billing.enums import PaymentProvider

VALID_LOCALES = ("pt-BR", "en-US", "es")


class CustomerCreate(BaseModel):
    """Body for creating a customer."""

    name: str
    email: EmailStr
    phone: str | None = None
    address: dict[str, Any] | None = None
    company: str | None = None
    country: str | None = None
    locale: str | None = None
    currency: str | None = None
    billing_provider: str | None = None
    tax_id: str | None = None

    @field_validator("country")
    @classmethod
    def _country(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip().upper()
        if not v:
            return None
        if len(v) != 2 or not v.isalpha():
            raise ValueError("country deve ser ISO alpha-2 (ex: BR, US)")
        return v

    @field_validator("locale")
    @classmethod
    def _locale(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not v:
            return None
        if v not in VALID_LOCALES:
            raise ValueError(f"locale deve ser um de {VALID_LOCALES}")
        return v

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


class CustomerUpdate(BaseModel):
    """Body for updating a customer (partial)."""

    name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    address: dict[str, Any] | None = None
    company: str | None = None
    country: str | None = None
    locale: str | None = None
    currency: str | None = None
    billing_provider: str | None = None
    tax_id: str | None = None

    _country = CustomerCreate._country
    _locale = CustomerCreate._locale
    _currency = CustomerCreate._currency
    _provider = CustomerCreate._provider


class CustomerResponse(BaseModel):
    """Customer in list/detail."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    org_id: str
    name: str
    email: str
    phone: str | None
    address: dict[str, Any] | None
    company: str | None = None
    country: str | None = None
    locale: str | None = None
    currency: str | None = None
    billing_provider: str | None = None
    tax_id: str | None = None
    created_at: datetime
    has_portal_access: bool = False


class SendCredentialsResponse(BaseModel):
    """Response after sending credentials."""

    ok: bool = True
    message: str = "Credentials sent by email"


class GeneratePasswordResponse(BaseModel):
    """Response with generated temporary password (admin only)."""

    password: str
    message: str = "Senha gerada. Use 'Enviar convite' para enviar por e-mail."


class CleanupTestResponse(BaseModel):
    """Response after cleanup-test-customers."""

    deleted: int
    message: str
