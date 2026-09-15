"""Faxina CI: tabelas project_messages/modification_requests sem migration.

Aditiva e idempotente (IF NOT EXISTS). DDL espelha o banco de produção.
"""

revision = "u8v9w0x1y2z3"
down_revision = "t7u8v9w0x1y2"


from alembic import op


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS project_messages (
            id SERIAL PRIMARY KEY,
            project_id INTEGER NOT NULL REFERENCES projects(id),
            sender_type VARCHAR(16) NOT NULL,
            sender_id INTEGER NOT NULL,
            sender_name VARCHAR(255),
            body TEXT NOT NULL,
            attachment_key VARCHAR(512),
            attachment_name VARCHAR(255),
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS modification_requests (
            id SERIAL PRIMARY KEY,
            project_id INTEGER NOT NULL REFERENCES projects(id),
            customer_id INTEGER NOT NULL REFERENCES customers(id),
            title VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            attachment_key VARCHAR(512),
            attachment_name VARCHAR(255),
            status VARCHAR(32) NOT NULL DEFAULT 'pending',
            staff_notes TEXT,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        )
        """
    )
    for idx, table, col in (
        ("ix_project_messages_project_id", "project_messages", "project_id"),
        ("ix_project_messages_sender_type", "project_messages", "sender_type"),
        ("ix_modification_requests_project_id", "modification_requests", "project_id"),
        ("ix_modification_requests_customer_id", "modification_requests", "customer_id"),
        ("ix_modification_requests_status", "modification_requests", "status"),
    ):
        op.execute(
            f"CREATE INDEX IF NOT EXISTS {idx} ON {table} ({col})"
        )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS modification_requests")
    op.execute("DROP TABLE IF EXISTS project_messages")
