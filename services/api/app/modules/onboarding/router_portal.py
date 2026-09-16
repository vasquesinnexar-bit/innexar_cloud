"""Portal onboarding: resume, comandos, DNS, Cloudflare do cliente (P1.3).

Tudo scoped ao cliente logado (404 fora do escopo). Cliente nunca envia
status: só comandos. Segredos nunca retornam ao frontend.
"""

from typing import Annotated

import anyio
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth_customer import get_current_customer
from app.core.database import get_db
from app.models.customer_user import CustomerUser
from app.modules.onboarding import cloudflare_conn
from app.modules.onboarding import service as onboarding
from app.modules.onboarding.models import OnboardingSession
from app.modules.onboarding.schemas import (
    DnsApply,
    DnsConnect,
    OnboardingSessionResponse,
    StepSubmit,
)

router = APIRouter()


async def _own_session(
    db: AsyncSession, current: CustomerUser, session_id: int
) -> OnboardingSession:
    s = (
        await db.execute(
            select(OnboardingSession)
            .options(selectinload(OnboardingSession.steps))
            .where(
                OnboardingSession.id == session_id,
                OnboardingSession.customer_id == current.customer_id,
            )
        )
    ).scalar_one_or_none()
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Onboarding não encontrado")
    return s


async def _out(db: AsyncSession, s: OnboardingSession) -> dict:
    from app.modules.billing.models import Product

    product = await db.get(Product, s.product_id) if s.product_id else None
    return {
        "id": s.id,
        "customer_id": s.customer_id,
        "fulfillment_id": s.fulfillment_id,
        "product_name": product.name if product else None,
        "contract_id": None,
        "contract_item_id": s.contract_item_id,
        "type": s.type,
        "status": s.status,
        "current_step": s.current_step,
        "progress": s.progress,
        "last_error": s.last_error,
        "started_at": s.started_at,
        "completed_at": s.completed_at,
        "last_activity_at": s.last_activity_at,
        "created_at": s.created_at,
        "updated_at": s.updated_at,
        "steps": [
            {
                "step_key": st.step_key,
                "position": st.position,
                "required": st.required,
                "status": st.status,
                "data": st.data,
                "validation_error": st.validation_error,
                "completed_at": st.completed_at,
            }
            for st in sorted(s.steps, key=lambda x: x.position)
        ],
    }


@router.get("/onboarding/active", response_model=OnboardingSessionResponse)
async def resume_active(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[CustomerUser, Depends(get_current_customer)],
    type: str | None = None,
    fulfillment_id: int | None = None,
):
    """Retoma sessão ativa (refresh/logout-safe: estado vem do backend)."""
    s = await onboarding.get_active_session(
        db,
        customer_id=current.customer_id,
        fulfillment_id=fulfillment_id,
        type=type,
    )
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sem onboarding ativo")
    return await _out(db, s)


@router.get("/onboarding/{session_id}", response_model=OnboardingSessionResponse)
async def get_session(
    session_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[CustomerUser, Depends(get_current_customer)],
):
    return await _out(db, await _own_session(db, current, session_id))


@router.post(
    "/onboarding/{session_id}/submit/{step_key}",
    response_model=OnboardingSessionResponse,
)
async def submit_step(
    session_id: int,
    step_key: str,
    body: StepSubmit,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[CustomerUser, Depends(get_current_customer)],
):
    s = await _own_session(db, current, session_id)
    try:
        out = await onboarding.submit_step(
            db,
            s.id,
            step_key,
            body.data or {},
            actor_type="customer",
            actor_id=str(current.id),
        )
    except (LookupError, ValueError) as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(e)) from e
    await db.commit()
    return await _out(db, out)


@router.post(
    "/onboarding/{session_id}/verify", response_model=OnboardingSessionResponse
)
async def verify_now(
    session_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[CustomerUser, Depends(get_current_customer)],
):
    """Reverifica DNS agora (sem esperar o cron)."""
    from app.modules.onboarding.registry import get_handler

    s = await _own_session(db, current, session_id)
    handler = get_handler(s.type)
    if hasattr(handler, "_run_verification"):
        result = await handler._run_verification(db, s)  # noqa: SLF001
        steps = await onboarding._steps_map(db, s)  # noqa: SLF001
        step = steps.get("dns_verification")
        if step:
            from app.modules.onboarding.enums import OnboardingStepStatus

            if result.ok:
                step.status = OnboardingStepStatus.COMPLETED.value
                step.completed_at = onboarding.utc_now()
            else:
                step.status = OnboardingStepStatus.BLOCKED.value
                step.validation_error = (result.error or "")[:500]
            await db.flush()
            await onboarding._recompute(db, s)  # noqa: SLF001
            await onboarding.auto_advance(db, s)  # noqa: SLF001
            await onboarding.maybe_advance_fulfillment(
                db, s, False, actor_type="customer", actor_id=str(current.id)
            )
    await db.commit()
    return await _out(db, s)


