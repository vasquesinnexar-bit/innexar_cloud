"""Fase 4 Hosting: servers, services, backups, revisions, jobs + RBAC perms.

Idempotent DDL (IF NOT EXISTS).
"""

from alembic import op

revision = "q4r5s6t7u8v9"
down_revision = "p3q4r5s6t7u8"
branch_labels = None
depends_on = None

HOSTING_PERMS = [
    "hosting.view",
    "hosting.metrics.view",
    "hosting.logs.view",
    "hosting.restart",
    "hosting.files.view",
    "hosting.files.edit",
    "hosting.files.upload",
    "hosting.files.delete",
    "hosting.backups.view",
    "hosting.backups.create",
    "hosting.backups.restore",
    "hosting.domains.view",
    "hosting.admin",
]


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS hosting_servers (
            id SERIAL PRIMARY KEY,
            name VARCHAR(128) NOT NULL UNIQUE,
            hostname VARCHAR(255) NOT NULL,
            provider VARCHAR(64) NOT NULL DEFAULT 'docker',
            region VARCHAR(64) NOT NULL DEFAULT 'unknown',
            environment VARCHAR(32) NOT NULL DEFAULT 'production',
            status VARCHAR(32) NOT NULL DEFAULT 'unknown',
            capabilities JSON,
            meta JSON,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS hosting_services (
            id SERIAL PRIMARY KEY,
            customer_id INTEGER NOT NULL REFERENCES customers(id),
            contract_item_id INTEGER REFERENCES billing_contract_items(id),
            server_id INTEGER REFERENCES hosting_servers(id),
            org_id VARCHAR(64) NOT NULL DEFAULT 'innexar',
            runtime_type VARCHAR(32) NOT NULL DEFAULT 'docker',
            container_id VARCHAR(128),
            container_name VARCHAR(128),
            project_name VARCHAR(128),
            root_path VARCHAR(512),
            path_mode VARCHAR(16) NOT NULL DEFAULT 'container',
            primary_domain VARCHAR(255),
            environment VARCHAR(32) NOT NULL DEFAULT 'production',
            internal_port INTEGER,
            cpu_limit VARCHAR(32),
            memory_limit VARCHAR(32),
            disk_limit VARCHAR(32),
            status VARCHAR(32) NOT NULL DEFAULT 'pending',
            last_deploy_at TIMESTAMP WITH TIME ZONE,
            last_backup_at TIMESTAMP WITH TIME ZONE,
            meta JSON,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_hosting_services_customer "
        "ON hosting_services (customer_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_hosting_services_container "
        "ON hosting_services (container_name)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_hosting_services_status "
        "ON hosting_services (status)"
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS hosting_backups (
            id SERIAL PRIMARY KEY,
            hosting_service_id INTEGER NOT NULL REFERENCES hosting_services(id) ON DELETE CASCADE,
            provider VARCHAR(32) NOT NULL DEFAULT 'docker',
            backup_type VARCHAR(32) NOT NULL DEFAULT 'files',
            status VARCHAR(32) NOT NULL DEFAULT 'pending',
            size_bytes BIGINT,
            checksum VARCHAR(128),
            storage_reference VARCHAR(512),
            created_by VARCHAR(128),
            started_at TIMESTAMP WITH TIME ZONE,
            completed_at TIMESTAMP WITH TIME ZONE,
            expires_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_hosting_backups_service "
        "ON hosting_backups (hosting_service_id)"
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS file_revisions (
            id SERIAL PRIMARY KEY,
            hosting_service_id INTEGER NOT NULL REFERENCES hosting_services(id) ON DELETE CASCADE,
            path VARCHAR(512) NOT NULL,
            checksum_before VARCHAR(128),
            checksum_after VARCHAR(128),
            content_before TEXT,
            storage_reference VARCHAR(512),
            actor_id VARCHAR(128),
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_file_revisions_service "
        "ON file_revisions (hosting_service_id)"
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS hosting_jobs (
            id SERIAL PRIMARY KEY,
            hosting_service_id INTEGER NOT NULL REFERENCES hosting_services(id) ON DELETE CASCADE,
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
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_hosting_jobs_idempotency "
        "ON hosting_jobs (idempotency_key) WHERE idempotency_key IS NOT NULL"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_hosting_jobs_status "
        "ON hosting_jobs (status)"
    )
    for slug in HOSTING_PERMS:
        op.execute(
            "INSERT INTO permissions (slug, description) "
            "SELECT '%s', '%s' WHERE NOT EXISTS "
            "(SELECT 1 FROM permissions WHERE slug='%s')" % (slug, slug, slug)
        )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS hosting_jobs")
    op.execute("DROP TABLE IF EXISTS file_revisions")
    op.execute("DROP TABLE IF EXISTS hosting_backups")
    op.execute("DROP TABLE IF EXISTS hosting_services")
    op.execute("DROP TABLE IF EXISTS hosting_servers")
