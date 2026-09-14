# INNEXAR ECOSYSTEM AUDIT — 2026-09-14

Auditoria read-only da infraestrutura real. Nada foi alterado para produzir este
documento. Substitui as premissas do `PLANO_PORTAL_WORKSPACE.md` (desatualizado:
descreve portal separado e workspace dentro do website — não é mais assim).

## Resposta direta às perguntas centrais

- `panel.innexar.app` e `portal.innexar.com.br` são **o MESMO projeto, MESMO deploy,
  MESMO backend, MESMO banco, MESMA autenticação** (Next.js `innexar-usa/innexar-portal`,
  container `innexar-usa-portal`). Idioma por rota (`/pt/login`, `/en/login`).
- Existe um **segundo portal legado** (`portal-cliente`, Vite SPA, repo `innexar-br-2.0`,
  backend próprio, banco próprio) que **reivindica o mesmo host mas recebe ZERO
  tráfego** (sombreado pela regra mais longa do Traefik).
- Idem para backends/API e bancos: stack USA viva, stack BR legada viva-porém-sombreada.

## 1. WORKSPACE — https://workspace.innexar.app/ (307 → redirect de locale)

- Projeto: `/srv/innexar/production/innexar-usa/innexar-workspace-app` (Next 16.0.1,
  React 19, next-intl pt/en/es default pt)
- Container: `innexar-usa-workspace-app` :3000 (imagem `innexar-usa-innexar-workspace-app`)
- Backend: `/srv/innexar/production/innexar-usa/innexar-workspace/backend`
  (FastAPI, SQLAlchemy async, Alembic) → container `innexar-usa-workspace-backend`
  :8000, hosts `api3.innexar.app` (+ `api.innexar.com.br`, em conflito — ver §9)
- Banco: container `innexar-usa-workspace-postgres`, database `innexar_workspace`
- Auth: JWT duplo HS256 (`staff`/`customer`, secrets distintos) + bcrypt;
  staff `POST /api/workspace/auth/staff/login`, customer `POST /api/public/auth/customer/login`
- Repo: `git@github-innexar:innexar-plat/innexar-usa.git`, branch `main`

## 2. PORTAL BRASIL — https://portal.innexar.com.br/pt/login (200)

- **Servido por**: `innexar-usa-portal` :3000 (router Traefik `usa-portal`, provado nos
  logs: 647/688 hits recentes com `RouterName usa-portal@docker`, paths `/_next/…`,
  `/pt/login`). Projeto `/srv/innexar/production/innexar-usa/innexar-portal`
  (Next 16, next-intl pt/en/es). Auth `customer_token` (localStorage) → `api3.innexar.app`.
- Projeto legado sombreado: `.../innexar-brasil/ineexar-brasil-2.0/innexar-br-2.0`
  (`portal-cliente-innexarbr/`, Vite 6 + React Router, PT-only, token `access_token`,
  backend próprio `/api` → `innexar-brasil-2-0-backend:8000`), container
  `innexar-brasil-2-0-portal` :80, router `innexar-br20-portal`. **0 hits no Traefik.**

## 3. PORTAL EUA — https://panel.innexar.app/en/login (200)

- Mesmo container/projeto do §2 (`Host(panel.innexar.app) || Host(portal.innexar.com.br)`
  na mesma regra). **É o mesmo projeto do Brasil? SIM.** Compartilha backend (api3),
  banco (usa-workspace-postgres), auth (customer JWT) e modelo de dados.

## 4. SITE BRASIL — https://innexar.com.br/ (200)

- Projeto: `.../innexar-brasil/ineexar-brasil-2.0/innexar-br-2.0/innexar-br-website`
  (Next 16.1.7, **sem i18n, pt-BR único**), container `innexar-brasil-2-0-website` :3003
- Checkout próprio → redireciona para `portal.innexar.com.br/pt/login?checkout=success&token=…`;
  planos ex.: Site Essencial R$299/mês. E-mail/hospedagem só como feature inclusa.

## 5. SITE EUA — https://innexar.app/en (200)

- Projeto: `/srv/innexar/production/innexar-usa/innexar-website` (Next 16, next-intl
  en default), container `innexar-usa-website` :3000. CTAs → `panel.innexar.app`,
  checkout → `api3.innexar.app`. Mesmo repo `innexar-usa.git`.

## 6. MAIL SERVER — 173.212.248.236

- Software: `ghcr.io/docker-mailserver/docker-mailserver` (SMTP 25/465/587, IMAP 993),
  `innexar-mailserver` healthy; Roundcube `webmail.innexar.*`; painel Flask
  `mailadmin.innexar.*` (com token CF por domínio desde 2026-09-14); autoconfig/autodiscover.
- Domínios com DKIM+contas: `innexar.app`, `innexar.com.br`, `precisionia.com.br`,
  `touficsleiman.com.br` (DNS completo desde 2026-09-14; sem caixas criadas ainda).
- Limites: cert `mail.crt` cobre só domínios innexar; sem API pública (opera via
  `docker exec setup` + volume). Sem modelo de produto/cobrança de e-mail.

## 7. BILLING

- **Stripe**: funcional no backend USA (`checkout.Session`, promotion codes, billing
  portal, `contract_months` metadata). **Mercado Pago**: funcional (Checkout Pro,
  `preapproval_plan`, Bricks card/pix-ticket, `handle_webhook`).
- **Roteamento por moeda** (não por domínio — como a ideia pede):
  `billing/invoice_ops.py` `BRL→mercadopago`, `USD→stripe`.
- Webhooks com verificação de assinatura + idempotência (`WebhookEvent`).
  Endpoints portal: faturas, pagar, download, link do portal Stripe.
