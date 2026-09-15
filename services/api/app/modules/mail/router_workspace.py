"""Workspace mail endpoints: staff gerencia e-mail dos clientes (Fase 2)."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.rbac import RequirePermission
from app.models.user import User
from app.modules.billing.dependencies import require_billing_enabled
from app.modules.mail.router_portal import _http_error
from app.modules.mail.schemas import (
    DomainDNSResponse,
    DomainRegister,
    EmailDomainResponse,
    EntitlementResponse,
    MailboxCreate,
    MailboxPasswordChange,
    MailboxQuotaChange,
    MailboxResponse,
    SyncResponse,
)
from app.modules.mail.service import MailError, MailService, check_domain_dns

router = APIRouter()

READ = RequirePermission("billing:read")
WRITE = RequirePermission("billing:write")


def _actor(current: User) -> tuple[str, str]:
    return ("staff", str(current.id))


def _box_dict(svc: MailService, m) -> dict:
    usage = (svc.mailbox_usage().get((m.address or "").lower()) or {})
    return {"id": m.id, "address": m.address, "display_name": m.display_name,
            "quota": m.quota, "status": m.status, "created_at": m.created_at,
            "usage_used": usage.get("used"), "usage_pct": usage.get("pct"),
            "last_activity": None}


@router.post("/mail/domains", response_model=EmailDomainResponse, status_code=201)
async def register_domain(
    body: DomainRegister,
    customer_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(WRITE)],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
):
    from app.core.router_org import router_org_write

    svc = MailService(db)
    actor_type, actor_id = _actor(current)
    try:
        d = await svc.register_domain(
            customer_id=customer_id,
            org_id=router_org_write(current, org_id),
            domain=body.domain, contract_item_id=body.contract_item_id,
            actor_type=actor_type, actor_id=actor_id,
        )
    except MailError as e:
        raise _http_error(e)
    return {"id": d.id, "domain": d.domain, "status": d.status,
            "verified_at": d.verified_at}


@router.get("/mail/domains", response_model=list[EmailDomainResponse])
async def list_domains(
    customer_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(READ)],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
):
    """Domínios de e-mail do cliente (gerência; sem infra)."""
    from app.core.router_org import router_org_list_filter

    svc = MailService(db)
    org_filter = router_org_list_filter(org_id) or current.org_id
    return await svc.list_domains(customer_id, str(org_filter))


@router.get("/mail/domains/{domain}/dns", response_model=DomainDNSResponse)
async def domain_dns(
    domain: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(READ)],
    __: Annotated[None, Depends(require_billing_enabled)],
):
    """MX/SPF/DKIM/DMARC + registros esperados (leitura DNS pública)."""
    svc = MailService(db)
    result = check_domain_dns(domain)
    expected = svc.expected_dns_records(domain)
    return {"domain": result["domain"],
            "all_ok": result["checks"].pop("all_ok", False),
            "checks": result["checks"],
            "expected_records": expected["records"]}


@router.get("/mail/customers/{customer_id}/entitlement", response_model=EntitlementResponse)
async def entitlement(
    customer_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(READ)],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
    domain: str | None = None,
):
    from app.core.router_org import router_org_list_filter

    svc = MailService(db)
    org_filter = router_org_list_filter(org_id) or current.org_id
    return await svc.entitlement(customer_id, str(org_filter), domain)


@router.get("/mail/customers/{customer_id}/mailboxes", response_model=list[MailboxResponse])
async def list_boxes(
    customer_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(READ)],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
    domain: str | None = None,
):
    from app.core.router_org import router_org_list_filter

    svc = MailService(db)
    org_filter = router_org_list_filter(org_id) or current.org_id
    boxes = await svc.list_mailboxes(customer_id, str(org_filter), domain)
    return [_box_dict(svc, m) for m in boxes]


@router.post("/mail/customers/{customer_id}/mailboxes", response_model=MailboxResponse,
             status_code=201)
async def create_box(
    customer_id: int,
    body: MailboxCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(WRITE)],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
):
    from app.core.router_org import router_org_write

    svc = MailService(db)
    actor_type, actor_id = _actor(current)
    try:
        m = await svc.create_mailbox(
            customer_id=customer_id, org_id=router_org_write(current, org_id),
            domain=body.domain, local_part=body.local_part,
            display_name=body.display_name, password=body.password, quota=body.quota,
            actor_type=actor_type, actor_id=actor_id,
        )
    except MailError as e:
        raise _http_error(e)
    return _box_dict(svc, m)


@router.post("/mail/mailboxes/{mailbox_id}/password")
async def change_pw(
    mailbox_id: int,
    body: MailboxPasswordChange,
    customer_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(WRITE)],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
):
    from app.core.router_org import router_org_list_filter

    svc = MailService(db)
    actor_type, actor_id = _actor(current)
    try:
        await svc.change_password(
            mailbox_id=mailbox_id, customer_id=customer_id,
            org_id=router_org_list_filter(org_id) or current.org_id,
            password=body.password, actor_type=actor_type, actor_id=actor_id,
        )
    except MailError as e:
        raise _http_error(e)
    return {"ok": True}


@router.post("/mail/mailboxes/{mailbox_id}/quota")
async def set_quota(
    mailbox_id: int,
    body: MailboxQuotaChange,
    customer_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(WRITE)],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
):
    from app.core.router_org import router_org_list_filter

    svc = MailService(db)
    actor_type, actor_id = _actor(current)
    try:
        await svc.set_quota(
            mailbox_id=mailbox_id, customer_id=customer_id,
            org_id=router_org_list_filter(org_id) or current.org_id,
            quota=body.quota, actor_type=actor_type, actor_id=actor_id,
        )
    except MailError as e:
        raise _http_error(e)
    return {"ok": True}


@router.post("/mail/mailboxes/{mailbox_id}/disable")
async def disable_box(
    mailbox_id: int,
    customer_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(WRITE)],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
):
    from app.core.router_org import router_org_list_filter

    svc = MailService(db)
    actor_type, actor_id = _actor(current)
    try:
        await svc.set_disabled(
            mailbox_id=mailbox_id, customer_id=customer_id,
            org_id=router_org_list_filter(org_id) or current.org_id,
            disabled=True, actor_type=actor_type, actor_id=actor_id,
        )
    except MailError as e:
        raise _http_error(e)
    return {"ok": True}


@router.post("/mail/mailboxes/{mailbox_id}/enable")
async def enable_box(
    mailbox_id: int,
    customer_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(WRITE)],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
):
    from app.core.router_org import router_org_list_filter

    svc = MailService(db)
    actor_type, actor_id = _actor(current)
    try:
        await svc.set_disabled(
            mailbox_id=mailbox_id, customer_id=customer_id,
            org_id=router_org_list_filter(org_id) or current.org_id,
            disabled=False, actor_type=actor_type, actor_id=actor_id,
        )
    except MailError as e:
        raise _http_error(e)
    return {"ok": True}


@router.delete("/mail/mailboxes/{mailbox_id}")
async def delete_box(
    mailbox_id: int,
    customer_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(WRITE)],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
):
    from app.core.router_org import router_org_list_filter

    svc = MailService(db)
    actor_type, actor_id = _actor(current)
    try:
        await svc.delete_mailbox(
            mailbox_id=mailbox_id, customer_id=customer_id,
            org_id=router_org_list_filter(org_id) or current.org_id,
            actor_type=actor_type, actor_id=actor_id,
        )
    except MailError as e:
        raise _http_error(e)
    return {"ok": True}


@router.post("/mail/customers/{customer_id}/sync", response_model=SyncResponse)
async def sync_domain(
    customer_id: int,
    body: DomainRegister,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(WRITE)],
    __: Annotated[None, Depends(require_billing_enabled)],
    org_id: str | None = None,
):
    from app.core.router_org import router_org_write

    svc = MailService(db)
    actor_type, actor_id = _actor(current)
    try:
        rep = await svc.sync_domain(
            customer_id=customer_id, org_id=router_org_write(current, org_id),
            domain=body.domain, actor_type=actor_type, actor_id=actor_id,
        )
    except MailError as e:
        raise _http_error(e)
    return rep
