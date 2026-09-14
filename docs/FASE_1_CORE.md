# FASE 1 — CORE centralizado (concluída em 2026-09-14)

## Models alterados (backend USA, `innexar-workspace/backend`)

- `Customer` (+6, todos opcionais): `company`, `country` (ISO alpha-2),
  `locale` (`pt-BR`/`en-US`/`es`), `currency` (ISO-4217), `billing_provider`
  (`stripe`|`mercadopago`, NULL = fallback), `tax_id`. Sem campo duplicado —
  não existia equivalente.
- `Product` (+2): `category` (website|hosting|email|domain…), `slug` (único,
  ex. `professional-email`).
- `PricePlan` (+3): `billing_type` (`recurring` default|`one_time`), `unit`
  (`mailbox`|…), `provider` (override NULL = resolver).
- `Subscription` (+1): `currency` NULL = PricePlan/Invoice (permite contratos
  multimoeda no futuro).
- **Novos**: `billing_contracts` + `billing_contract_items` (o vendido;
  `Service` provisionado fica p/ Fase 2). Status `ContractStatus`:
  pending/active/past_due/grace_period/suspended/cancelled. Delete de Customer
  apaga contratos em cascata (mesmo padrão de users/contacts/projects/tickets).
- `Membership` separada: NÃO criada — `CustomerUser.customer_id` já cumpre o papel.

## Migration

- `alembic/versions/n1o2p3q4r5s6_fase1_core_customer_contract.py`
  (down `m0n1o2p3q4r5`, DDL idempotente). Backup prévio:
  `/srv/innexar/backups/fase1-core/2026-09-14/pre-migration.dump`.
- Backfill por org (só NULL): `innexar-br` → BR/pt-BR/BRL; demais → US/en-US/USD.
  4 customers existentes viraram US/en-US/USD.

## APIs

- Workspace Customers (CRUD existente): `CustomerCreate/Update/Response` com os 6
  campos + validação; create aplica defaults regionais por org.
- **Novo** `/api/workspace/billing/contracts` (GET/POST/GET{id}/PATCH{id}/
  POST{id}/items): herda `currency` do customer, itens com snapshot de preço.
- Portal: `GET/PATCH /me/profile` expõe `company/country/locale/currency`
  (billing_provider NUNCA editável pelo cliente); `GET /me` inalterado.
- OpenAPI comprova rotas e schemas em produção.

## UI Workspace (`customers/[id]`)

Seção Empresa/País/Idioma/Moeda/Billing/Doc fiscal (exibição + edição),
`billing_provider` com opção “Auto (pela moeda)” = NULL.

## Billing (sem reimplementar)

- `resolve_provider_name(explícito, currency)`: explícito válido vence;
  NULL → BRL→MP / demais→Stripe (comportamento legado intacto).
- `get_payment_provider(..., billing_provider=None)`: consulta
  `Customer.billing_provider` quando o chamador não passa override — propaga
  para invoice/pay/checkout/recorrência sem tocar nos callers nem nos webhooks.
- Webhooks Stripe/MP + idempotência: intocados e ainda registrados.
- `resolve_public_org` por host continua existindo, mas só para checkout/catálogo
  público (preferência de interface) — regra financeira é por cliente/contrato.

## Compatibilidade

Additive-only no banco; defaults/backfill seguros; nenhum status existente alterado
(mapeados: Invoice draft/issued/pending/paid/failed/canceled/expired;
Subscription inactive/active/overdue/suspended/canceled). Deploys: rebuild das
3 imagens (backend, workspace-app, portal) + recreate; efeito colateral positivo:
fallback 5xx do portal (maintenance) voltou a rodar.

## Testes

- Novos (10, verdes): `test_provider_resolution.py` (6) + `test_fase1_core.py`
  (defaults BR/US, validação, CRUD de contracts) — sqlite em memória.
- E2E ao vivo (com limpeza total após): create BR→BR/BRL, create US+stripe,
  contract herdando BRL com 2 itens, patch BR→stripe, resolver, cascade delete.
- Bateria: 5 URLs + api3/health + api/docs + webmail + mailadmin OK; login
  inválido 401.
- Suíte `tests/unit` tem vermelho PRÉ-EXISTENTE (38 falhas no HEAD puro por drift
  testes-vs-código, ex. testes chamando `create_customer` sem `org_id`, bug
  `get_by_id` em `public_service.py`). Prova por baseline com/sem mudanças:
  nenhuma falha nova atribuível aos hunks da Fase 1; 9 deltas explicados por drift
  (assinaturas intactas, erros em paths não tocados).

## Decisões arquiteturais

1. Sem `Organization` nova: `org_id` string (`innexar`/`innexar-br`) já é o tenant.
2. Moeda mora em Customer (default) → Subscription/Contract (override) →
   Invoice (verdade por cobrança); PricePlan tem a sua.
3. `billing_provider` NULL em todos os níveis = fallback legado (migração sem ruptura).
4. Seeds BR (`seed_products_brazil.py`) e produto E-mail **não** executados/criados
   aqui — catálogo editável existe via API; seed do “Professional Email” vai na Fase 2.

## Problemas encontrados (não causados pela Fase 1)

- Suíte unit vermelha prévia (documentado acima).
- `prospector-ai` e `navaro` em branches não-main (já registrado no mapa).
- PAT do navaro: credencial removida do disco (remote → SSH); **falta REVOGAR no GitHub**.

## Recomendação Fase 2 (ordem exata)

1. Criar produto `professional-email` + prices BR (setup 100 + 25/conta/mês) via API.
2. API backend: leitura do mailserver (contas/quota por domínio) + criar conta +
   reset de senha (reusar lógica do mail-admin).
3. Tela `[locale]/services/email` no portal (domínio, plano, uso x/y, ações).
4. Provisionar no webhook de pagamento (ativar EmailService + criar caixas).
5. Caixas `@touficsleiman.com.br` + `mail.crt` com o domínio (pendências em aberto).
