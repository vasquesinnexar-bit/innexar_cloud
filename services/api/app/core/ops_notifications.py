"""Operational notifications (email + Telegram) for Innexar USA."""

from __future__ import annotations

import json
import logging
import urllib.parse
import urllib.request

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.providers.email.loader import get_email_provider

logger = logging.getLogger(__name__)


def _ops_recipients() -> list[str]:
    recipients: list[str] = []
    primary = (settings.OPS_ALERT_EMAIL or "").strip().lower()
    if primary:
        recipients.append(primary)
    aliases = [
        a.strip().lower()
        for a in (settings.OPS_ALERT_EMAIL_ALIASES or "").split(",")
        if a.strip()
    ]
    for alias in aliases:
        if alias not in recipients:
            recipients.append(alias)
    return recipients


def _send_telegram_message(text: str) -> None:
    token = (settings.OPS_TELEGRAM_BOT_TOKEN or "").strip()
    chat_id = (settings.OPS_TELEGRAM_CHAT_ID or "").strip()
    if not token or not chat_id:
        return

    payload = urllib.parse.urlencode(
        {
            "chat_id": chat_id,
            "text": text,
            "disable_web_page_preview": "true",
        }
    ).encode("utf-8")
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    req = urllib.request.Request(url, data=payload, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")

    try:
        with urllib.request.urlopen(req, timeout=8):
            return
    except Exception as exc:  # pragma: no cover - non-critical side channel
        logger.warning("Telegram notification failed: %s", exc)


async def send_ops_alert(
    db: AsyncSession,
    *,
    subject: str,
    body: str,
    org_id: str = "innexar",
    html: str | None = None,
) -> None:
    """Send operational alert to configured recipients and Telegram.

    This helper is best-effort and must never break business flow.
    """
    recipients = _ops_recipients()
    if recipients:
        try:
            provider = await get_email_provider(db, org_id=org_id)
            if provider:
                for recipient in recipients:
                    provider.send(recipient, subject, body, html)
        except Exception as exc:  # pragma: no cover - non-critical side channel
            logger.warning("Ops email notification failed: %s", exc)

    telegram_text = f"[Innexar Alert] {subject}\n\n{body}"
    _send_telegram_message(telegram_text)


async def copy_notification_to_ops(
    db: AsyncSession,
    *,
    original_recipient_email: str | None,
    subject: str,
    body: str,
    org_id: str = "innexar",
    html: str | None = None,
) -> None:
    """Copy an existing customer/staff notification to operations email(s)."""
    if not settings.OPS_COPY_ALL_EMAIL_NOTIFICATIONS:
        return

    recipients = _ops_recipients()
    if not recipients:
        return

    original = (original_recipient_email or "").strip().lower()
    safe_recipients = [r for r in recipients if r != original]
    if not safe_recipients:
        return

    try:
        provider = await get_email_provider(db, org_id=org_id)
        if provider:
            prefixed_subject = f"[COPIA OPS] {subject}"
            for recipient in safe_recipients:
                provider.send(recipient, prefixed_subject, body, html)
    except Exception as exc:  # pragma: no cover - non-critical side channel
        logger.warning("Ops email copy failed: %s", exc)

    telegram_payload = {
        "event": "notification_copy",
        "subject": subject,
        "recipient": original_recipient_email,
    }
    _send_telegram_message(f"[Innexar Alert] {json.dumps(telegram_payload)}")
