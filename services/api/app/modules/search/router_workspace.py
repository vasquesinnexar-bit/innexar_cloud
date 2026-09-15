"""Busca global do workspace (Fase 5): customer, contact, domain, email, invoice, contract, service, project, ticket."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.rbac import RequirePermission
from app.models.customer import Customer
from app.models.user import User
from app.modules.billing.models import Contract, Invoice
from app.modules.crm.models import Contact
from app.modules.mail.models import EmailDomain, EmailMailbox
from app.modules.projects.models import Project
from app.modules.support.models import Ticket

router = APIRouter()

LIMIT_EACH = 5


@router.get("/search")
async def global_search(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(RequirePermission("dashboard:read"))],
    q: str = "",
    org_id: str | None = None,
) -> dict[str, list[dict[str, Any]]]:
    """Busca textual multi-entidade (LIKE, limite por tipo)."""
    from app.core.router_org import router_org_list_filter

    term = (q or "").strip()[:64]
    if len(term) < 2:
        return {}
    like = f"%{term}%"
    of = router_org_list_filter(org_id)

    async def _customers():
        query = select(Customer).where(or_(
            Customer.name.ilike(like), Customer.email.ilike(like),
            Customer.company.ilike(like),
        )).limit(LIMIT_EACH)
        if of is not None:
            query = query.where(Customer.org_id == of)
        rows = (await db.execute(query)).scalars().all()
        return [{"type": "customer", "id": r.id, "label": f"{r.name} <{r.email}>",
                 "href": f"/customers/{r.id}"} for r in rows]

    async def _contacts():
        rows = (await db.execute(
            select(Contact).where(or_(
                Contact.name.ilike(like), Contact.email.ilike(like),
            )).limit(LIMIT_EACH))).scalars().all()
        return [{"type": "contact", "id": r.id,
                 "label": f"{r.name} <{r.email or ''}>".strip(),
                 "href": "/crm/contacts"} for r in rows]

    async def _invoices():
        query = select(Invoice).where(Invoice.id.cast(__import__(
            "sqlalchemy").String).ilike(like)).limit(LIMIT_EACH)
        rows = (await db.execute(query)).scalars().all()
        return [{"type": "invoice", "id": r.id,
                 "label": f"#{r.id} · {r.status} · {r.total}",
                 "href": "/billing/invoices"} for r in rows]

    async def _contracts():
        rows = (await db.execute(
            select(Contract).order_by(Contract.id.desc()).limit(50)
        )).scalars().all()
        out = []
        for r in rows:
            if term.lower() in str(r.id) or (r.notes or "").lower().find(term.lower()) >= 0:
                out.append({"type": "contract", "id": r.id,
                            "label": f"Contrato #{r.id} · {r.status}",
                            "href": "/billing/contracts"})
            if len(out) >= LIMIT_EACH:
                break
        return out

    async def _mailboxes():
        rows = (await db.execute(
            select(EmailMailbox).where(
                EmailMailbox.address.ilike(like)).limit(LIMIT_EACH)
        )).scalars().all()
        return [{"type": "mailbox", "id": r.id, "label": r.address,
                 "href": "/customers/{}".format(r.customer_id)} for r in rows]

    async def _domains():
        rows = (await db.execute(
            select(EmailDomain).where(
                EmailDomain.domain.ilike(like)).limit(LIMIT_EACH)
        )).scalars().all()
        return [{"type": "domain", "id": r.id, "label": r.domain,
                 "href": "/customers/{}".format(r.customer_id)} for r in rows]

    async def _projects():
        rows = (await db.execute(
            select(Project).where(Project.name.ilike(like)).limit(LIMIT_EACH)
        )).scalars().all()
        return [{"type": "project", "id": r.id, "label": r.name,
                 "href": f"/projects/{r.id}"} for r in rows]

    async def _tickets():
        rows = (await db.execute(
            select(Ticket).where(Ticket.subject.ilike(like)).limit(LIMIT_EACH)
        )).scalars().all()
        return [{"type": "ticket", "id": r.id, "label": r.subject,
                 "href": f"/support/tickets/{r.id}"} for r in rows]

    return {
        "customers": await _customers(),
        "contacts": await _contacts(),
        "invoices": await _invoices(),
        "contracts": await _contracts(),
        "mailboxes": await _mailboxes(),
        "domains": await _domains(),
        "projects": await _projects(),
        "tickets": await _tickets(),
    }
