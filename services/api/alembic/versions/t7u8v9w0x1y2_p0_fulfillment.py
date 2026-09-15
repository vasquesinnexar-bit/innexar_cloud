"""P0: fulfillment central + product.fulfillment_* + provisioning perms.

Aditiva e reversível: CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS,
INSERT de permissões com NOT EXISTS, backfill de handler por provisioning_type.
Nenhum DROP/UPDATE destrutivo.
"""

revision = "t7u8v9w0x1y2"
down_revision = "s6t7u8v9w0x1"


from alembic import op


def upgrade() -> None:
    op.execute(
        "ALTER TABLE billing_products "
        "ADD COLUMN IF NOT EXISTS fulfillment_strategy VARCHAR(32)"
    )
    op.execute(
        "ALTER TABLE billing_products "
        "ADD COLUMN IF NOT EXISTS fulfillment_handler VARCHAR(32)"
    )
    # Backfill explícito por tipo legado (sem fuzzy de nome).
    op.execute(
        "UPDATE billing_products SET fulfillment_strategy='project', "
        "fulfillment_handler='project' "
        "WHERE provisioning_type='site_delivery' "
        "AND fulfillment_handler IS NULL"
    )
    op.execute(
        "UPDATE billing_products SET fulfillment_strategy='guided', "
        "fulfillment_handler='hestia' "
        "WHERE provisioning_type='hestia_hosting' "
        "AND fulfillment_handler IS NULL"
    )
    op.execute(
        "UPDATE billing_products SET fulfillment_strategy='guided', "
        "fulfillment_handler='mail' "
        "WHERE (slug='professional-email' OR category='email') "
        "AND fulfillment_handler IS NULL"
    )
    op.execute(
        "UPDATE billing_products SET fulfillment_strategy='manual', "
        "fulfillment_handler='manual' "
        "WHERE fulfillment_handler IS NULL"
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS fulfillment_fulfillments (
            id SERIAL PRIMARY KEY,
            org_id VARCHAR(64) NOT NULL DEFAULT 'innexar',
            customer_id INTEGER NOT NULL REFERENCES customers(id),
            contract_id INTEGER NOT NULL REFERENCES billing_contracts(id),
            contract_item_id INTEGER NOT NULL REFERENCES billing_contract_items(id),
            product_id INTEGER REFERENCES billing_products(id),
            invoice_id INTEGER REFERENCES billing_invoices(id),
            subscription_id INTEGER REFERENCES billing_subscriptions(id),
            service_id INTEGER REFERENCES mail_services(id),
            project_id INTEGER,
            strategy VARCHAR(32) NOT NULL DEFAULT 'manual',
            handler_key VARCHAR(32) NOT NULL DEFAULT 'manual',
            status VARCHAR(32) NOT NULL DEFAULT 'pending',
            current_step VARCHAR(128),
            progress INTEGER NOT NULL DEFAULT 0,
            last_error TEXT,
            retryable BOOLEAN NOT NULL DEFAULT FALSE,
            retry_count INTEGER NOT NULL DEFAULT 0,
            next_retry_at TIMESTAMP WITH TIME ZONE,
            idempotency_key VARCHAR(128) NOT NULL,
            started_at TIMESTAMP WITH TIME ZONE,
            completed_at TIMESTAMP WITH TIME ZONE,
            meta JSON,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            UNIQUE (idempotency_key)
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_fulfillments_customer "
        "ON fulfillment_fulfillments (customer_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_fulfillments_contract_item "
        "ON fulfillment_fulfillments (contract_item_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_fulfillments_status "
        "ON fulfillment_fulfillments (status)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_fulfillments_handler "
        "ON fulfillment_fulfillments (handler_key)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_fulfillments_next_retry "
        "ON fulfillment_fulfillments (next_retry_at) "
        "WHERE status IN ('queued','failed')"
    )
    for slug, desc in (
        ("provisioning.read", "Ver central de provisionamento/fulfillment"),
        ("provisioning.retry", "Reprocessar fulfillment com falha"),
        ("provisioning.manage", "Ações de fulfillment (resolver/cancelar)"),
    ):
        op.execute(
            "INSERT INTO permissions (slug, description) "
            f"SELECT '{slug}', '{desc}' WHERE NOT EXISTS "
            f"(SELECT 1 FROM permissions WHERE slug='{slug}')"
        )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS fulfillment_fulfillments")
    op.execute("ALTER TABLE billing_products DROP COLUMN IF EXISTS fulfillment_handler")
    op.execute("ALTER TABLE billing_products DROP COLUMN IF EXISTS fulfillment_strategy")
    op.execute("DELETE FROM permissions WHERE slug IN "
               "('provisioning.read','provisioning.retry','provisioning.manage')")
