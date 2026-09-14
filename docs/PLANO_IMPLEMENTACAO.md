# PLANO DE IMPLEMENTAÇÃO — Portal multi-região + Mail integrado

Derivado de `IDEIA_PORTAL_WORKSPACE_MAIL.md` + `AUDIT_ECOSSISTEMA.md` (2026-09-14).
Ordem pensada para **zero downtime** e rollback simples. Nada abaixo foi executado.

## Fase 0 — Segurança da migração (antes de tudo)

1. Contar linhas por tabela nos DOIS bancos (`innexar-usa-workspace-postgres` e
   `innexar-brasil-2-0-db`): customers, users, invoices, subscriptions, payments.
   Se o BR tiver dados reais → mapear migração; se vazio → aposentadoria direta.
2. Resolver o conflito `api.innexar.com.br` (dois backends reivindicam): checar logs
   do Traefik (`RouterName`) e fixar UM router.
3. Backup dos dois bancos + volume `mail-admin-data`.

## Fase 1 — Modelo canônico (backend USA, aditivo, sem breaking)

1. `Customer`: + `country` (default por org), `locale`, `currency`,
   `billing_provider` (NULL = regra atual por moeda), `tax_id`, `company`.
2. Nova entidade `EmailService`: `customer_id, domain, plan_name, included_mailboxes`;
   `Mailbox`: `email, status, quota_used` (espelho do mailserver, sincronizado).
3. CRUD de `Product`/`PricePlan` no workspace (valores editáveis sem deploy —
   ex.: E-mail BR setup R$100 + R$25/conta/mês; US futuro).
4. Alembic migration + backfill (`innexar-br` → BRL/pt-BR, `innexar` → USD/en-US).

## Fase 2 — Portal: e-mail dentro de “Meus Serviços”

1. API no backend USA lendo o mailserver (contas por domínio, quota/uso via
   `setup email list` / doveadm; reutilizar lógica do mail-admin).
2. Ações: criar conta (respeitando `included_mailboxes`), reset de senha,
   status, botão webmail, guias celular/Outlook/Gmail (URLs já existem no
   `mobile_setup_for` do mail-admin).
3. Telas `[locale]/services/email`: domínio, plano, uso x/y, lista de contas,
   “contratar mais contas” → gera invoice (Fase 3).
4. Provisionamento no webhook de pagamento (ativar `EmailService` + criar caixas).

## Fase 3 — Billing BR completo + regra por cliente

1. `billing_provider` do cliente como override da regra BRL→MP / USD→Stripe.
2. PIX/boleto via Mercado Pago Bricks (provider já tem base) + recorrência
   (`preapproval_plan`) para assinaturas BR.
3. Fluxo BR fim-a-fim: workspace cria cliente+serviço → MP → portal PT → webhook →
   provisiona. Mesmo para US/Stripe (já existe; validar e2e).
4. Republicar DKIM limpo (“Sincronizar” em cada domínio no mail-admin).

## Fase 4 — Aposentar o legado

1. Migrar dados reais do BR (se houver — Fase 0) para o banco USA.
2. Remover routers `innexar-br20-portal` / `innexar-br20-api` (ou apontar para o USA),
   parar `innexar-brasil-2-0-{portal,backend,db}`; decidir site BR 2.0
   (manter front :3003 apontando p/ api3+portal, ou portar para repo USA).
3. Limpeza DNS: restos `mailbux` (SRV + mta-sts), `clinicatoufic.innexar.com.br`
   se órfão; cert mail com `mail.touficsleiman.com.br` (+autoconfig/autodiscover).

## Fase 5 — Endurecer e escalar

1. Redirects de compatibilidade (`/login` → `/pt/login` no Traefik para bookmarks).
2. Contratos/assinatura, 2FA, método de pagamento no portal (gaps do plano antigo).
3. Modelo pronto p/ 3º país: só `country/locale/currency/provider` novos.

## Pendências imediatas (fora do plano, 30 min)

- Criar caixas `@touficsleiman.com.br` no mailadmin (0 contas hoje).
- `mail.touficsleiman.com.br` no `mail.crt` (evitar aviso TLS no IMAP/SMTP).
- Confirmar com você antes de CADA fase (regra: auditoria → aprovação → execução).
