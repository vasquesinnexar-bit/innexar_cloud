"""P1.4A matrix: website_sellable + admin_assignable (aditiva, reversível).

Backfill preserva visibilidade atual: website=True para produtos vendidos
nos sites (listas por nome + catálogo BR ativo); admin=True para ativos.
portal_sellable NÃO é tocado (decisão comercial explícita).
"""

revision = "x1y2z3a4b5c6"
down_revision = "w0x1y2z3a4b5"


from alembic import op

WEBSITE_NAMES = (
    "Starter Website",
    "Business Website",
    "Pro Website",
    "Paid Traffic Start",
    "Paid Traffic Growth",
    "Paid Traffic Premium",
    "Site Essencial",
    "Site Completo",
)


def upgrade() -> None:
    op.execute(
        "ALTER TABLE billing_products "
        "ADD COLUMN IF NOT EXISTS website_sellable BOOLEAN NOT NULL DEFAULT FALSE"
    )
    op.execute(
        "ALTER TABLE billing_products "
        "ADD COLUMN IF NOT EXISTS admin_assignable BOOLEAN NOT NULL DEFAULT TRUE"
    )
    names = ", ".join(f"'{n}'" for n in WEBSITE_NAMES)
    op.execute(
        "UPDATE billing_products SET website_sellable=TRUE "
        f"WHERE name IN ({names}) AND website_sellable IS NOT TRUE"
    )
    op.execute(
        "UPDATE billing_products SET website_sellable=TRUE "
        "WHERE org_id='innexar-br' AND is_active IS TRUE "
        "AND website_sellable IS NOT TRUE"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE billing_products DROP COLUMN IF EXISTS admin_assignable")
    op.execute("ALTER TABLE billing_products DROP COLUMN IF EXISTS website_sellable")
