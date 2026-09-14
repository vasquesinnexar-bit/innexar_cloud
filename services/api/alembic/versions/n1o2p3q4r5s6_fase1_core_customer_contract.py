"""Fase 1 Core: country/locale/currency/billing_provider no Customer,
catalogo (category/slug, billing_type/unit/provider), currency na Subscription,
e tabelas billing_contracts / billing_contract_items.

Idempotent DDL (IF NOT EXISTS). Backfill por org sem sobrescrever valores
existentes: innexar-br -> BR/pt-BR/BRL, demais -> US/en-US/USD.
"""

from alembic import op

revision = "n1o2p3q4r5s6"
down_revision = "m0n1o2p3q4r5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- customers: contexto regional/fiscal ---
    op.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS company VARCHAR(255)")
    op.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS country VARCHAR(2)")
    op.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS locale VARCHAR(8)")
    op.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS currency VARCHAR(3)")
    op.execute(
        "ALTER TABLE customers ADD COLUMN IF NOT EXISTS billing_provider VARCHAR(32)"
    )
    op.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS tax_id VARCHAR(32)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_customers_country ON customers (country)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_customers_currency ON customers (currency)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_customers_billing_provider "
        "ON customers (billing_provider)"
    )

    # --- backfill por org (só NULL) ---
    op.execute(
        "UPDATE customers SET country='BR', locale='pt-BR', currency='BRL' "
        "WHERE org_id='innexar-br' AND (country IS NULL OR locale IS NULL OR currency IS NULL)"
    )
    op.execute(
        "UPDATE customers SET "
        "country=COALESCE(country,'US'), locale=COALESCE(locale,'en-US'), "
        "currency=COALESCE(currency,'USD') "
        "WHERE org_id<>'innexar-br' AND (country IS NULL OR locale IS NULL OR currency IS NULL)"
    )

    # --- billing_products: categoria/slug do catalogo ---
    op.execute(
        "ALTER TABLE billing_products ADD COLUMN IF NOT EXISTS category VARCHAR(64)"
    )
    op.execute(
        "ALTER TABLE billing_products ADD COLUMN IF NOT EXISTS slug VARCHAR(128)"
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_products_slug "
        "ON billing_products (slug)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_billing_products_category "
        "ON billing_products (category)"
    )

    # --- billing_price_plans: preco como entidade completa ---
    op.execute(
        "ALTER TABLE billing_price_plans ADD COLUMN IF NOT EXISTS billing_type "
        "VARCHAR(16) NOT NULL DEFAULT 'recurring'"
    )
    op.execute(
        "ALTER TABLE billing_price_plans ADD COLUMN IF NOT EXISTS unit VARCHAR(32)"
    )
    op.execute(
        "ALTER TABLE billing_price_plans ADD COLUMN IF NOT EXISTS provider VARCHAR(32)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_billing_price_plans_provider "
        "ON billing_price_plans (provider)"
    )

    # --- billing_subscriptions: moeda propria (NULL = PricePlan/Invoice) ---
    op.execute(
        "ALTER TABLE billing_subscriptions ADD COLUMN IF NOT EXISTS currency VARCHAR(8)"
    )

    # --- billing_contracts ---
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS billing_contracts (
            id SERIAL PRIMARY KEY,
            customer_id INTEGER NOT NULL REFERENCES customers(id),
            org_id VARCHAR(64) NOT NULL DEFAULT 'innexar',
            status VARCHAR(32) NOT NULL DEFAULT 'pending',
            currency VARCHAR(8),
            billing_provider VARCHAR(32),
            notes TEXT,
            starts_at TIMESTAMP WITH TIME ZONE,
            ends_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_billing_contracts_customer "
        "ON billing_contracts (customer_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_billing_contracts_org "
        "ON billing_contracts (org_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_billing_contracts_status "
        "ON billing_contracts (status)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_billing_contracts_billing_provider "
        "ON billing_contracts (billing_provider)"
    )

    # --- billing_contract_items ---
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS billing_contract_items (
            id SERIAL PRIMARY KEY,
            contract_id INTEGER NOT NULL REFERENCES billing_contracts(id) ON DELETE CASCADE,
            product_id INTEGER REFERENCES billing_products(id),
            price_plan_id INTEGER REFERENCES billing_price_plans(id),
            subscription_id INTEGER REFERENCES billing_subscriptions(id),
            description VARCHAR(512),
            quantity INTEGER NOT NULL DEFAULT 1,
            unit_amount NUMERIC(12, 2),
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_billing_contract_items_contract "
        "ON billing_contract_items (contract_id)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS billing_contract_items")
    op.execute("DROP TABLE IF EXISTS billing_contracts")
    op.execute(
        "ALTER TABLE billing_subscriptions DROP COLUMN IF EXISTS currency"
    )
    op.execute(
        "ALTER TABLE billing_price_plans DROP COLUMN IF EXISTS provider"
    )
    op.execute("ALTER TABLE billing_price_plans DROP COLUMN IF EXISTS unit")
    op.execute(
        "ALTER TABLE billing_price_plans DROP COLUMN IF EXISTS billing_type"
    )
    op.execute("DROP INDEX IF EXISTS uq_billing_products_slug")
    op.execute("ALTER TABLE billing_products DROP COLUMN IF EXISTS slug")
    op.execute("ALTER TABLE billing_products DROP COLUMN IF EXISTS category")
    for col in (
        "tax_id",
        "billing_provider",
        "currency",
        "locale",
        "country",
        "company",
    ):
        op.execute(f"ALTER TABLE customers DROP COLUMN IF EXISTS {col}")
