"""Notifications service: create notification and optionally send email."""

from typing import TYPE_CHECKING

from app.core.email_templates import generic_notification_email
from app.core.ops_notifications import copy_notification_to_ops
from app.models.notification import Notification
from app.providers.email.loader import get_email_provider
from fastapi import BackgroundTasks

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


async def create_notification_and_maybe_send_email(
    db: "AsyncSession",
    background_tasks: BackgroundTasks,
    *,
    customer_user_id: int | None = None,
    user_id: int | None = None,
    channel: str = "in_app",
    title: str = "",
    body: str = "",
    recipient_email: str | None = None,
    org_id: str = "innexar",
    email_subject: str | None = None,
    email_body: str | None = None,
    email_html: str | None = None,
    email_locale: str = "en",
    email_action_url: str | None = None,
    email_action_label: str | None = None,
) -> Notification:
    """Create a Notification and, if channel includes 'email' and provider is configured, send email in background."""
    n = Notification(
        customer_user_id=customer_user_id,
        user_id=user_id,
        channel=channel,
        title=title,
        body=body,
    )
    db.add(n)
    await db.flush()
    if "email" in channel and recipient_email:
        provider = await get_email_provider(db, org_id=org_id)
        if provider:
            subject_to_send = email_subject or title
            plain_to_send = email_body if email_body is not None else (body or "")
            html_to_send = email_html
            if html_to_send is None:
                _, html_to_send = generic_notification_email(
                    title=subject_to_send,
                    body=plain_to_send,
                    locale=email_locale,
                    action_url=email_action_url,
                    action_label=email_action_label,
                )
            background_tasks.add_task(
                provider.send,
                recipient_email,
                subject_to_send,
                plain_to_send,
                html_to_send,
            )
            await copy_notification_to_ops(
                db,
                original_recipient_email=recipient_email,
                subject=subject_to_send,
                body=plain_to_send,
                org_id=org_id,
                html=html_to_send,
            )
    return n