@router.get("/onboarding/{session_id}/discovery")
async def dns_discovery(
    session_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[CustomerUser, Depends(get_current_customer)],
):
    """Descoberta DNS pública do domínio da sessão (leitura)."""
    from app.modules.onboarding import dns_discovery
    from app.modules.onboarding.handlers import ProfessionalEmailOnboarding

    s = await _own_session(db, current, session_id)
    handler = ProfessionalEmailOnboarding()
    domain = await handler._domain_from_steps(db, s)  # noqa: SLF001
    if not domain:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Domínio ainda não informado"
        )
    return dns_discovery.discover(domain)


@router.get("/onboarding/{session_id}/dns/records")
async def expected_records(
    session_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[CustomerUser, Depends(get_current_customer)],
):
    """Tabela Tipo/Nome/Valor/Status a partir do MailDNSProfile real."""
    from app.modules.mail.service import MailService
    from app.modules.onboarding import dns_discovery
    from app.modules.onboarding.handlers import ProfessionalEmailOnboarding

    s = await _own_session(db, current, session_id)
    handler = ProfessionalEmailOnboarding()
    domain = await handler._domain_from_steps(db, s)  # noqa: SLF001
    if not domain:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Domínio ainda não informado"
        )
    svc = MailService(db)
    expected = svc.expected_dns_records(domain)
    live = dns_discovery.discover(domain)
    return {"domain": domain, "expected": expected["records"], "live": live}


# -- Cloudflare do cliente -------------------------------------------------
class ZoneCreate(BaseModel):
    domain: str
    confirm: bool = False


@router.get("/dns/connection")
async def dns_connection(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[CustomerUser, Depends(get_current_customer)],
):
    return await cloudflare_conn.connection_status(db, current.customer_id)


@router.post("/dns/connect")
async def dns_connect(
    body: DnsConnect,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[CustomerUser, Depends(get_current_customer)],
):
    """Salva token CF do cliente (validado, criptografado, nunca reexibido)."""
    from app.models.customer import Customer

    cust = await db.get(Customer, current.customer_id)
    try:
        out = await cloudflare_conn.save_connection(
            db,
            customer_id=current.customer_id,
            org_id=cust.org_id if cust else "innexar",
            api_token=body.api_token,
            account_id=body.account_id,
            actor_type="customer",
            actor_id=str(current.id),
        )
    except ValueError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(e)) from e
    await db.commit()
    return out


@router.delete("/dns/connection")
async def dns_disconnect(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[CustomerUser, Depends(get_current_customer)],
):
    from app.models.customer import Customer

    cust = await db.get(Customer, current.customer_id)
    await cloudflare_conn.revoke_connection(
        db,
        customer_id=current.customer_id,
        org_id=cust.org_id if cust else "innexar",
        actor_type="customer",
        actor_id=str(current.id),
    )
    await db.commit()
    return {"connected": False}


@router.get("/dns/zones")
async def dns_zones(
    domain: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[CustomerUser, Depends(get_current_customer)],
):
    """Localiza zone na conta conectada (não cria)."""
    client, _cfg = await cloudflare_conn.get_customer_client(db, current.customer_id)
    if not client:
        raise HTTPException(status.HTTP_409_CONFLICT, "Cloudflare não conectado")
    try:
        zone = await anyio.to_thread.run_sync(client.get_zone_by_name, domain)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(e)[:200]) from e
    return {"zone": zone}


@router.post("/dns/zones")
async def dns_zone_create(
    body: ZoneCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[CustomerUser, Depends(get_current_customer)],
):
    """Cria zone SOMENTE com confirmação explícita; retorna nameservers."""
    if not body.confirm:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "Confirme a criação da zone (confirm=true)",
        )
    client, _cfg = await cloudflare_conn.get_customer_client(db, current.customer_id)
    if not client:
        raise HTTPException(status.HTTP_409_CONFLICT, "Cloudflare não conectado")
    domain = body.domain.strip().lower()
    try:
        existing = await anyio.to_thread.run_sync(client.get_zone_by_name, domain)
        if existing:
            return {"zone": existing, "created": False}
        zone = await anyio.to_thread.run_sync(client.create_zone, domain)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(e)[:200]) from e
    return {"zone": zone, "created": True}