- **Mercado Pago recorrente**: `preapproval_plan` implementado; **PIX/boleto dedicado:
  inexistente** (só via Checkout Pro/Bricks). **BR legado**: config Stripe+MP existe,
  webhooks expostos com verificação, mas camada de serviço é **in-memory**
  (não persiste) — não usar como base.
- Multi-tenant: `org_id` string (`innexar` / `innexar-br`), `default_currency_for_org()`
  BRL/USD. **Sem** `billing_provider` por cliente (derivado da moeda da invoice).

## 8. MODELO DE CLIENTES (backend USA — o canônico)

- `Customer`: id, org_id, name, email, phone, address(JSON), mp_customer_id.
  **Sem** country/locale/currency/billing_provider/tax.
- `User` (staff), `CustomerUser` (login do cliente). **Sem** Organization/Contract/Service.
- `Product` (sem currency) → `PricePlan` (amount, currency default **USD**, interval) →
  `Subscription` (status, datas, external_id) → `Invoice` (total, currency default USD,
  line_items JSON) → `PaymentAttempt` (provider, payment_url, status).
- BR legado: `CustomerModel` com `address_country` (default BR) + `document`;
  `ProductModel`/`InvoiceModel` BRL; `PaymentModel.provider` (default stripe).
  Modelos separados, banco separado — **divergência a unificar**.

## 9. PROBLEMAS

1. **Duplicação viva**: portal+backend+banco BR legados rodando (custo, confusão,
   risco de alguém apontar tráfego para eles). `api.innexar.com.br` é reivindicado
   pelos DOIS backends (regras de mesmo tamanho — vencedor indefinido; verificar
   antes de tocar).
2. **Dois bancos `innexar_workspace`** (servidores distintos) + dois esquemas de auth
   (`customer_token` vs `access_token`) + dois contratos de API (`/api/*` vs `/v1/*`).
3. **Sem `billing_provider`/country/locale por cliente**; sem Organization/Contract;
   sem produto “E-mail Profissional” (plano, nº contas, uso) — cobrança de e-mail
   hoje seria manual.
4. **Mail**: cert sem `mail.touficsleiman.com.br` (aviso TLS em clientes IMAP/SMTP);
   sem integração portal↔mail (criar senha/conta, quota, uso).
5. **DNS**: restos `mailbux` (MX removido pelo painel, mas SRV `_imap/_pop3/_caldav/_carddav/_jmap`
   + `mta-sts` ainda apontam `my.mailbux.com`); DKIM publicado com sufixo-lixo
   (`...IDAQAB);-----DKIMkey...`) — corrigido no código em 2026-09-14, republicar via
   “Sincronizar” em cada domínio.
6. Sites: BR sem link de portal no header; sem página de preços de e-mail/hospedagem
   avulsos; funis de checkout dos sites gravam em APIs distintas (site BR usa api3 —
   ok; checkout legado `/v1` existe no backend sombreado).

## 10. ARQUITETURA RECOMENDADA (baseada no que existe)

- **Core = stack USA** (única com billing funcional + webhooks idempotentes + i18n).
  Estender modelos (aditivo, sem breaking): `Customer.country/locale/currency/
  billing_provider/tax_id`, `Organization` (opcional fase 2), `Contract` ou
  `Subscription.metadata`, entidade `EmailService` (domínio, plano, contas incluídas)
  + `Mailbox` (uso real lido do mailserver).
- **Portais**: manter **um** frontend (o USA, que já atende os dois hosts); aposentar
  o Vite legado após migração de dados (auditar linhas nas tabelas BR antes).
- **Workspace**: único, com CRUD de Product/Price (resolver “sem deploy”) e
  `billing_provider` por cliente.
- **Mail como provider**: portal consome mail-admin/mailserver (criar conta, reset de
  senha, quota/uso, link webmail + guias) — sem novo sistema.
- **Billing**: BRL→MP / USD→Stripe já é por moeda; adicionar PIX/boleto via Bricks
  e recorrência MP; `billing_provider` por cliente como override da regra de moeda.
- **Retirada do legado**: remover routers conflitantes, parar containers
  `innexar-brasil-2-0-{portal,backend,db}` após migração, arquivar `innexar-br-2.0`
  (site BR 2.0 avaliar: migrar para stack USA ou manter só front apontando p/ api3 —
  ele já aponta para api3/portal certo).

## DOMAIN MAP (resumo)

| Domínio | DNS/proxy | Traefik → container:porta | App / pasta |
|---|---|---|---|
| workspace.innexar.app | A proxied | usa-workspace-app → `innexar-usa-workspace-app:3000` | Workspace `/srv/innexar/production/innexar-usa/innexar-workspace-app` |
| api3.innexar.app | A proxied | usa-api → `innexar-usa-workspace-backend:8000` | API FastAPI `.../innexar-usa/innexar-workspace` |
| api.innexar.com.br | A proxied | ⚠️ CONFLITO dois backends | idem + legado `innexar-br-2.0` |
| panel.innexar.app | A proxied | usa-portal → `innexar-usa-portal:3000` | Portal Next `.../innexar-usa/innexar-portal` |
| portal.innexar.com.br | A proxied | usa-portal → idem (br20-portal sombreado :80) | idem |
| innexar.app | A proxied | usa-website → `innexar-usa-website:3000` | Site US `.../innexar-usa/innexar-website` |
| innexar.com.br | A proxied | br20-website → `innexar-brasil-2-0-website:3003` | Site BR `.../innexar-br-2.0/innexar-br-website` |

SSL: Let's Encrypt via Traefik (DNS-01 Cloudflare / TLS-ALPN). Nginx/Apache dedicado:
não há — só nginx interno dos containers (roundcube apache, portal-cliente nginx :80
sombreado) + Traefik na borda (80/443).
