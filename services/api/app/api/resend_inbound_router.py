"""Resend inbound email webhook: create lead from emails to sales@innexar.app."""

import json
import logging
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.public_service import PublicService
from app.core.database import get_db
from app.core.org import ORG_INNEXAR_BR, ORG_INNEXAR_US

logger = logging.getLogger(__name__)

router = APIRouter()


class InboundEmailResponse(BaseModel):
    ok: bool
    lead_id: int | None = None


def _extract_sender(data: dict[str, Any]) -> tuple[str, str]:
    from_field = data.get("from") or data.get("sender") or ""
    if isinstance(from_field, dict):
        email = from_field.get("email") or ""
        name = from_field.get("name") or email.split("@")[0]
        return name, email
    if isinstance(from_field, str) and "@" in from_field:
        if "<" in from_field:
            name = from_field.split("<")[0].strip().strip('"')
            email = from_field.split("<")[1].split(">")[0].strip()
            return name or email.split("@")[0], email
        return from_field.split("@")[0], from_field
    return "Desconhecido", "unknown@inbound.local"


def _resolve_inbound_org(to_addr: str) -> str:
    lower = to_addr.lower()
    if "innexar.com.br" in lower or "comercial@" in lower:
        return ORG_INNEXAR_BR
    return ORG_INNEXAR_US


@router.post("/webhooks/resend-inbound", response_model=InboundEmailResponse)
async def resend_inbound_webhook(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> InboundEmailResponse:
    """Handle Resend inbound emails (email.received). Creates a lead + ops notification."""
    body = await request.body()
    try:
        payload = json.loads(body)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON") from exc

    event_type = payload.get("type") or payload.get("event")
    if event_type != "email.received":
        return InboundEmailResponse(ok=True, lead_id=None)

    data = payload.get("data") or payload
    subject = str(data.get("subject") or "Email recebido")
    text_body = str(data.get("text") or data.get("body") or "")
    to_list = data.get("to") or []
    to_addr = ", ".join(to_list) if isinstance(to_list, list) else str(to_list)
    name, email = _extract_sender(data)

    service = PublicService(db)
    client_host = request.client.host if request.client else "resend-inbound"
    org_id = _resolve_inbound_org(to_addr)
    lead_id = await service.web_to_lead(
        name=name,
        email=email,
        phone=None,
        client_host=client_host,
        message=f"Assunto: {subject}\n\n{text_body[:4000]}",
        source="inbound_email",
        extra_data={
            "subject": subject,
            "to": to_addr,
            "inbound": True,
            "country": "BR" if org_id == ORG_INNEXAR_BR else "US",
        },
        org_id=org_id,
    )
    logger.info("Inbound email lead created: id=%s from=%s", lead_id, email)
    return InboundEmailResponse(ok=True, lead_id=lead_id)
