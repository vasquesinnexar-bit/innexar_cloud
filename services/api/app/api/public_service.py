"""Public API service: customer login, checkout-login, forgot/reset password, web-to-lead."""

import secrets
import time
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import log_audit
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.email_templates import normalize_locale, password_reset_email
from app.core.security import (
    create_token_customer,
    decode_token_customer,
    hash_password,
    verify_password,
)
from app.models.customer_password_reset import CustomerPasswordResetToken
from app.models.customer_user import CustomerUser
from app.modules.crm.models import Contact
from app.repositories.contact_repository import ContactRepository
from app.repositories.customer_repository import CustomerRepository

if TYPE_CHECKING:
    from fastapi import BackgroundTasks

from app.core.org import ORG_INNEXAR_US

_WEBTOLEAD_RATE: dict[str, list[float]] = defaultdict(list)
_RATE_LIMIT_EMAIL = 5
_RATE_LIMIT_IP = 20
_RATE_WINDOW = 3600.0


def _rate_limit_check(key: str, limit: int) -> bool:
    """Return True if under limit (allow), False if over (reject)."""
    now = time.monotonic()
    _WEBTOLEAD_RATE[key] = [t for t in _WEBTOLEAD_RATE[key] if now - t < _RATE_WINDOW]
    if len(_WEBTOLEAD_RATE[key]) >= limit:
        return False
    _WEBTOLEAD_RATE[key].append(now)
    return True


async def _send_reset_email(
    recipient_email: str,
    reset_link: str,
    org_id: str,
    locale: str,
) -> None:
    """Send password reset email (new session for provider lookup)."""
    from app.providers.email.loader import get_email_provider

    async with AsyncSessionLocal() as db:
        provider = await get_email_provider(db, org_id=org_id)
        if provider:
            subject, body_plain, body_html = password_reset_email(
                reset_link=reset_link,
                locale=locale,
            )
            provider.send(recipient_email, subject, body_plain, body_html)


class PublicService:
    """Public routes: login, checkout-login, forgot/reset password, web-to-lead."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._customer = CustomerRepository(db)
        self._contact = ContactRepository(db)

    async def customer_login(
        self, email: str, password: str
    ) -> tuple[CustomerUser, str]:
        """Validate credentials and return (customer_user, token). Raises 401 if invalid."""
        cu = await self._customer.get_customer_user_by_email(email.lower())
        if cu is None or not verify_password(password, cu.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Email ou senha incorretos",
            )
        token = create_token_customer(cu.id)
        return (cu, token)

    async def checkout_login(self, token: str) -> tuple[CustomerUser, str]:
        """Exchange checkout_token for permanent token. Returns (customer_user, access_token). Raises 401 if invalid."""
        payload = decode_token_customer(token.strip())
        if not payload or payload.get("scope") != "checkout_auto_login":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido, expirado ou premissas incorretas.",
            )
        sub = payload.get("sub")
        if not sub:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido.",
            )
        cu = await self._customer.get_customer_user_by_id(int(sub))
        if cu is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Usuário não encontrado.",
            )
        access_token = create_token_customer(cu.id)
        return (cu, access_token)

    async def forgot_password(
        self,
        email: str,
        background_tasks: "BackgroundTasks",
        locale: str | None = None,
    ) -> None:
        """Create reset token and enqueue email. Always succeeds (no leak of existence)."""
        email_lower = email.lower().strip()
        cu = await self._customer.get_customer_user_by_email(email_lower)
        if cu:
            token = secrets.token_urlsafe(32)
            expires_at = datetime.now(UTC) + timedelta(hours=24)
            row = CustomerPasswordResetToken(
                customer_user_id=cu.id,
                token=token,
                expires_at=expires_at,
            )
            self._customer.add_password_reset_token(row)
            await self._db.flush()
            loc = normalize_locale(locale)
            base_url = str(
                getattr(settings, "PORTAL_URL", None)
                or getattr(settings, "FRONTEND_URL", "http://localhost:3000")
            ).rstrip("/")
            reset_link = f"{base_url}/{loc}/reset-password?token={token}"
            customer = await self._customer.get_by_id_with_users(cu.customer_id)
            org_id = customer.org_id if customer and customer.org_id else ORG_INNEXAR_US
            background_tasks.add_task(
                _send_reset_email, email_lower, reset_link, org_id, loc
            )

    async def reset_password(self, token: str, new_password: str) -> None:
        """Validate token, set new password, invalidate token. Raises 400 if invalid."""
        if not token.strip() or len(new_password) < 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Token and password (min 6 characters) required",
            )
        now = datetime.now(UTC)
        row = await self._customer.get_valid_reset_token(token.strip(), now)
        if not row:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset token",
            )
        cu = await self._customer.get_customer_user_by_id(row.customer_user_id)
        if not cu:
            await self._customer.delete_reset_token_by_id(row.id)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset token",
            )
        await self._customer.update_customer_user_password(
            cu.id, hash_password(new_password)
        )
        await self._customer.delete_reset_tokens_for_customer_user(cu.id)

    async def web_to_lead(
        self,
        name: str,
        email: str,
        phone: str | None,
        client_host: str,
        message: str | None = None,
        source: str | None = None,
        extra_data: dict | None = None,
        org_id: str = ORG_INNEXAR_US,
    ) -> int:
        """Create contact (lead). Rate limited by email and IP. Returns contact id."""
        from app.core.ops_notifications import send_ops_alert

        email_key = f"email:{email.lower().strip()}"
        ip_key = f"ip:{client_host}"
        if not _rate_limit_check(email_key, _RATE_LIMIT_EMAIL):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many submissions for this email",
            )
        if not _rate_limit_check(ip_key, _RATE_LIMIT_IP):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many submissions from this IP",
            )
        contact = Contact(
            org_id=org_id,
            customer_id=None,
            name=name,
            email=email,
            phone=phone,
            message=message,
            source=source or "website",
            status="new",
            extra_data=extra_data,
        )
        self._contact.add(contact)
        await self._db.flush()
        await log_audit(
            self._db,
            entity="contact",
            entity_id=str(contact.id),
            action="web_to_lead",
            actor_type="public",
            actor_id=client_host,
            org_id=org_id,
            payload={"message": message, "source": source, "extra_data": extra_data},
        )
        lead_source = source or "website"
        extra_lines = ""
        if extra_data:
            extra_lines = "\n".join(f"{k}: {v}" for k, v in extra_data.items() if v)
        from app.core.org import region_label_for_org

        region = region_label_for_org(org_id)
        body = (
            f"Novo lead #{contact.id}\n"
            f"Região: {region} ({org_id})\n"
            f"Nome: {name}\n"
            f"Email: {email}\n"
            f"Telefone: {phone or 'n/a'}\n"
            f"Origem: {lead_source}\n"
            f"Mensagem: {message or 'n/a'}\n"
        )
        if extra_lines:
            body += f"\nDetalhes:\n{extra_lines}\n"
        body += "\nVer no workspace: CRM > Leads"
        await send_ops_alert(
            self._db,
            subject=f"[Lead] {name} — {lead_source}",
            body=body,
            org_id=org_id,
        )
        return contact.id
