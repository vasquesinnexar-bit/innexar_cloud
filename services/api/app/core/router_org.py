"""Pass org_id from workspace routers to services."""

from app.core.org import ORG_INNEXAR_BR, ORG_INNEXAR_US, staff_org_id
from app.models.user import User


def router_org_id(current: User) -> str:
    return staff_org_id(current.org_id)


def router_org_list_filter(org_id: str | None) -> str | None:
    """Org filter for list endpoints. None = all orgs (Brasil + USA)."""
    if not org_id or org_id == "all":
        return None
    if org_id in (ORG_INNEXAR_US, ORG_INNEXAR_BR):
        return org_id
    return None


def router_org_write(current: User, org_id: str | None = None) -> str:
    """Org for create/update. Uses query override or staff default."""
    if org_id in (ORG_INNEXAR_US, ORG_INNEXAR_BR):
        return org_id
    return staff_org_id(current.org_id)
