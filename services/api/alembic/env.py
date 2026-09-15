"""Alembic env: use Base.metadata and DATABASE_URL from settings (sync for migrations)."""
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.config import settings
from app.core.database import Base

# Import all models so Base.metadata has every table
from app.models import (  # noqa: F401
    AuditLog, Customer, CustomerUser, FeatureFlag, HestiaSettings,
    IntegrationConfig, Notification, Permission, ProjectRequest,
    Role, StaffPasswordResetToken, User
)
from app.modules.billing.models import (  # noqa: F401
    BillingPolicy, Contract, ContractItem, Invoice, MPSubscriptionCheckout,
    PaymentAttempt, PricePlan, Product, ProvisioningJob, ProvisioningRecord,
    Refund, Subscription, WebhookEvent
)
from app.modules.crm.models import Contact, ContactActivity  # noqa: F401
from app.modules.files.models import ProjectFile  # noqa: F401
from app.modules.fulfillment.models import Fulfillment  # noqa: F401
from app.modules.hosting.models import (  # noqa: F401
    FileRevision, HostingBackup, HostingComponent, HostingJob, HostingServer,
    HostingService, HostingStack,
)
from app.modules.mail.models import (  # noqa: F401
    EmailDomain, EmailMailbox, MailProvisioningJob, Service,
)
from app.modules.projects.models import Project  # noqa: F401
from app.modules.projects.modification_request import (  # noqa: F401
    ModificationRequest,
)
from app.modules.projects.project_message import ProjectMessage  # noqa: F401
from app.modules.reps.models import Representative  # noqa: F401
from app.modules.support.models import Ticket, TicketMessage  # noqa: F401

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# Use sync URL for migrations (postgresql:// with psycopg2).
# CI usa sqlite em memória: traduz p/ driver sync (somente leitura no check).
_sync_url = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
if _sync_url.startswith("sqlite+aiosqlite://"):
    _sync_url = _sync_url.replace("sqlite+aiosqlite://", "sqlite://")
config.set_main_option("sqlalchemy.url", _sync_url)


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    from sqlalchemy.pool import StaticPool

    kwargs: dict = {"poolclass": pool.NullPool}
    if config.get_main_option("sqlalchemy.url", "").startswith("sqlite:"):
        # :memory: precisa da mesma conexão (só CI/check).
        kwargs = {"poolclass": StaticPool,
                  "connect_args": {"check_same_thread": False}}
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        **kwargs,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
