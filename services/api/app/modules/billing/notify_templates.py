"""Templates financeiros PT/EN (Fase 3). Chave → (titulo, corpo)."""

TEMPLATES: dict[str, dict[str, tuple[str, str]]] = {
    "invoice_created": {
        "pt-BR": (
            "Nova fatura #{id} — {total}",
            "Olá {name}, sua fatura #{id} de {total} vence em {due}.",
        ),
        "en-US": (
            "New invoice #{id} — {total}",
            "Hi {name}, your invoice #{id} of {total} is due {due}.",
        ),
    },
    "payment_pending": {
        "pt-BR": (
            "Pagamento pendente — fatura #{id}",
            "Sua cobrança de {total} está aguardando pagamento.",
        ),
        "en-US": (
            "Payment pending — invoice #{id}",
            "Your charge of {total} is awaiting payment.",
        ),
    },
    "payment_approved": {
        "pt-BR": (
            "Pagamento confirmado — fatura #{id}",
            "Recebemos {total}. Obrigado!",
        ),
        "en-US": (
            "Payment confirmed — invoice #{id}",
            "We received {total}. Thank you!",
        ),
    },
    "payment_failed": {
        "pt-BR": (
            "Falha no pagamento — fatura #{id}",
            "A tentativa de pagamento de {total} falhou. Tente novamente.",
        ),
        "en-US": (
            "Payment failed — invoice #{id}",
            "The payment attempt of {total} failed. Please retry.",
        ),
    },
    "invoice_due_soon": {
        "pt-BR": (
            "Fatura vence em {days} dias — #{id}",
            "{total} com vencimento em {due}.",
        ),
        "en-US": ("Invoice due in {days} days — #{id}", "{total} due {due}."),
    },
    "invoice_due_today": {
        "pt-BR": (
            "Fatura vence hoje — #{id}",
            "{total} vence hoje. Evite a suspensão do serviço.",
        ),
        "en-US": (
            "Invoice due today — #{id}",
            "{total} is due today. Avoid service suspension.",
        ),
    },
    "invoice_overdue": {
        "pt-BR": (
            "Fatura em atraso — #{id}",
            "{total} venceu em {due}. Regularize para manter seus serviços.",
        ),
        "en-US": (
            "Overdue invoice — #{id}",
            "{total} was due {due}. Pay to keep your services.",
        ),
    },
    "service_grace_period": {
        "pt-BR": (
            "Período de tolerância — {days} dias",
            "Sua fatura #{id} está em atraso. Serviços ativos por mais {days} dias.",
        ),
        "en-US": (
            "Grace period — {days} days",
            "Your invoice #{id} is overdue. Services stay on for {days} more days.",
        ),
    },
    "service_suspension_warning": {
        "pt-BR": (
            "Suspensão em {days} dias",
            "Sem pagamento, seus serviços serão suspensos em {days} dias.",
        ),
        "en-US": (
            "Suspension in {days} days",
            "Without payment, your services will be suspended in {days} days.",
        ),
    },
    "service_suspended": {
        "pt-BR": (
            "Serviços suspensos",
            "Por falta de pagamento, seus serviços foram suspensos. Pagando, reativamos automaticamente.",
        ),
        "en-US": (
            "Services suspended",
            "For overdue payment, your services were suspended. Paying reactivates automatically.",
        ),
    },
    "service_reactivated": {
        "pt-BR": (
            "Serviços reativados",
            "Pagamento confirmado! Seus serviços estão ativos novamente.",
        ),
        "en-US": (
            "Services reactivated",
            "Payment confirmed! Your services are active again.",
        ),
    },
    "subscription_cancelled": {
        "pt-BR": ("Assinatura cancelada", "Sua assinatura foi cancelada."),
        "en-US": ("Subscription cancelled", "Your subscription was cancelled."),
    },
    "hosting_suspended": {
        "pt-BR": (
            "Hospedagem suspensa",
            "Por falta de pagamento, sua hospedagem ({domain}) foi suspensa. Arquivos preservados — pagando, reativamos.",
        ),
        "en-US": (
            "Hosting suspended",
            "For overdue payment, your hosting ({domain}) was suspended. Files preserved — paying reactivates.",
        ),
    },
    "hosting_reactivated": {
        "pt-BR": (
            "Hospedagem reativada",
            "Pagamento confirmado! Sua hospedagem ({domain}) está no ar novamente.",
        ),
        "en-US": (
            "Hosting reactivated",
            "Payment confirmed! Your hosting ({domain}) is back online.",
        ),
    },
    "hosting_offline": {
        "pt-BR": (
            "Aplicação offline",
            "Sua aplicação ({domain}) está fora do ar. Nossa equipe foi avisada.",
        ),
        "en-US": (
            "Application offline",
            "Your application ({domain}) is down. Our team was notified.",
        ),
    },
    "backup_failed": {
        "pt-BR": (
            "Backup falhou",
            "O backup de {domain} falhou. Tentaremos novamente.",
        ),
        "en-US": ("Backup failed", "The backup of {domain} failed. We will retry."),
    },
    "backup_completed": {
        "pt-BR": ("Backup concluído", "Backup de {domain} concluído com sucesso."),
        "en-US": ("Backup completed", "Backup of {domain} completed successfully."),
    },
    "ssl_expiring": {
        "pt-BR": (
            "Certificado expirando",
            "O certificado de {domain} expira em {days} dias.",
        ),
        "en-US": (
            "Certificate expiring",
            "The certificate of {domain} expires in {days} days.",
        ),
    },
    "onboarding_started": {
        "pt-BR": (
            "Configuração iniciada",
            "Vamos configurar seu serviço passo a passo.",
        ),
        "en-US": (
            "Setup started",
            "Let's configure your service step by step.",
        ),
    },
    "onboarding_action_required": {
        "pt-BR": (
            "Ação necessária na configuração",
            "Falta uma informação sua para continuar: {step}.",
        ),
        "en-US": (
            "Setup action required",
            "We need one more thing from you to continue: {step}.",
        ),
    },
    "onboarding_dns_waiting": {
        "pt-BR": (
            "Aguardando propagação do DNS",
            "Assim que o DNS de {domain} estiver válido, continuamos sozinhos.",
        ),
        "en-US": (
            "Waiting for DNS propagation",
            "As soon as the DNS for {domain} is valid, we continue automatically.",
        ),
    },
    "onboarding_dns_verified": {
        "pt-BR": (
            "DNS verificado",
            "O DNS de {domain} está válido. Seguindo para a próxima etapa.",
        ),
        "en-US": (
            "DNS verified",
            "The DNS for {domain} is valid. Moving to the next step.",
        ),
    },
    "onboarding_service_ready": {
        "pt-BR": (
            "Serviço pronto",
            "Sua contratação está ativa e configurada.",
        ),
        "en-US": (
            "Service ready",
            "Your purchase is active and configured.",
        ),
    },
    "onboarding_failed": {
        "pt-BR": (
            "Configuração precisa de atenção",
            "Não conseguimos concluir automaticamente: {error}",
        ),
        "en-US": (
            "Setup needs attention",
            "We could not finish automatically: {error}",
        ),
    },
}

SUPPORTED = tuple(TEMPLATES)


def render(key: str, locale: str, **kwargs: object) -> tuple[str, str]:
    """(titulo, corpo) no idioma (fallback en-US). Chaves extras ignoradas com segurança."""
    loc = locale if locale in ("pt-BR", "en-US") else "en-US"
    title, body = TEMPLATES[key][loc]
    safe = dict(kwargs)
    try:
        return title.format(**safe), body.format(**safe)
    except (KeyError, IndexError, ValueError):
        return title, body
