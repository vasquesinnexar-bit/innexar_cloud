"""Add representatives table.

Uses idempotent DDL (IF NOT EXISTS) so it can run after create_all or when re-running.
"""

from alembic import op

revision = "l9m0n1o2p3q4"
down_revision = "k8l9m0n1o2p3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS representatives (
            id SERIAL PRIMARY KEY,
            org_id VARCHAR(64) NOT NULL DEFAULT 'innexar',
            user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
            name VARCHAR(255) NOT NULL,
            region VARCHAR(128),
            commission_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
            status VARCHAR(32) NOT NULL DEFAULT 'active',
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_representatives_org_id ON representatives (org_id)"
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_representatives_user_id ON representatives (user_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_representatives_region ON representatives (region)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_representatives_status ON representatives (status)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_representatives_status")
    op.execute("DROP INDEX IF EXISTS ix_representatives_region")
    op.execute("DROP INDEX IF EXISTS ix_representatives_user_id")
    op.execute("DROP INDEX IF EXISTS ix_representatives_org_id")
    op.execute("DROP TABLE IF EXISTS representatives")
