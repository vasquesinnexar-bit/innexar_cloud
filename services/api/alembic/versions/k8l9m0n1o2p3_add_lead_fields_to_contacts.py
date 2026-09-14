"""Add lead fields to crm_contacts."""

from alembic import op
import sqlalchemy as sa

revision = "k8l9m0n1o2p3"
down_revision = "j7k8l9m0n1o2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "crm_contacts",
        sa.Column("source", sa.String(length=128), nullable=True),
    )
    op.add_column(
        "crm_contacts",
        sa.Column("message", sa.Text(), nullable=True),
    )
    op.add_column(
        "crm_contacts",
        sa.Column(
            "status",
            sa.String(length=32),
            nullable=False,
            server_default="new",
        ),
    )
    op.add_column(
        "crm_contacts",
        sa.Column("extra_data", sa.JSON(), nullable=True),
    )
    op.create_index("ix_crm_contacts_status", "crm_contacts", ["status"])
    op.create_index("ix_crm_contacts_source", "crm_contacts", ["source"])


def downgrade() -> None:
    op.drop_index("ix_crm_contacts_source", table_name="crm_contacts")
    op.drop_index("ix_crm_contacts_status", table_name="crm_contacts")
    op.drop_column("crm_contacts", "extra_data")
    op.drop_column("crm_contacts", "status")
    op.drop_column("crm_contacts", "message")
    op.drop_column("crm_contacts", "source")
