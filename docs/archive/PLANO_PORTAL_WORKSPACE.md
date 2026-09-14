# Plano Completo: Portal do Cliente e Workspace

Documento de planejamento e implementação do sistema Portal + Workspace. Inclui análise do que existe, estrutura ideal e roadmap.

---

## 1. Visão Geral

### 1.1 Arquitetura Atual

```
innexar.com.br (website)     → Site público, checkout, launch
portal.innexar.com.br        → Portal do cliente (app separado)
innexar.com.br/workspace     → Workspace equipe (ainda no website)
api.innexar.com.br          → Backend FastAPI (innexar-workspace)
```

### 1.2 Arquitetura Alvo

```
innexar.com.br              → Website (público, checkout)
portal.innexar.com.br       → Portal do cliente
app.innexar.com.br          → Workspace equipe (app separado)
api.innexar.com.br          → Backend único
```

---

## 2. Portal do Cliente – Análise e Gaps

### 2.1 O Que Existe

| Área | Status | Detalhes |
|------|--------|----------|
| Dashboard | OK | Plano, site, fatura, painel Hestia, suporte, mensagens |
| Briefing | Parcial | Campos: empresa, serviços, cidade, WhatsApp, domínio, logo, cores, fotos |
| Billing | OK | Lista faturas, pagar, download |
| Support | OK | Tickets, mensagens |
| Projects | Parcial | Lista Project (id, name, status) – sem progresso, entrega |
| New-project | OK | Wizard tipo/descrição/orçamento |
| Profile | OK | Nome, email, telefone, endereço, senha |
| Notifications | OK | Lista e marcar lida |

### 2.2 O Que Falta (vs Estrutura Ideal)

| Item | Ideal | Atual | Gap |
|------|-------|-------|-----|
| **Briefing** | Empresa, segmento, cidade, telefone, logo, cores, referências, sobre, serviços, diferenciais, redes sociais, páginas, integrações, uploads | Só empresa, serviços, cidade, WhatsApp, domínio, logo, cores, fotos (texto) | Segmento, referências, sobre, diferenciais, redes sociais, páginas, integrações, upload de arquivos |
| **Produtos** | Lista produtos ativos (Site, Hospedagem, Manutenção) | Só no dashboard (plan) | Página dedicada /produtos |
| **Faturas** | Plano, histórico, próxima cobrança, método, atualizar cartão, cancelar | Só histórico e pagar | Método de pagamento, cancelar assinatura |
| **Support** | Prioridade, categorias, anexos | Só subject e mensagem | Prioridade, categorias, anexos |
| **New-project** | Tipo, descrição, prazo, orçamento, arquivos | Tipo, descrição, prazo, orçamento | Upload de arquivos |
| **Arquivos** | Biblioteca S3/R2, upload logo/fotos/docs | Não existe | Nova área /arquivos |
| **Perfil** | Nome, empresa, email, telefone, endereço, redes sociais, 2FA | Nome, email, telefone, endereço | Empresa, redes sociais, 2FA |
| **Status Projeto** | Pipeline visual (Briefing ✔, Design ✔, Dev ⏳, Revisão, Entrega) | Só status texto | Componente de pipeline |
| **Domínios** | Adicionar, alterar DNS | Não existe | Opcional |
| **Contratos** | Assinar, baixar, aceitar termos | Não existe | Opcional |
| **WhatsApp** | Botão "Falar com suporte" | Não existe | Link fixo |

### 2.3 Estrutura de Menu Ideal (Portal)

```
Dashboard
Projetos
  ├ Briefing
  └ Status do projeto
Produtos
  └ Produtos ativos
Financeiro
  ├ Faturas
  └ Assinatura
Arquivos
  ├ Upload
  └ Biblioteca
Suporte
  └ Tickets
Projetos
  └ Solicitar novo projeto
Conta
  ├ Perfil
  ├ Segurança
  └ Notificações
```

---

## 3. Workspace – Análise e Gaps

### 3.1 O Que Existe (Frontend em innexar-websitebr)

