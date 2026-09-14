"""Add assigned_rep_id to crm_contacts, crm_contact_activities table, and
seed RBAC permissions/role for the Representantes Comerciais module.

Uses idempotent DDL (IF NOT EXISTS) so it can run after create_all or when re-running.
"""

from alembic import op
import sqlalchemy as sa

revision = "m0n1o2p3q4r5"
down_revision = "l9m0n1o2p3q4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS assigned_rep_id "
        "INTEGER REFERENCES representatives(id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_crm_contacts_assigned_rep_id "
        "ON crm_contacts (assigned_rep_id)"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS crm_contact_activities (
            id SERIAL PRIMARY KEY,
            org_id VARCHAR(64) NOT NULL DEFAULT 'innexar',
            contact_id INTEGER NOT NULL REFERENCES crm_contacts(id),
            rep_id INTEGER REFERENCES representatives(id),
            activity_type VARCHAR(32) NOT NULL DEFAULT 'note',
            note TEXT,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_crm_contact_activities_org_id "
        "ON crm_contact_activities (org_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_crm_contact_activities_contact_id "
        "ON crm_contact_activities (contact_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_crm_contact_activities_rep_id "
        "ON crm_contact_activities (rep_id)"
    )

    # --- RBAC seed data: reps:read/reps:write permissions + a sales_rep role ---
    # (Bootstrap-time seeding in seed_service.py only runs on first-ever install;
    # this data migration is what actually lands the new permissions/role on the
    # already-bootstrapped production DB. Idempotent: checks before inserting.)
    conn = op.get_bind()
    permissions = sa.table(
        "permissions",
        sa.column("id", sa.Integer),
        sa.column("slug", sa.String),
        sa.column("description", sa.String),
    )
    roles = sa.table(
        "roles",
        sa.column("id", sa.Integer),
        sa.column("org_id", sa.String),
        sa.column("name", sa.String),
        sa.column("slug", sa.String),
        sa.column("created_at", sa.DateTime),
    )
    role_permissions = sa.table(
        "role_permissions",
        sa.column("role_id", sa.Integer),
        sa.column("permission_id", sa.Integer),
    )

    perm_ids: dict[str, int] = {}
    for slug in ("reps:read", "reps:write", "crm:read", "crm:write"):
        existing = conn.execute(
            sa.select(permissions.c.id).where(permissions.c.slug == slug)
        ).scalar_one_or_none()
        if existing is None:
            conn.execute(permissions.insert().values(slug=slug, description=slug))
            perm_ids[slug] = conn.execute(
                sa.select(permissions.c.id).where(permissions.c.slug == slug)
            ).scalar_one()
        else:
            perm_ids[slug] = existing

    sales_rep_role_id = conn.execute(
        sa.select(roles.c.id).where(roles.c.slug == "sales_rep")
    ).scalar_one_or_none()
    if sales_rep_role_id is None:
        conn.execute(
            roles.insert().values(
                org_id="innexar",
                name="Representante Comercial",
                slug="sales_rep",
                created_at=sa.func.now(),
            )
        )
        sales_rep_role_id = conn.execute(
            sa.select(roles.c.id).where(roles.c.slug == "sales_rep")
        ).scalar_one()
        for slug in ("crm:read", "crm:write"):
            conn.execute(
                role_permissions.insert().values(
                    role_id=sales_rep_role_id, permission_id=perm_ids[slug]
                )
            )


def downgrade() -> None:
    conn = op.get_bind()
    roles = sa.table("roles", sa.column("id", sa.Integer), sa.column("slug", sa.String))
    role_permissions = sa.table(
        "role_permissions",
        sa.column("role_id", sa.Integer),
        sa.column("permission_id", sa.Integer),
    )
    sales_rep_role_id = conn.execute(
        sa.select(roles.c.id).where(roles.c.slug == "sales_rep")
    ).scalar_one_or_none()
    if sales_rep_role_id is not None:
        conn.execute(
            role_permissions.delete().where(
                role_permissions.c.role_id == sales_rep_role_id
            )
        )
        conn.execute(roles.delete().where(roles.c.id == sales_rep_role_id))

    permissions = sa.table(
        "permissions", sa.column("id", sa.Integer), sa.column("slug", sa.String)
    )
    conn.execute(
        permissions.delete().where(
            permissions.c.slug.in_(["reps:read", "reps:write"])
        )
    )

    op.execute("DROP INDEX IF EXISTS ix_crm_contact_activities_rep_id")
    op.execute("DROP INDEX IF EXISTS ix_crm_contact_activities_contact_id")
    op.execute("DROP INDEX IF EXISTS ix_crm_contact_activities_org_id")
    op.execute("DROP TABLE IF EXISTS crm_contact_activities")
    op.execute("DROP INDEX IF EXISTS ix_crm_contacts_assigned_rep_id")
    op.execute("ALTER TABLE crm_contacts DROP COLUMN IF EXISTS assigned_rep_id")