@router.get("/onboarding/{session_id}/dns/preview")
async def dns_preview(
    session_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[CustomerUser, Depends(get_current_customer)],
):
    """Preview add/keep/conflicts antes de escrever (nunca escreve)."""
    from app.modules.mail.service import MailService
    from app.modules.onboarding import dns_apply
    from app.modules.onboarding.handlers import ProfessionalEmailOnboarding

    s = await _own_session(db, current, session_id)
    handler = ProfessionalEmailOnboarding()
    domain = await handler._domain_from_steps(db, s)  # noqa: SLF001
    if not domain:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Domínio ainda não informado"
        )
    client, _cfg = await cloudflare_conn.get_customer_client(db, current.customer_id)
    if not client:
        raise HTTPException(status.HTTP_409_CONFLICT, "Cloudflare não conectado")
    try:
        zone = await anyio.to_thread.run_sync(client.get_zone_by_name, domain)
        if not zone:
            return {
                "zone": None,
                "add": [],
                "keep": [],
                "conflicts": [],
                "message": "zone inexistente",
            }
        existing = await anyio.to_thread.run_sync(client.list_dns_records, zone["id"])
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(e)[:200]) from e
    svc = MailService(db)
    expected = svc.expected_dns_records(domain)
    dkim = dns_apply.normalize_dkim_txt(
        next(
            (
                r["value"]
                for r in expected["records"]
                if r["host"].startswith("mail._domainkey")
            ),
            None,
        )
    )
    desired = dns_apply.desired_records(domain, dkim)
    preview = dns_apply.build_preview(existing, desired, domain)
    return {"zone": {"id": zone["id"], "name": zone.get("name")}, **preview}


@router.post("/onboarding/{session_id}/dns/apply")
async def dns_apply(
    session_id: int,
    body: DnsApply,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[CustomerUser, Depends(get_current_customer)],
):
    """Aplica preview com snapshot + rollback (idempotente)."""
    from app.modules.mail.service import MailService
    from app.modules.onboarding import dns_apply as _apply
    from app.modules.onboarding.handlers import ProfessionalEmailOnboarding

    s = await _own_session(db, current, session_id)
    handler = ProfessionalEmailOnboarding()
    domain = await handler._domain_from_steps(db, s)  # noqa: SLF001
    if not domain:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Domínio ainda não informado"
        )
    client, _cfg = await cloudflare_conn.get_customer_client(db, current.customer_id)
    if not client:
        raise HTTPException(status.HTTP_409_CONFLICT, "Cloudflare não conectado")
    try:
        zone = await anyio.to_thread.run_sync(client.get_zone_by_name, domain)
        if not zone:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, "zone inexistente"
            )
        existing = await anyio.to_thread.run_sync(client.list_dns_records, zone["id"])
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(e)[:200]) from e
    svc = MailService(db)
    expected = svc.expected_dns_records(domain)
    dkim = _apply.normalize_dkim_txt(
        next(
            (
                r["value"]
                for r in expected["records"]
                if r["host"].startswith("mail._domainkey")
            ),
            None,
        )
    )
    desired = _apply.desired_records(domain, dkim)
    preview = _apply.build_preview(
        existing, desired, domain, confirmed_conflicts=body.confirmed_conflicts
    )
    if preview["conflicts"] and not body.confirmed_conflicts:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            {
                "code": "dns_conflicts",
                "message": "Há conflitos. Revise ou confirme explicitamente.",
                "conflicts": preview["conflicts"],
            },
        )
    snapshot = [
        {
            "id": e.get("id"),
            "type": e.get("type"),
            "name": e.get("name"),
            "content": e.get("content"),
        }
        for e in existing
    ]
    try:
        # filtra adds conflitantes não confirmados
        if preview["conflicts"]:
            blocked = {(c["type"], c["name"]) for c in preview["conflicts"]}
            preview = {
                **preview,
                "add": [
                    a for a in preview["add"] if (a["type"], a["name"]) not in blocked
                ],
            }
        result = await _apply.apply_preview(
            client, zone["id"], domain, preview, snapshot=snapshot
        )
    except RuntimeError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(e)[:300]) from e
    from app.core.audit import log_audit as _audit

    await _audit(
        db,
        entity="onboarding",
        entity_id=str(s.id),
        action="dns_changes_applied",
        actor_type="customer",
        actor_id=str(current.id),
        org_id=s.org_id,
        payload={"zone_id": zone["id"], "created": result["created"]},
    )
    await db.commit()
    return {**result, "zone_id": zone["id"]}


@router.get("/fulfillments/{fulfillment_id}/next-action")
async def fulfillment_next_action(
    fulfillment_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[CustomerUser, Depends(get_current_customer)],
):
    """Próxima ação de negócio (backend decide; frontend renderiza)."""
    from app.modules.fulfillment.models import Fulfillment
    from app.modules.onboarding.service import next_action_for_fulfillment

    f = await db.get(Fulfillment, fulfillment_id)
    if not f or f.customer_id != current.customer_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Fulfillment não encontrado")
    action = await next_action_for_fulfillment(db, f)
    return {"action": action}