| Área | Rota | Status |
|------|------|--------|
| Dashboard | /workspace | Resumo (clientes, faturas, tickets, projetos, receita) |
| Clientes | /workspace/customers | Lista e detalhe |
| CRM | /workspace/crm/contacts | Contatos |
| Projetos | /workspace/projects | Lista e detalhe |
| Tickets | /workspace/support/tickets | Lista e detalhe |
| Billing | /workspace/billing/* | Invoices, products, price-plans |
| Hestia | /workspace/hestia/* | Users, domains, packages |
| Config | /workspace/config/* | Integrations, Hestia |

### 3.2 O Que Falta (vs Estrutura Ideal)

| Item | Ideal | Atual | Gap |
|------|-------|-------|-----|
| **Pedidos** | Área de novos pedidos (aguardando briefing) | Misturado em projetos | Separar pedidos de projetos |
| **Kanban** | Pipeline visual (Novos → Briefing → Design → Dev → Revisão → Entrega) | Não existe | Kanban de produção |
| **Briefings** | Lista de briefings recebidos com dados | ProjectRequest existe, sem UI dedicada | Tela de briefings |
| **Automação** | Webhook pago → criar cliente, projeto, pasta | Parcial (checkout cria customer/sub) | Criar Project ao pagar |
| **SLA** | Site Essencial 48h, Completo 72h | Não existe | Campo SLA no produto |

### 3.3 Separação do Workspace

O workspace está em `innexar-websitebr/src/app/[locale]/workspace/`. Deve ser extraído para `innexar-workspace` (frontend) como app Next.js independente, similar ao portal.

---

## 4. Fluxo Checkout → Cliente

### 4.1 Fluxo Atual

1. Cliente faz checkout em criar-site/checkout
2. POST /api/public/checkout/start → cria Customer, CustomerUser, Subscription, Invoice
3. Pagamento (MP Bricks ou Checkout Pro)
4. Webhook marca fatura paga
5. Provisioning Hestia (se produto de hosting)
6. Email com credenciais
7. Cliente acessa portal, preenche site-briefing

### 4.2 Fluxo Ideal

1. Cliente paga
2. Sistema cria automaticamente: Cliente, Workspace (projeto), Briefing pendente
3. Equipe recebe notificação
4. Cliente preenche briefing
5. Projeto entra em produção (status atualizado)

**Gap:** Hoje não se cria Project nem ProjectRequest automaticamente no checkout. O briefing é manual. Falta:
- Criar Project com status "aguardando_briefing" ao aprovar pagamento
- Vincular ProjectRequest ao Project quando briefing for enviado
- Notificar equipe

---

## 5. Banco de Dados – Estrutura Ideal

### 5.1 Tabelas Existentes

| Tabela | Uso |
|--------|-----|
| customers | Clientes |
| customer_users | Login do cliente |
| projects | Projetos (delivery) |
| project_requests | Solicitações/briefings |
| support_tickets | Tickets |
| support_ticket_messages | Mensagens |
| billing_invoices | Faturas |
| billing_subscriptions | Assinaturas |
| billing_products | Produtos |
| billing_price_plans | Planos |
| billing_provisioning_records | Hestia (site_url, domain) |
| notifications | Notificações |
| customer_password_reset | Reset senha |

### 5.2 Gaps / Novas Tabelas

| Tabela | Propósito |
|--------|-----------|
| project_files | Arquivos do projeto (S3 key, tipo, projeto) |
| project_status_history | Histórico de status para pipeline |
| contracts | Contratos digitais |
| subscription_payment_methods | Cartão salvo (Stripe) |

### 5.3 Status de Projeto (Enum)

```
novo_pedido
aguardando_briefing
briefing_recebido
design
desenvolvimento
revisao
entrega
projeto_concluido
```

---

## 6. Backend – Endpoints

### 6.1 Portal – Existentes

- /api/public/auth/customer/* (login, forgot, reset)
- /api/portal/me, /me/profile, /me/features, /me/dashboard, /me/password
- /api/portal/new-project, /api/portal/site-briefing
- /api/portal/invoices, /invoices/{id}/pay, /download
- /api/portal/projects, /projects/{id}
- /api/portal/tickets, /tickets/{id}, /tickets/{id}/messages
- /api/portal/notifications, /notifications/{id}/read

### 6.2 Portal – A Criar

| Endpoint | Método | Uso |
|----------|--------|-----|
| /api/portal/me/products | GET | Lista produtos ativos |
| /api/portal/me/subscription | GET | Assinatura atual, cancelar |
| /api/portal/projects/{id}/status | GET | Pipeline de status |
| /api/portal/files | GET/POST | Lista e upload |
| /api/portal/files/{id} | GET/DELETE | Download e remover |
| /api/portal/tickets (body) | POST | Adicionar prioridade, categoria, anexos |

### 6.3 Briefing – Campos a Adicionar (meta JSON)

- segment (segmento)
- references (referências de sites)
- about (sobre a empresa)
- differentiators (diferenciais)
- social_links (redes sociais)
- desired_pages (páginas desejadas)
- integrations (WhatsApp, etc.)

---

## 7. Storage (Arquivos)

### 7.1 Opções

| Opção | Prós | Contras |
|-------|-----|---------|
| Cloudflare R2 | Barato, sem egress, CDN | Novo |
| Amazon S3 | Maduro | Egress pago |
| MinIO | Self-hosted | Infra |

**Recomendação:** Cloudflare R2.

### 7.2 Estrutura de Pastas

```
/project-{id}/
  logo.png
  fotos/
  documentos/
```

---

## 8. Roadmap de Implementação

### Fase 1 – Correções e Melhorias Imediatas (Portal)
- [x] Corrigir site-briefing: router.push para `/${locale}` 
- [ ] Expandir briefing: segmento, referências, sobre, diferenciais, redes sociais
- [ ] Adicionar componente Status do Projeto (pipeline visual) no dashboard e projects
- [ ] Botão WhatsApp no layout

### Fase 2 – Separação do Workspace
- [ ] Criar innexar-workspace (frontend) como app Next.js
- [ ] Migrar rotas /workspace/* para o novo app
- [ ] Configurar app.innexar.com.br no Traefik
- [ ] Remover workspace do innexar-websitebr

### Fase 3 – Backend e Portal
- [ ] Endpoint /api/portal/me/products
- [ ] Endpoint /api/portal/projects/{id}/status (ou enriquecer Project)
- [ ] Expandir SiteBriefingRequest no backend
- [ ] Criar Project ao aprovar pagamento (webhook)

### Fase 4 – Arquivos
- [ ] Integrar Cloudflare R2 (ou S3)
- [ ] Endpoints upload/download
- [ ] Página /arquivos no portal
- [ ] Upload no briefing e new-project

### Fase 5 – Refinamentos
- [ ] Categorias e prioridade em tickets
- [ ] Anexos em tickets
- [ ] Kanban no workspace
- [ ] SLA por produto
- [ ] 2FA no perfil (opcional)

---

## 9. Checklist de Entrega

- [ ] Portal funcional após login (dashboard, briefing, billing, support, projects)
- [ ] Workspace separado em app independente
- [ ] Fluxo checkout → cliente → briefing → projeto documentado
- [ ] Documentação de API atualizada
- [ ] Testes para novos endpoints
