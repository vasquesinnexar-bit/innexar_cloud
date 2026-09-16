"""Provisioners (P0): handlers delegando aos mecanismos existentes.

Nenhum mecanismo foi reescrito aqui; cada handler coordena por cima do que já
existe (mail jobs, Hestia branch, project post-payment) e devolve resultado
máquina para a facade atualizar o Fulfillment.
"""

from __future__ import annotations

import logging

from sqlalchemy import select

from app.modules.fulfillment.enums import FulfillmentHandler
from app.modules.fulfillment.registry import (
    ProvisionContext,
    ProvisionResult,
    register,
)

logger = logging.getLogger(__name__)


class MailProvisioner:
    """E-mail: coordena MailProvisioningJob existente."""

    key = FulfillmentHandler.MAIL.value

    async def provision(self, ctx: ProvisionContext) -> ProvisionResult:

        from app.modules.mail.models import EmailDomain, MailProvisioningJob
        from app.modules.mail.provisioning import (
            trigger_mail_provisioning_if_needed,
        )

        inv_id = ctx.invoice.id if ctx.invoice is not None else None
        if inv_id is None:
            return ProvisionResult(
                ok=False,
                waiting_input="invoice",
                error="fulfillment sem invoice vinculada",
            )
        has_domain = (
            await ctx.db.execute(
                select(EmailDomain.id).where(
                    EmailDomain.customer_id == ctx.fulfillment.customer_id
                )
            )
        ).first()
        if not has_domain:
            return ProvisionResult(
                ok=False,
                waiting_input="domain",
                step="domain",
                progress=20,
                error="Pagamento confirmado. Precisamos do domínio que será "
                "usado no serviço.",
            )
        try:
            await trigger_mail_provisioning_if_needed(ctx.db, inv_id)
        except Exception as e:  # noqa: BLE001 (virará FAILED retryable)
            logger.exception("mail provisioner failed invoice %s", inv_id)
            return ProvisionResult(
                ok=False, retryable=True, error=str(e)[:500], step="mail_jobs"
            )
        rows = (
            (
                await ctx.db.execute(
                    select(MailProvisioningJob.status).where(
                        MailProvisioningJob.invoice_id == inv_id
                    )
                )
            )
            .scalars()
            .all()
        )
        if not rows:
            return ProvisionResult(
                ok=True, step="mail_jobs", progress=100, meta={"jobs": 0}
            )
        if any(s == "failed" for s in rows):
            return ProvisionResult(
                ok=False, retryable=True, error="mail job failed", step="mail_jobs"
            )
        if any(s in ("pending", "processing") for s in rows):
            return ProvisionResult(
                ok=False,
                retryable=True,
                step="mail_jobs",
                progress=50,
                error="mail jobs ainda processando",
            )
        return ProvisionResult(
            ok=True, step="mail_jobs", progress=100, meta={"jobs": len(rows)}
        )


class HestiaProvisioner:
    """Hestia: valida pré-requisitos ANTES; sem domain → WAITING_INPUT."""

    key = FulfillmentHandler.HESTIA.value

    async def provision(self, ctx: ProvisionContext) -> ProvisionResult:
        from app.modules.billing.provisioning import run_hestia_for_invoice

        inv_id = ctx.invoice.id if ctx.invoice is not None else None
        if inv_id is None:
            return ProvisionResult(
                ok=False,
                waiting_input="invoice",
                error="fulfillment sem invoice vinculada",
            )
        try:
            result = await run_hestia_for_invoice(ctx.db, inv_id)
        except Exception as e:  # noqa: BLE001
            logger.exception("hestia provisioner failed invoice %s", inv_id)
            return ProvisionResult(
                ok=False, retryable=True, error=str(e)[:500], step="hestia"
            )
        status = result.get("status")
        if status == "success":
            return ProvisionResult(
                ok=True, step="finalize", progress=100, meta=result.get("meta", {})
            )
        if status == "waiting_input":
            return ProvisionResult(
                ok=False,
                waiting_input=result.get("step") or "domain",
                error=result.get("message") or result.get("reason"),
                step=result.get("step"),
            )
        if status == "skipped":
            return ProvisionResult(
                ok=False,
                waiting_input="product",
                error="invoice sem produto hestia",
                step="validate",
            )
        return ProvisionResult(
            ok=False,
            retryable=bool(result.get("retryable")),
            error=(result.get("error") or "hestia failed")[:500],
            step=result.get("step") or "hestia",
        )


class ProjectProvisioner:
    """Projeto: cria idempotente; com projeto aguardando briefing → WAITING_INPUT."""

    key = FulfillmentHandler.PROJECT.value

    async def provision(self, ctx: ProvisionContext) -> ProvisionResult:
        from app.modules.billing.post_payment import (
            create_project_and_notify_after_payment,
        )
        from app.repositories.project_repository import ProjectRepository

        inv_id = ctx.invoice.id if ctx.invoice is not None else None
        if inv_id is None:
            return ProvisionResult(
                ok=False,
                waiting_input="invoice",
                error="fulfillment sem invoice vinculada",
            )
        try:
            await create_project_and_notify_after_payment(ctx.db, inv_id)
        except Exception as e:  # noqa: BLE001
            logger.exception("project provisioner failed invoice %s", inv_id)
            return ProvisionResult(
                ok=False, retryable=True, error=str(e)[:500], step="create_project"
            )
        sub_id = getattr(ctx.invoice, "subscription_id", None)
        project = None
        if sub_id:
            project = await ProjectRepository(ctx.db).get_by_subscription_id(sub_id)
        if project is None:
            return ProvisionResult(
                ok=False,
                waiting_input="product",
                error="produto não gerou projeto",
                step="create_project",
            )
        status = (getattr(project, "status", "") or "").lower()
        if status in ("aguardando_briefing", "aguardando briefing", "pending"):
            if ctx.fulfillment.project_id != project.id:
                ctx.fulfillment.project_id = project.id
                await ctx.db.flush()
            return ProvisionResult(
                ok=False,
                waiting_input="briefing",
                step="briefing",
                progress=70,
                error="Projeto criado. Aguardando briefing.",
                meta={"project_id": project.id},
            )
        return ProvisionResult(
            ok=True, step="project", progress=100, meta={"project_id": project.id}
        )


class ManualProvisioner:
    """Manual/guided: nada técnico a executar; humano acompanha."""

    key = FulfillmentHandler.MANUAL.value

    async def provision(self, ctx: ProvisionContext) -> ProvisionResult:
        strategy = (ctx.fulfillment.strategy or "manual").lower()
        if strategy == "guided":
            return ProvisionResult(
                ok=False,
                waiting_input="linking",
                step="linking",
                progress=20,
                error="Vinculação manual pendente (ex.: stack).",
            )
        return ProvisionResult(
            ok=False,
            waiting_input="manual_review",
            step="manual_review",
            progress=10,
            error="Acompanhamento manual necessário.",
        )


def register_all() -> None:
    for cls in (
        MailProvisioner,
        HestiaProvisioner,
        ProjectProvisioner,
        ManualProvisioner,
    ):
        register(cls.key, cls)
