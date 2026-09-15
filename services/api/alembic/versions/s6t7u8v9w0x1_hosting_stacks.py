"""TAREFA 1: hosting stacks (stack + components) + stack_id no service.

NÃO destrutiva: só CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS.
"""

revision = "s6t7u8v9w0x1"
down_revision = "r5s6t7u8v9w0"


from alembic import op


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS hosting_stacks (
            id SERIAL PRIMARY KEY,
            customer_id INTEGER REFERENCES customers(id),
            contract_item_id INTEGER REFERENCES billing_contract_items(id),
            server_id INTEGER REFERENCES hosting_servers(id),
            org_id VARCHAR(64) NOT NULL DEFAULT 'innexar',
            name VARCHAR(128) NOT NULL,
            slug VARCHAR(128) NOT NULL,
            description TEXT,
            status VARCHAR(32) NOT NULL DEFAULT 'pending',
            stack_type VARCHAR(32) NOT NULL DEFAULT 'customer_service',
            primary_domain VARCHAR(255),
            compose_project VARCHAR(128),
            working_dir VARCHAR(512),
            root_path VARCHAR(512),
            environment VARCHAR(32) NOT NULL DEFAULT 'production',
            activated_at TIMESTAMP WITH TIME ZONE,
            meta JSON,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_hosting_stacks_customer "
        "ON hosting_stacks (customer_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_hosting_stacks_slug "
        "ON hosting_stacks (slug)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_hosting_stacks_compose "
        "ON hosting_stacks (compose_project)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_hosting_stacks_type "
        "ON hosting_stacks (stack_type)"
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS hosting_stack_components (
            id SERIAL PRIMARY KEY,
            stack_id INTEGER NOT NULL REFERENCES hosting_stacks(id) ON DELETE CASCADE,
            container_name VARCHAR(128) NOT NULL,
            container_id VARCHAR(128),
            role VARCHAR(32) NOT NULL DEFAULT 'other',
            image VARCHAR(255),
            status VARCHAR(32),
            is_public BOOLEAN NOT NULL DEFAULT FALSE,
            internal_only BOOLEAN NOT NULL DEFAULT TRUE,
            ports VARCHAR(512),
            meta JSON,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_hosting_stack_components_stack "
        "ON hosting_stack_components (stack_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_hosting_stack_components_container "
        "ON hosting_stack_components (container_name)"
    )
    op.execute(
        "ALTER TABLE hosting_services "
        "ADD COLUMN IF NOT EXISTS stack_id INTEGER REFERENCES hosting_stacks(id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_hosting_services_stack "
        "ON hosting_services (stack_id)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS hosting_stack_components")
    op.execute("DROP TABLE IF EXISTS hosting_stacks")
    op.execute("ALTER TABLE hosting_services DROP COLUMN IF EXISTS stack_id")
