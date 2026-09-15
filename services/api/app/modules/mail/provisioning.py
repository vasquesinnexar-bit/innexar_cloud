"""Mail provisioning trigger: after payment, run pending mail jobs for the invoice.

Called from billing.provisioning.trigger_provisioning_if_needed (single point
covering webhook, portal pay and workspace mark-paid flows).
"""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.mail.models import MailProvisioningJob
from app.modules.mail.service import MailService

logger = logging.getLogger(__name__)


async def trigger_mail_provisioning_if_needed(
    db: AsyncSession, invoice_id: int
) -> None:
    """Process PENDING mail jobs linked to a paid invoice (idempotent)."""
    rows = (
        (
            await db.execute(
                select(MailProvisioningJob).where(
                    MailProvisioningJob.invoice_id == invoice_id,
                    MailProvisioningJob.status == "pending",
                )
            )
        )
        .scalars()
        .all()
    )
    if not rows:
        return
    svc = MailService(db)
    result = await svc.process_pending_jobs(limit=50)
    logger.info("mail provisioning for invoice %s: %s", invoice_id, result)
