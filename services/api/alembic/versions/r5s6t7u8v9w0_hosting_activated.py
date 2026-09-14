"""Fase 4 fix: activated_at/suspended_at em hosting_services."""

from alembic import op

revision = "r5s6t7u8v9w0"
down_revision = "q4r5s6t7u8v9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE hosting_services ADD COLUMN IF NOT EXISTS activated_at "
        "TIMESTAMP WITH TIME ZONE"
    )
    op.execute(
        "ALTER TABLE hosting_services ADD COLUMN IF NOT EXISTS suspended_at "
        "TIMESTAMP WITH TIME ZONE"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE hosting_services DROP COLUMN IF EXISTS suspended_at")
    op.execute("ALTER TABLE hosting_services DROP COLUMN IF EXISTS activated_at")
