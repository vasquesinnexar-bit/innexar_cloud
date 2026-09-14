"""switch billing currency default to USD and migrate existing BRL rows

Revision ID: j7k8l9m0n1o2
Revises: i6j7k8l9m0n1
Create Date: 2026-04-02

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "j7k8l9m0n1o2"
down_revision: str | None = "i6j7k8l9m0n1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("UPDATE billing_price_plans SET currency = 'USD' WHERE UPPER(currency) = 'BRL'")
    op.execute("UPDATE billing_invoices SET currency = 'USD' WHERE UPPER(currency) = 'BRL'")

    op.alter_column(
        "billing_price_plans",
        "currency",
        existing_type=sa.String(length=8),
        server_default="USD",
        existing_nullable=True,
    )
    op.alter_column(
        "billing_invoices",
        "currency",
        existing_type=sa.String(length=8),
        server_default="USD",
        existing_nullable=True,
    )


def downgrade() -> None:
    op.execute("UPDATE billing_price_plans SET currency = 'BRL' WHERE UPPER(currency) = 'USD'")
    op.execute("UPDATE billing_invoices SET currency = 'BRL' WHERE UPPER(currency) = 'USD'")

    op.alter_column(
        "billing_price_plans",
        "currency",
        existing_type=sa.String(length=8),
        server_default="BRL",
        existing_nullable=True,
    )
    op.alter_column(
        "billing_invoices",
        "currency",
        existing_type=sa.String(length=8),
        server_default="BRL",
        existing_nullable=True,
    )
