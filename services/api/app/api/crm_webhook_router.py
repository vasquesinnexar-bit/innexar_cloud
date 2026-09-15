"""Evo CRM outbound webhook: sync leads and conversations into Workspace CRM."""

import hashlib
import hmac
import json
import logging
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.public_service import PublicService
from app.core.config import settings
from app.core.database import get_db
from app.core.org import ORG_INNEXAR_BR, ORG_INNEXAR_US

logger = logging.getLogger(__name__)

router = APIRouter()


class CrmWebhookResponse(BaseModel):
    ok: bool
    event: str
    lead_id: int | None = None


def _verify_signature(body: bytes, signature: str | None, secret: str) -> bool:
    if not signature or not secret:
        return False
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature.removeprefix("sha256="))


def _resolve_org(payload: dict[str, Any]) -> str:
    """Map CRM inbox/channel to Workspace org."""
    text = json.dumps(payload, default=str).lower()
    if any(k in text for k in ("innexar-br", "innexar.com.br", "comercial br")):
        return ORG_INNEXAR_BR
    if any(k in text for k in ("innexar.app", "innexar_us", "usa leads")):
        return ORG_INNEXAR_US
    inbox = payload.get("inbox") or {}
    name = str(inbox.get("name") or "").lower()
    if "br" in name or "comercial" in name:
        return ORG_INNEXAR_BR
    return ORG_INNEXAR_US


def _extract_contact(payload: dict[str, Any]) -> tuple[str, str, str | None]:
    contact = payload.get("contact") or payload.get("sender") or {}
    if not isinstance(contact, dict):
        contact = {}
    name = str(contact.get("name") or "Contato CRM").strip()
    email = str(contact.get("email") or "").strip().lower()
    phone = contact.get("phone_number") or contact.get("phone")
    phone_str = str(phone).strip() if phone else None
    return name, email, phone_str


def _build_message(payload: dict[str, Any], event: str) -> str:
    if event == "message_created":
        content = payload.get("content") or ""
        return str(content)[:4000]
    if event == "webwidget_triggered":
        info = payload.get("event_info") or {}
        return str(
            info.get("referer") or info.get("initiated_at") or "Chat widget aberto"
        )[:4000]
    if event.startswith("pipeline_item"):
        item = payload.get("pipeline_item") or payload
        title = item.get("title") or item.get("name") or "Pipeline item"
        return f"Evento pipeline: {title}"[:4000]
    if event.startswith("conversation"):
        conv = payload.get("conversation") or {}
        return f"Conversa CRM #{conv.get('id', 'n/a')}"[:4000]
    return f"Evento CRM: {event}"[:4000]


def _should_create_lead(event: str) -> bool:
    return event in {
        "contact_created",
        "webwidget_triggered",
        "conversation_created",
        "pipeline_item.created",
    }


@router.post("/crm-webhook", response_model=CrmWebhookResponse)
async def crm_webhook(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    x_crm_signature: str | None = Header(default=None, alias="X-CRM-Signature"),
) -> CrmWebhookResponse:
    """Receive Evo CRM account webhooks (conversations, contacts, pipeline)."""
    body = await request.body()
    secret = settings.CRM_WEBHOOK_SECRET or ""

    if (
        secret
        and x_crm_signature
        and not _verify_signature(body, x_crm_signature, secret)
    ):
        raise HTTPException(status_code=401, detail="Invalid CRM webhook signature")

    try:
        payload = json.loads(body) if body else {}
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON") from exc

    event = str(payload.get("event") or payload.get("type") or "unknown")
    logger.info("CRM webhook: event=%s keys=%s", event, list(payload.keys()))

    lead_id: int | None = None
    if _should_create_lead(event):
        name, email, phone = _extract_contact(payload)
        if email and "@" in email:
            org_id = _resolve_org(payload)
            service = PublicService(db)
            client_host = request.client.host if request.client else "evo-crm"
            try:
                lead_id = await service.web_to_lead(
                    name=name,
                    email=email,
                    phone=phone,
                    client_host=client_host,
                    message=_build_message(payload, event),
                    source=f"evo_crm:{event}",
                    extra_data={
                        "crm_event": event,
                        "crm_contact_id": (payload.get("contact") or {}).get("id"),
                        "crm_conversation_id": (payload.get("conversation") or {}).get(
                            "id"
                        ),
                    },
                    org_id=org_id,
                )
            except HTTPException as exc:
                if exc.status_code == 429:
                    logger.warning("CRM webhook rate limited for %s", email)
                else:
                    raise

    return CrmWebhookResponse(ok=True, event=event, lead_id=lead_id)
