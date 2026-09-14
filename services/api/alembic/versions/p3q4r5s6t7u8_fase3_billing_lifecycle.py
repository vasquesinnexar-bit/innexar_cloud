"""Fase 3 Billing: policy, refunds, attempt detail, contract schedule, invoice period.

Idempotent DDL (IF NOT EXISTS).
"""

from alembic import op

revision = "p3q4r5s6t7u8"
down_revision = "o2p3q4r5s6t7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- contracts: agenda ---
    op.execute(
        "ALTER TABLE billing_contracts ADD COLUMN IF NOT EXISTS billing_interval VARCHAR(16)"
    )
    op.execute(
        "ALTER TABLE billing_contracts ADD COLUMN IF NOT EXISTS billing_day INTEGER"
    )
    op.execute(
        "ALTER TABLE billing_contracts ADD COLUMN IF NOT EXISTS due_days INTEGER"
    )
    op.execute(
        "ALTER TABLE billing_contracts ADD COLUMN IF NOT EXISTS timezone VARCHAR(64)"
    )
    op.execute(
        "ALTER TABLE billing_contracts ADD COLUMN IF NOT EXISTS credit_balance "
        "NUMERIC(12, 2) NOT NULL DEFAULT 0"
    )

    # --- invoices: período + lembretes ---
    op.execute(
        "ALTER TABLE billing_invoices ADD COLUMN IF NOT EXISTS period_key VARCHAR(32)"
    )
    op.execute(
        "ALTER TABLE billing_invoices ADD COLUMN IF NOT EXISTS reminders_sent JSON"
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_invoices_period "
        "ON billing_invoices (period_key) WHERE period_key IS NOT NULL"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_billing_invoices_period "
        "ON billing_invoices (period_key)"
    )

    # --- attempts: entidade completa ---
    op.execute(
        "ALTER TABLE billing_payment_attempts ADD COLUMN IF NOT EXISTS method VARCHAR(32)"
    )
    op.execute(
        "ALTER TABLE billing_payment_attempts ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2)"
    )
    op.execute(
        "ALTER TABLE billing_payment_attempts ADD COLUMN IF NOT EXISTS expires_at "
        "TIMESTAMP WITH TIME ZONE"
    )
    op.execute(
        "ALTER TABLE billing_payment_attempts ADD COLUMN IF NOT EXISTS paid_at "
        "TIMESTAMP WITH TIME ZONE"
    )
    op.execute(
        "ALTER TABLE billing_payment_attempts ADD COLUMN IF NOT EXISTS failure_code VARCHAR(64)"
    )
    op.execute(
        "ALTER TABLE billing_payment_attempts ADD COLUMN IF NOT EXISTS meta JSON"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_billing_attempts_method "
        "ON billing_payment_attempts (method)"
    )

    # --- policies ---
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS billing_policies (
            id SERIAL PRIMARY KEY,
            scope VARCHAR(16) NOT NULL,
            scope_ref VARCHAR(128),
            grace_period_days INTEGER NOT NULL DEFAULT 7,
            reminder_days_before JSON,
            reminder_days_after JSON,
            suspend_after_days INTEGER NOT NULL DEFAULT 14,
            cancel_after_days INTEGER,
            auto_reactivate BOOLEAN NOT NULL DEFAULT true,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_billing_policies_scope "
        "ON billing_policies (scope, scope_ref)"
    )
    op.execute(
        "INSERT INTO billing_policies "
        "(scope, grace_period_days, reminder_days_before, reminder_days_after, "
        "suspend_after_days, auto_reactivate, is_active, created_at, updated_at) "
        "SELECT 'global', 7, '[3, 1]', '[1, 3, 5]', 14, true, true, now(), now() "
        "WHERE NOT EXISTS "
        "(SELECT 1 FROM billing_policies WHERE scope='global' AND scope_ref IS NULL)"
    )

    # --- refunds ---
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS billing_refunds (
            id SERIAL PRIMARY KEY,
            invoice_id INTEGER NOT NULL REFERENCES billing_invoices(id),
            payment_attempt_id INTEGER REFERENCES billing_payment_attempts(id),
            provider VARCHAR(32) NOT NULL,
            provider_refund_id VARCHAR(255),
            amount NUMERIC(12, 2) NOT NULL,
            currency VARCHAR(8) NOT NULL DEFAULT 'USD',
            status VARCHAR(32) NOT NULL DEFAULT 'pending',
            reason VARCHAR(512),
            actor_type VARCHAR(32) NOT NULL DEFAULT 'staff',
            actor_id VARCHAR(128),
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_billing_refunds_invoice "
        "ON billing_refunds (invoice_id)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS billing_refunds")
    op.execute("DROP TABLE IF EXISTS billing_policies")
    for col in ("meta", "failure_code", "paid_at", "expires_at", "amount", "method"):
        op.execute(
            f"ALTER TABLE billing_payment_attempts DROP COLUMN IF EXISTS {col}"
        )
    op.execute("DROP INDEX IF EXISTS uq_billing_invoices_period")
    for col in ("reminders_sent", "period_key"):
        op.execute(f"ALTER TABLE billing_invoices DROP COLUMN IF EXISTS {col}")
    for col in ("due_days", "billing_day", "billing_interval", "timezone",
                "credit_balance"):
        op.execute(f"ALTER TABLE billing_contracts DROP COLUMN IF EXISTS {col}")
