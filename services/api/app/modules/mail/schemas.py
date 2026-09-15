"""Pydantic schemas for the mail module (Fase 2)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DomainRegister(BaseModel):
    domain: str
    contract_item_id: int | None = None


class EmailDomainResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    domain: str
    status: str
    verified_at: datetime | None


class DNSCheckItem(BaseModel):
    ok: bool
    found: list[str] = []
    expected: str = ""
    hint: str = ""


class DomainDNSResponse(BaseModel):
    domain: str
    all_ok: bool
    checks: dict[str, DNSCheckItem]
    expected_records: list[dict]


class MailboxCreate(BaseModel):
    domain: str
    local_part: str
    display_name: str | None = None
    password: str
    quota: str | None = None


class MailboxPasswordChange(BaseModel):
    password: str


class MailboxQuotaChange(BaseModel):
    quota: str | None = None


class MailboxResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    address: str
    display_name: str | None
    quota: str | None
    status: str
    created_at: datetime
    usage_used: str | None = None
    usage_pct: str | None = None
    last_activity: str | None = None  # indisponível no mailserver atual


class EntitlementResponse(BaseModel):
    contracted: int
    used: int
    available: int
    currency: str
    unit_price: float | None
    provider_fallback: str


class ServiceSummaryResponse(BaseModel):
    domain: str | None
    status: str
    entitlement: EntitlementResponse
    mailboxes: list[MailboxResponse]


class UpgradeRequestResponse(BaseModel):
    """Resposta ao solicitar conta adicional (ainda sem cobrança automática)."""

    contracted: int
    used: int
    currency: str
    unit_price: float | None
    message: str


class SyncResponse(BaseModel):
    created: int
    updated: int
    remote_total: int
