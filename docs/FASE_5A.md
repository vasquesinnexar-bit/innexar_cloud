# FASE 5A — Frontend premium + gaps funcionais + estabilidade

## Estabilidade (loops / 429)
- `apiPath` memoizado (`useCallback([orgFilter])`) em 20+ componentes Workspace/Portal.
- Polling pausado com `document.hidden` (nav 30s, notificações).
- Evidência: `DownstreamStatus 429` no Traefik = **0 em 15 min** (antes: rajadas contínuas).
- Rotas duplicadas `files/router_portal` removidas; paths `/billing/*` corrigidos.

## SMTP transacional (cutover)
- Backend apontava para provedor morto (`my.mailbux.com`, SMTP 550) → nenhum e-mail saía.
- Migrado para self-hosted: `mail.innexar.com.br:587`, `noreply@innexar.com.br`
  (senha vault mail-admin), TLS. Segredo só em `/srv/innexar/secrets/api.env` (0600);
  backup em `/srv/innexar/backups/smtp-cutover-2026-09-15/api.env.bak`.
- Sem override de SMTP no banco (`integration_configs` globais = só MP/Stripe) → env vence.
- Prova: `status=sent ... Saved` no INBOX de `admin@innexar.com.br` via `SMTPProvider`.

## CRUDs / gaps fechados
- E-mail: DELETE de mailbox (botão Excluir + `MAIL.DELETE`), senha/desabilitar/sync.
- Billing: página `/billing/policies` (novo nav), moeda dominante no resumo.
- Hosting: editor carrega conteúdo real; restore com confirm duplo; RBAC granular.
- Suporte: ticket cria mensagem inicial (schema aceita `message`);
  E2E: customer 201 → ticket 201 → message 201 → get 200 (1) → cleanup 204,
  + 2 e-mails de notificação entregues.
- Workspace: `/audit` (filtro q), `/notifications`, `/search` (latch `q>=2`),
  `GlobalSearch` + sino no header; testes `test_fase5_workspace.py` (5 passed).

## Design system
- Ver `DESIGN_SYSTEM.md` (tokens, componentes padrão, a11y, mobile).

## Pendente (Fase 5B)
- Editor fullscreen em telas pequenas; refunds UI; ações de contrato no Portal;
  expansão da suíte E2E; `website-us.env` ainda cita SMTP antigo (form de contato).
