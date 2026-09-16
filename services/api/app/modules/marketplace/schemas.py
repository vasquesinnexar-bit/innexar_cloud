"""Marketplace schemas (P1.2): catálogo e compra pelo Portal."""

from pydantic import BaseModel, ConfigDict, field_validator


class CatalogPlan(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    interval: str
    amount: float
    currency: str
    billing_type: str
    unit: str | None = None


class CatalogProduct(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None
    category: str | None = None
    slug: str | None = None
    fulfillment_handler: str | None = None
    fulfillment_strategy: str | None = None
    plans: list[CatalogPlan] = []


class PurchaseCreate(BaseModel):
    product_id: int
    price_plan_id: int
    quantity: int = 1
    idempotency_key: str | None = None

    @field_validator("quantity")
    @classmethod
    def _qty(cls, v: int) -> int:
        if v < 1 or v > 100:
            raise ValueError("quantity deve estar entre 1 e 100")
        return v

    @field_validator("idempotency_key")
    @classmethod
    def _key(cls, v: str | None) -> str | None:
        if v is not None and (len(v) < 8 or len(v) > 128):
            raise ValueError("idempotency_key inválida")
        return v


class PurchaseResponse(BaseModel):
    contract_id: int
    contract_item_id: int
    invoice_id: int
    total: float
    currency: str
    status: str
    reused: bool = False


class MyPurchaseItem(BaseModel):
    id: int
    product_name: str | None = None
    description: str | None = None
    quantity: int
    unit_amount: float | None = None
    source: str | None = None
    invoice_id: int | None = None
    invoice_status: str | None = None
    invoice_total: float | None = None
    fulfillment_status: str | None = None
    fulfillment_step: str | None = None
    # Setup fee (one_time) é cobrança, não serviço técnico (agrupar na UI).
    is_setup: bool = False
    currency: str | None = None


class MyServicesResponse(BaseModel):
    items: list[MyPurchaseItem]
    email_domains: list[dict] = []
    hosting_services: list[dict] = []
    projects: list[dict] = []
