"""Support repository: tickets and ticket messages."""

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.support.models import Ticket, TicketMessage


class SupportRepository:
    """Repository for Ticket aggregate (tickets + messages)."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def delete_all_tickets_for_customer(self, customer_id: int) -> None:
        """Remove ticket messages then tickets (customer_id is NOT NULL; ORM would null FK)."""
        r = await self._db.execute(
            select(Ticket.id).where(Ticket.customer_id == customer_id)
        )
        tids = list(r.scalars().all())
        if not tids:
            return
        await self._db.execute(
            delete(TicketMessage).where(TicketMessage.ticket_id.in_(tids))
        )
        await self._db.execute(delete(Ticket).where(Ticket.id.in_(tids)))
        await self._db.flush()

    async def list_tickets(
        self,
        org_id: str | None = "innexar",
        category: str | None = None,
        project_id: int | None = None,
        order_desc: bool = True,
    ) -> list[Ticket]:
        q = select(Ticket)
        if org_id is not None:
            q = q.where(Ticket.org_id == org_id)
        if category is not None:
            q = q.where(Ticket.category == category)
        if project_id is not None:
            q = q.where(Ticket.project_id == project_id)
        if order_desc:
            q = q.order_by(Ticket.id.desc())
        r = await self._db.execute(q)
        return list(r.scalars().all())

    async def get_ticket_by_id(
        self, ticket_id: int, org_id: str | None = None
    ) -> Ticket | None:
        q = select(Ticket).where(Ticket.id == ticket_id)
        if org_id is not None:
            q = q.where(Ticket.org_id == org_id)
        r = await self._db.execute(q)
        return r.scalar_one_or_none()

    async def list_tickets_by_customer_id(
        self, customer_id: int, order_desc: bool = True
    ) -> list[Ticket]:
        """List tickets for a customer (portal)."""
        q = (
            select(Ticket)
            .where(Ticket.customer_id == customer_id)
            .order_by(Ticket.id.desc() if order_desc else Ticket.id)
        )
        r = await self._db.execute(q)
        return list(r.scalars().all())

    async def get_ticket_by_id_and_customer(
        self, ticket_id: int, customer_id: int
    ) -> Ticket | None:
        """Get ticket by id if owned by customer (portal)."""
        r = await self._db.execute(
            select(Ticket)
            .where(
                Ticket.id == ticket_id,
                Ticket.customer_id == customer_id,
            )
            .limit(1)
        )
        return r.scalar_one_or_none()

    async def list_messages_by_ticket_id(self, ticket_id: int) -> list[TicketMessage]:
        """List messages for a ticket, ordered by id."""
        r = await self._db.execute(
            select(TicketMessage)
            .where(TicketMessage.ticket_id == ticket_id)
            .order_by(TicketMessage.id)
        )
        return list(r.scalars().all())

    async def get_open_ticket_count_for_customer(self, customer_id: int) -> int:
        """Count open tickets for customer (portal dashboard)."""
        r = await self._db.execute(
            select(func.count())
            .select_from(Ticket)
            .where(
                Ticket.customer_id == customer_id,
                Ticket.status == "open",
            )
        )
        return r.scalar() or 0

    async def get_ticket_counts(
        self, org_id: str | None = None
    ) -> tuple[int, int]:
        """Returns (open_count, closed_count) for dashboard summary."""
        open_q = select(func.count()).select_from(Ticket).where(Ticket.status == "open")
        closed_q = select(func.count()).select_from(Ticket).where(Ticket.status == "closed")
        if org_id is not None:
            open_q = open_q.where(Ticket.org_id == org_id)
            closed_q = closed_q.where(Ticket.org_id == org_id)
        r = await self._db.execute(open_q)
        open_count = r.scalar() or 0
        r = await self._db.execute(closed_q)
        closed_count = r.scalar() or 0
        return (open_count, closed_count)

    def add_ticket(self, ticket: Ticket) -> None:
        self._db.add(ticket)

    async def flush_and_refresh_ticket(self, ticket: Ticket) -> None:
        await self._db.flush()
        await self._db.refresh(ticket)

    def add_message(self, msg: TicketMessage) -> None:
        self._db.add(msg)

    async def flush_and_refresh_message(self, msg: TicketMessage) -> None:
        await self._db.flush()
        await self._db.refresh(msg)
