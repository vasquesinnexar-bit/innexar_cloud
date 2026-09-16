"""P1.3 onboarding engine: sessions + steps + perms. Aditiva e reversível."""

revision = "w0x1y2z3a4b5"
down_revision = "v9w0x1y2z3a4"


from alembic import op


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS onboarding_sessions (
            id SERIAL PRIMARY KEY,
            org_id VARCHAR(64) NOT NULL DEFAULT 'innexar',
            customer_id INTEGER NOT NULL REFERENCES customers(id),
            contract_item_id INTEGER REFERENCES billing_contract_items(id),
            fulfillment_id INTEGER REFERENCES fulfillment_fulfillments(id),
            product_id INTEGER REFERENCES billing_products(id),
            type VARCHAR(64) NOT NULL DEFAULT 'manual',
            status VARCHAR(32) NOT NULL DEFAULT 'pending',
            current_step VARCHAR(128),
            progress INTEGER NOT NULL DEFAULT 0,
            last_error TEXT,
            idempotency_key VARCHAR(128) NOT NULL,
            started_at TIMESTAMP WITH TIME ZONE,
            completed_at TIMESTAMP WITH TIME ZONE,
            last_activity_at TIMESTAMP WITH TIME ZONE,
            meta JSON,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            UNIQUE (idempotency_key)
        )
        """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_onboarding_customer "
        "ON onboarding_sessions (customer_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_onboarding_fulfillment "
        "ON onboarding_sessions (fulfillment_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_onboarding_status "
        "ON onboarding_sessions (status)"
    )
    op.execute("""
        CREATE TABLE IF NOT EXISTS onboarding_steps (
            id SERIAL PRIMARY KEY,
            onboarding_id INTEGER NOT NULL
                REFERENCES onboarding_sessions(id) ON DELETE CASCADE,
            step_key VARCHAR(128) NOT NULL,
            position INTEGER NOT NULL DEFAULT 0,
            required BOOLEAN NOT NULL DEFAULT TRUE,
            status VARCHAR(32) NOT NULL DEFAULT 'pending',
            data JSON,
            validation_error TEXT,
            completed_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            UNIQUE (onboarding_id, step_key)
        )
        """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_onboarding_steps_session "
        "ON onboarding_steps (onboarding_id)"
    )
    for slug, desc in (
        ("onboarding.read", "Ver onboardings e intervenções"),
        ("onboarding.retry", "Reprocessar onboarding com falha"),
        ("onboarding.manage", "Intervir em onboarding (resolver/avançar)"),
    ):
        op.execute(
            "INSERT INTO permissions (slug, description) "
            f"SELECT '{slug}', '{desc}' WHERE NOT EXISTS "
            f"(SELECT 1 FROM permissions WHERE slug='{slug}')"
        )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS onboarding_steps")
    op.execute("DROP TABLE IF EXISTS onboarding_sessions")
    op.execute(
        "DELETE FROM permissions WHERE slug IN "
        "('onboarding.read','onboarding.retry','onboarding.manage')"
    )
