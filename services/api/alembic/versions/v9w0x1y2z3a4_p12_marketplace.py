"""P1.2 marketplace: portal_sellable, source tracking, invoice idempotency.

Aditiva e reversível. Sem backfill (portal_sellable default False = decisão
comercial explícita por produto; source NULL em histórico = desconhecido).
"""

revision = "v9w0x1y2z3a4"
down_revision = "u8v9w0x1y2z3"


from alembic import op


def upgrade() -> None:
    op.execute(
        "ALTER TABLE billing_products "
        "ADD COLUMN IF NOT EXISTS portal_sellable BOOLEAN NOT NULL DEFAULT FALSE"
    )
    op.execute(
        "ALTER TABLE billing_contracts "
        "ADD COLUMN IF NOT EXISTS source VARCHAR(32)"
    )
    op.execute(
        "ALTER TABLE billing_contract_items "
        "ADD COLUMN IF NOT EXISTS source VARCHAR(32)"
    )
    op.execute(
        "ALTER TABLE billing_invoices "
        "ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128)"
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_idempotency "
        "ON billing_invoices (idempotency_key) WHERE idempotency_key IS NOT NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_invoices_idempotency")
    op.execute("ALTER TABLE billing_invoices DROP COLUMN IF EXISTS idempotency_key")
    op.execute("ALTER TABLE billing_contract_items DROP COLUMN IF EXISTS source")
    op.execute("ALTER TABLE billing_contracts DROP COLUMN IF EXISTS source")
    op.execute("ALTER TABLE billing_products DROP COLUMN IF EXISTS portal_sellable")
