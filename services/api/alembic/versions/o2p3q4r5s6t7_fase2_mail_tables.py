"""Fase 2 Mail: mail_services, mail_domains, mail_mailboxes, mail_provisioning_jobs.

Idempotent DDL (IF NOT EXISTS). No data migration.
"""

from alembic import op

revision = "o2p3q4r5s6t7"
down_revision = "n1o2p3q4r5s6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS mail_services (
            id SERIAL PRIMARY KEY,
            customer_id INTEGER NOT NULL REFERENCES customers(id),
            contract_item_id INTEGER REFERENCES billing_contract_items(id),
            org_id VARCHAR(64) NOT NULL DEFAULT 'innexar',
            service_type VARCHAR(64) NOT NULL DEFAULT 'professional_email',
            status VARCHAR(32) NOT NULL DEFAULT 'pending',
            provider VARCHAR(32) NOT NULL DEFAULT 'docker-mailserver',
            external_reference VARCHAR(255),
            activated_at TIMESTAMP WITH TIME ZONE,
            suspended_at TIMESTAMP WITH TIME ZONE,
            meta JSON,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_mail_services_customer "
        "ON mail_services (customer_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_mail_services_status ON mail_services (status)"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS mail_domains (
            id SERIAL PRIMARY KEY,
            customer_id INTEGER NOT NULL REFERENCES customers(id),
            service_id INTEGER REFERENCES mail_services(id),
            org_id VARCHAR(64) NOT NULL DEFAULT 'innexar',
            domain VARCHAR(255) NOT NULL,
            provider VARCHAR(32) NOT NULL DEFAULT 'docker-mailserver',
            external_id VARCHAR(255),
            status VARCHAR(32) NOT NULL DEFAULT 'pending',
            verified_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_mail_domains_customer "
        "ON mail_domains (customer_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_mail_domains_domain ON mail_domains (domain)"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS mail_mailboxes (
            id SERIAL PRIMARY KEY,
            customer_id INTEGER NOT NULL REFERENCES customers(id),
            service_id INTEGER REFERENCES mail_services(id),
            email_domain_id INTEGER NOT NULL REFERENCES mail_domains(id) ON DELETE CASCADE,
            org_id VARCHAR(64) NOT NULL DEFAULT 'innexar',
            address VARCHAR(320) NOT NULL,
            local_part VARCHAR(128) NOT NULL,
            display_name VARCHAR(255),
            quota VARCHAR(32),
            provider VARCHAR(32) NOT NULL DEFAULT 'docker-mailserver',
            external_id VARCHAR(320),
            status VARCHAR(32) NOT NULL DEFAULT 'active',
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_mail_mailboxes_customer "
        "ON mail_mailboxes (customer_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_mail_mailboxes_address "
        "ON mail_mailboxes (address)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_mail_mailboxes_status "
        "ON mail_mailboxes (status)"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS mail_provisioning_jobs (
            id SERIAL PRIMARY KEY,
            mailbox_id INTEGER REFERENCES mail_mailboxes(id) ON DELETE SET NULL,
            invoice_id INTEGER REFERENCES billing_invoices(id),
            org_id VARCHAR(64) NOT NULL DEFAULT 'innexar',
            job_type VARCHAR(32) NOT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'pending',
            attempts INTEGER NOT NULL DEFAULT 0,
            last_error TEXT,
            idempotency_key VARCHAR(128),
            payload JSON,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            completed_at TIMESTAMP WITH TIME ZONE
        )
        """
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_mail_jobs_idempotency "
        "ON mail_provisioning_jobs (idempotency_key)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_mail_jobs_status ON mail_provisioning_jobs (status)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS mail_provisioning_jobs")
    op.execute("DROP TABLE IF EXISTS mail_mailboxes")
    op.execute("DROP TABLE IF EXISTS mail_domains")
    op.execute("DROP TABLE IF EXISTS mail_services")
