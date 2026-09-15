"""Portal mail endpoints: customer-scoped Professional Email (Fase 2)."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_customer import get_current_customer
from app.core.database import get_db
from app.models.customer import Customer
from app.models.customer_user import CustomerUser
from app.modules.mail.schemas import (
    DomainDNSResponse,
    EmailDomainResponse,
    EntitlementResponse,
    MailboxCreate,
    MailboxPasswordChange,
    MailboxQuotaChange,
    MailboxResponse,
    ServiceSummaryResponse,
    SyncResponse,
    UpgradeRequestResponse,
)
from app.modules.mail.service import MailError, MailService

router = APIRouter()


def _http_error(e: MailError) -> HTTPException:
    mapping = {
        "unauthorized_mailbox_access": status.HTTP_404_NOT_FOUND,
        "mailbox_not_found": status.HTTP_404_NOT_FOUND,
        "email_domain_not_configured": status.HTTP_422_UNPROCESSABLE_CONTENT,
        "mailbox_exists": status.HTTP_409_CONFLICT,
        "mailbox_limit_reached": status.HTTP_409_CONFLICT,
        "mail_provider_unavailable": status.HTTP_503_SERVICE_UNAVAILABLE,
        "mail_provisioning_failed": status.HTTP_502_BAD_GATEWAY,
        "invalid_email_password": status.HTTP_422_UNPROCESSABLE_CONTENT,
    }
    return HTTPException(
        mapping.get(e.code, status.HTTP_422_UNPROCESSABLE_CONTENT),
        detail={"code": e.code, "message": e.detail, "extra": e.extra},
    )


async def _ctx(
    db: AsyncSession, current: CustomerUser
) -> tuple[MailService, int, str]:
    cust = (
        await db.execute(select(Customer).where(Customer.id == current.customer_id))
    ).scalar_one_or_none()
    if not cust:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Customer não encontrado")
    return MailService(db), cust.id, str(cust.org_id)


def _box_dict(svc: MailService, m) -> dict:
    usage = (svc.mailbox_usage().get((m.address or "").lower()) or {})
    return {"id": m.id, "address": m.address, "display_name": m.display_name,
            "quota": m.quota, "status": m.status, "created_at": m.created_at,
            "usage_used": usage.get("used"), "usage_pct": usage.get("pct"),
            "last_activity": None}


@router.get("/services/email/domains", response_model=list[EmailDomainResponse])
async def list_own_domains(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[CustomerUser, Depends(get_current_customer)],
):
    """Somente os domínios do próprio cliente (sem infra)."""
    svc, customer_id, org_id = await _ctx(db, current)
    return await svc.list_domains(customer_id, org_id)


@router.get("/services/email/domains/{domain}/dns", response_model=DomainDNSResponse)
async def own_domain_dns(
    domain: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[CustomerUser, Depends(get_current_customer)],
):
    """DNS do próprio domínio (onboarding; sem infra)."""
    from app.modules.mail.service import check_domain_dns

    svc, customer_id, org_id = await _ctx(db, current)
    own = {d.domain for d in await svc.list_domains(customer_id, org_id)}
    if domain.strip().lower() not in own:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Domínio não encontrado")
    result = check_domain_dns(domain)
    expected = svc.expected_dns_records(domain)
    return {"domain": result["domain"],
            "all_ok": result["checks"].pop("all_ok", False),
            "checks": result["checks"],
            "expected_records": expected["records"]}


@router.get("/services/email", response_model=ServiceSummaryResponse)
async def email_overview(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[CustomerUser, Depends(get_current_customer)],
    domain: str | None = None,
):
    svc, customer_id, org_id = await _ctx(db, current)
    try:
        domains = await svc.list_domains(customer_id, org_id)
        dom = None
        if domain:
            dom = next((d for d in domains if d.domain == domain.strip().lower()), None)
            if not dom:
                raise MailError("email_domain_not_configured", "Domínio não configurado")
        else:
            dom = domains[0] if domains else None
        ent = await svc.entitlement(customer_id, org_id, dom.domain if dom else None)
        boxes = await svc.list_mailboxes(
            customer_id, org_id, dom.domain if dom else None
        )
        return {
            "domain": dom.domain if dom else None,
            "status": dom.status if dom else "pending",
            "entitlement": ent,
            "mailboxes": [_box_dict(svc, m) for m in boxes],
        }
    except MailError as e:
        raise _http_error(e)


@router.get("/services/email/mailboxes", response_model=list[MailboxResponse])
async def list_boxes(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[CustomerUser, Depends(get_current_customer)],
    domain: str | None = None,
):
    svc, customer_id, org_id = await _ctx(db, current)
    boxes = await svc.list_mailboxes(customer_id, org_id, domain)
    return [_box_dict(svc, m) for m in boxes]


@router.post("/services/email/mailboxes", response_model=MailboxResponse, status_code=201)
async def create_box(
    body: MailboxCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[CustomerUser, Depends(get_current_customer)],
):
    svc, customer_id, org_id = await _ctx(db, current)
    try:
        m = await svc.create_mailbox(
            customer_id=customer_id, org_id=org_id, domain=body.domain,
            local_part=body.local_part, display_name=body.display_name,
            password=body.password, quota=body.quota,
            actor_type="customer", actor_id=str(current.id),
        )
    except MailError as e:
        raise _http_error(e)
    return _box_dict(svc, m)


@router.post("/services/email/mailboxes/request", status_code=201)
async def request_box(
    body: MailboxCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[CustomerUser, Depends(get_current_customer)],
):
    """Solicitar conta adicional: dentro do plano cria direto; além do plano
    gera ContractItem + Invoice (pagamento via fluxo normal; provisiona no webhook)."""
    svc, customer_id, org_id = await _ctx(db, current)
    try:
        return await svc.request_additional_mailbox(
            customer_id=customer_id, org_id=org_id, domain=body.domain,
            local_part=body.local_part, display_name=body.display_name,
            password=body.password, quota=body.quota,
            actor_type="customer", actor_id=str(current.id),
        )
    except MailError as e:
        raise _http_error(e)


@router.post("/services/email/mailboxes/{mailbox_id}/password")
async def change_pw(
    mailbox_id: int,
    body: MailboxPasswordChange,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[CustomerUser, Depends(get_current_customer)],
):
    svc, customer_id, org_id = await _ctx(db, current)
    try:
        await svc.change_password(
            mailbox_id=mailbox_id, customer_id=customer_id, org_id=org_id,
            password=body.password, actor_type="customer", actor_id=str(current.id),
        )
    except MailError as e:
        raise _http_error(e)
    return {"ok": True}


@router.post("/services/email/mailboxes/{mailbox_id}/disable")
async def disable_box(
    mailbox_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[CustomerUser, Depends(get_current_customer)],
):
    svc, customer_id, org_id = await _ctx(db, current)
    try:
        await svc.set_disabled(
            mailbox_id=mailbox_id, customer_id=customer_id, org_id=org_id,
            disabled=True, actor_type="customer", actor_id=str(current.id),
        )
    except MailError as e:
        raise _http_error(e)
    return {"ok": True}


@router.post("/services/email/mailboxes/{mailbox_id}/enable")
async def enable_box(
    mailbox_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[CustomerUser, Depends(get_current_customer)],
):
    svc, customer_id, org_id = await _ctx(db, current)
    try:
        await svc.set_disabled(
            mailbox_id=mailbox_id, customer_id=customer_id, org_id=org_id,
            disabled=False, actor_type="customer", actor_id=str(current.id),
        )
    except MailError as e:
        raise _http_error(e)
    return {"ok": True}


@router.get("/services/email/upgrade", response_model=UpgradeRequestResponse)
async def upgrade_info(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[CustomerUser, Depends(get_current_customer)],
):
    """Informa plano/uso/preço da conta adicional (sem cobrar ainda)."""
    svc, customer_id, org_id = await _ctx(db, current)
    ent = await svc.entitlement(customer_id, org_id)
    unit = f"R${ent['unit_price']:.0f}/mês" if ent["unit_price"] else "a combinar"
    return {
        "contracted": ent["contracted"],
        "used": ent["used"],
        "currency": ent["currency"],
        "unit_price": ent["unit_price"],
        "message": (
            f"Plano contratado: {ent['contracted']} contas. Em uso: {ent['used']}. "
            f"Conta adicional: {unit}."
        ),
    }
