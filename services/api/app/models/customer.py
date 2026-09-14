"""Customer (portal client) model."""

from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.datetime_utils import utc_now

if TYPE_CHECKING:
    from app.models.customer_user import CustomerUser
    from app.modules.billing.models import Contract
    from app.modules.crm.models import Contact
    from app.modules.projects.models import Project
    from app.modules.support.models import Ticket


class Customer(Base):
    """Customer (portal client)."""

    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    org_id: Mapped[str] = mapped_column(String(64), default="innexar", index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    phone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    address: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    # Fase 1 — contexto regional/fiscal (todos opcionais; fallbacks por org/moeda).
    company: Mapped[str | None] = mapped_column(String(255), nullable=True)
    country: Mapped[str | None] = mapped_column(
        String(2), nullable=True, index=True
    )  # ISO-3166 alpha-2: BR, US…
    locale: Mapped[str | None] = mapped_column(
        String(8), nullable=True
    )  # pt-BR, en-US…
    currency: Mapped[str | None] = mapped_column(
        String(3), nullable=True, index=True
    )  # BRL, USD… (NULL = default da org)
    billing_provider: Mapped[str | None] = mapped_column(
        String(32), nullable=True, index=True
    )  # stripe|mercadopago (NULL = fallback pela currency)
    tax_id: Mapped[str | None] = mapped_column(
        String(32), nullable=True
    )  # CPF/CNPJ, EIN…
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    mp_customer_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, index=True
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )

    users: Mapped[list["CustomerUser"]] = relationship(
        "CustomerUser", back_populates="customer", cascade="all, delete-orphan"
    )
    contacts: Mapped[list["Contact"]] = relationship(
        "Contact", back_populates="customer", foreign_keys="Contact.customer_id"
    )
    projects: Mapped[list["Project"]] = relationship(
        "Project", back_populates="customer"
    )
    tickets: Mapped[list["Ticket"]] = relationship("Ticket", back_populates="customer")
    contracts: Mapped[list["Contract"]] = relationship(
        "Contract", back_populates="customer", cascade="all, delete-orphan"
    )
