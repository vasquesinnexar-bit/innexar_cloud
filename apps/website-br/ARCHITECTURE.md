# 🏗️ ARQUITETURA COMPLETA - INNEXAR WORKSPACE & PORTAL

## 📋 ÍNDICE
1. [Visão Geral](#1-visão-geral)
2. [Domínios (Módulos)](#2-domínios-módulos)
3. [Modelos de Dados](#3-modelos-de-dados)
4. [API Endpoints](#4-api-endpoints)
5. [Fluxos de Integração](#5-fluxos-de-integração)
6. [Estrutura de Pastas](#6-estrutura-de-pastas)

---

## 1. VISÃO GERAL

### Sistema SaaS Integrado
```
novo-site (Frontend Venda)
    ↓ POST /api/checkout/*
workspace-backend (Gestão Interna + Pagamentos)
    ↓ webhook mp
    ↓ grant access token
portal-frontend (Dashboard Cliente)
    ↑ GET /api/customers/me
    ↑ GET /api/subscriptions
    ↑ GET /api/tickets
```

### Decisões Arquiteturais
- **Backend**: Python FastAPI (async)
- **Frontend**: React/TypeScript + Next.js
- **Database**: PostgreSQL 15+
- **Auth**: JWT + Refresh Tokens
- **Payment**: Stripe + Mercado Pago
- **ORM**: SQLAlchemy 2.0+ com async
- **Fila**: Redis (bullmq ou Celery)
- **Cache**: Redis
- **Storage**: S3 ou MinIO

### Autorização (RBAC)
```
Roles:
  - admin      → acesso total ao workspace
  - financeiro → apenas billing e pagamentos
  - vendas     → apenas leads e clientes
  - suporte    → apenas tickets e clientes
  - cliente    → acesso ao próprio portal
```

---

## 2. DOMÍNIOS (MÓDULOS)

### Domínio 1: AUTENTICAÇÃO & AUTORIZAÇÃO
**Responsabilidade**: Gerenciar login, JWT, permissões

**Entities**:
```
User
  - id: UUID (PK)
  - email: VARCHAR(255, UNIQUE)
  - password_hash: VARCHAR (bcrypt)
  - first_name: VARCHAR(100)
  - last_name: VARCHAR(100)
  - role: ENUM (admin, financeiro, vendas, suporte, cliente)
  - is_active: BOOLEAN DEFAULT true
  - last_login_at: TIMESTAMP
  - created_at: TIMESTAMP DEFAULT now()
  - updated_at: TIMESTAMP DEFAULT now()
  - deleted_at: TIMESTAMP NULL (soft delete)

Session
  - id: UUID (PK)
  - user_id: UUID (FK → users)
  - device_fingerprint: VARCHAR
  - ip_address: VARCHAR
  - expires_at: TIMESTAMP
  - created_at: TIMESTAMP DEFAULT now()
```

**DTOs**:
```
- LoginRequestDto { email, password }
- LoginResponseDto { accessToken, refreshToken, expiresIn }
- RegisterRequestDto { email, password, firstName, lastName }
- JwtPayloadDto { userId, email, role, iat, exp }
```

**Services**:
```
AuthService
  + login(email, password) → LoginResponseDto
  + register(dto) → User
  + refreshToken(token) → LoginResponseDto
  + validateToken(token) → JwtPayload | null
  + logout(sessionId) → void
  + changePassword(userId, oldPwd, newPwd) → void
  + requestPasswordReset(email) → void
  + resetPassword(token, newPassword) → void
  + generateMagicLink(email) → string (token válido 15min)
  + validateMagicLink(token) → User | null

PermissionService
  + hasPermission(userId, action, resource?) → boolean
  + getRolePermissions(role) → string[]
  + checkAdminOnly(userId) → void (throws 403)
  + checkOwnResource(userId, resourceOwnerId) → void
```

**Controllers**:
```
POST   /api/v1/auth/login
POST   /api/v1/auth/register
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
POST   /api/v1/auth/password-reset/request
POST   /api/v1/auth/password-reset/confirm
POST   /api/v1/auth/magic-link/generate
POST   /api/v1/auth/magic-link/validate
GET    /api/v1/auth/me (protected)
POST   /api/v1/auth/change-password (protected)
```

---

### Domínio 2: PRODUTOS & PLANOS
**Responsabilidade**: Catálogo de serviços e precificação

**Entities**:
```
Product
  - id: UUID (PK)
  - slug: VARCHAR(100, UNIQUE) ex: "site-pro"
  - name: VARCHAR(255) ex: "Site Profissional"
  - description: TEXT
  - icon: VARCHAR (URL)
  - features: JSONB (array de strings)
  - is_active: BOOLEAN DEFAULT true
  - created_at: TIMESTAMP
  - updated_at: TIMESTAMP

PricePlan
  - id: UUID (PK)
  - product_id: UUID (FK → products)
  - name: VARCHAR(50) ex: "Mensal"
  - amount: DECIMAL(15,2) em centavos
  - currency: VARCHAR(3) default "BRL"
  - interval: ENUM (month, year)
  - interval_count: INT default 1
  - trial_days: INT default 0
  - stripe_price_id: VARCHAR (integration)
  - mercadopago_plan_id: VARCHAR (integration)
  - is_active: BOOLEAN DEFAULT true
  - created_at: TIMESTAMP

OnboardingTemplate
  - id: UUID (PK)
  - product_id: UUID (FK → products)
  - form_schema: JSONB (dynamic questionnaire)
    {
      "steps": [
        {
          "id": "company_info",
          "title": "Informações da Empresa",
          "fields": [
            {
              "id": "company_name",
              "type": "text",
              "label": "Nome da Empresa",
              "required": true
            }
          ]
        }
      ]
    }
  - created_at: TIMESTAMP
```

**Services**:
```
ProductService
  + listProducts() → Product[]
  + getProduct(id) → Product
  + getProductBySlug(slug) → Product
  + createProduct(dto) → Product (admin only)
  + updateProduct(id, dto) → Product (admin only)
  + deactivateProduct(id) → void (soft delete)
  + listPrices(productId) → PricePlan[]
  + getPrice(priceId) → PricePlan
  + createPrice(dto) → PricePlan (admin only)

OnboardingService
  + getTemplate(productId) → OnboardingTemplate
  + saveOnboardingAnswers(customerId, orderId, answers) → void
  + getOnboardingAnswers(customerId, orderId) → object
  + validateAnswers(templateId, answers) → ValidationResult (throws if invalid)
```

**Controllers**:
```
GET    /api/v1/products (public)
GET    /api/v1/products/:id (public)
GET    /api/v1/products/:id/prices (public)
POST   /api/v1/products (admin only)
PATCH  /api/v1/products/:id (admin only)
DELETE /api/v1/products/:id (admin only)

GET    /api/v1/onboarding/:productId (public)
POST   /api/v1/onboarding/submit (protected)
```

---

### Domínio 3: CLIENTES
**Responsabilidade**: Gerenciar cadastro de clientes

**Entities**:
```
Customer
  - id: UUID (PK)
  - email: VARCHAR(255, UNIQUE)
  - first_name: VARCHAR(100)
  - last_name: VARCHAR(100)
  - phone: VARCHAR(20)
  - company_name: VARCHAR(255)
  - website: VARCHAR(255)
  - industry: VARCHAR(100)
  - country: VARCHAR(2)
  - status: ENUM (active, inactive, suspended)
  - stripe_customer_id: VARCHAR
  - mercadopago_customer_id: VARCHAR
  - metadata: JSONB (custom fields)
  - estimated_mrr: DECIMAL(15,2) (Monthly Recurring Revenue)
  - created_at: TIMESTAMP
  - updated_at: TIMESTAMP
  - deleted_at: TIMESTAMP NULL (soft delete)
  - Index: idx_customers_email, idx_customers_stripe_id
```

**Services**:
```
CustomerService
  + createCustomer(dto) → Customer
  + findById(customerId) → Customer
  + findByEmail(email) → Customer | null
  + listCustomers(page, limit, filters) → { data, meta }
    filters: { status, createdFrom, createdTo, searchTerm }
  + updateCustomer(customerId, dto) → Customer
  + deactivateCustomer(customerId) → void
  + getCustomerStats(customerId) → {
      activeSubscriptions: int,
      totalSpent: decimal,
      nextBillingDate: date
    }
```

**Controllers**:
```
POST   /api/v1/customers (public - create on checkout)
GET    /api/v1/customers (protected - admin)
GET    /api/v1/customers/:id (protected)
PATCH  /api/v1/customers/:id (protected)
GET    /api/v1/customers/me (protected - self)
```

---

### Domínio 4: ASSINATURAS
**Responsabilidade**: Gerenciar subscriptions e renovações

**Entities**:
```
Subscription
  - id: UUID (PK)
  - customer_id: UUID (FK → customers)
  - product_id: UUID (FK → products)
  - price_plan_id: UUID (FK → price_plans)
  - status: ENUM (trialing, active, past_due, canceled, paused)
  - quantity: INT default 1
  - current_period_start: TIMESTAMP
  - current_period_end: TIMESTAMP
  - cancel_at: TIMESTAMP NULL
  - canceled_at: TIMESTAMP NULL
  - cancellation_reason: VARCHAR(255)
  - stripe_subscription_id: VARCHAR
  - mercadopago_subscription_id: VARCHAR
  - metadata: JSONB
  - created_at: TIMESTAMP
  - updated_at: TIMESTAMP
  - Index: idx_subscriptions_customer_id, idx_subscriptions_status

Invoice
  - id: UUID (PK)
  - customer_id: UUID (FK → customers)
  - subscription_id: UUID (FK → subscriptions)
  - amount: DECIMAL(15,2)
  - currency: VARCHAR(3)
  - status: ENUM (draft, pending, paid, failed, refunded, canceled)
  - payment_method: VARCHAR (stripe, mercadopago, manual)
  - due_date: TIMESTAMP
  - paid_at: TIMESTAMP NULL
  - metadata: JSONB
  - stripe_invoice_id: VARCHAR
  - mercadopago_invoice_id: VARCHAR
  - created_at: TIMESTAMP
  - updated_at: TIMESTAMP
  - Index: idx_invoices_customer_id, idx_invoices_status, idx_invoices_due_date
```

**Services**:
```
SubscriptionService
  + createSubscription(customerId, productId, pricePlanId) → Subscription
  + getSubscription(subscriptionId) → Subscription
  + listSubscriptions(customerId) → Subscription[]
  + cancelSubscription(subscriptionId, reason?) → Subscription
  + pauseSubscription(subscriptionId, months?) → Subscription
  + resumeSubscription(subscriptionId) → Subscription
  + updateQuantity(subscriptionId, quantity) → Subscription

InvoiceService
  + createDraftInvoice(subscriptionId) → Invoice
  + markAsPaid(invoiceId, paidAt) → Invoice (via webhook)
  + markAsFailed(invoiceId, reason) → Invoice
  + listInvoices(customerId) → Invoice[]
  + getInvoicePDF(invoiceId) → File
  + retryFailedInvoice(invoiceId) → Invoice

BillingService (cron)
  + processUpcomingBillings()  # Run daily
  + cancelExpiredTrials()       # Run daily
  + sendRenewalReminders()      # Run 7 days before renewal
  + processFailedPayments()     # Run every 4 hours
```

**Controllers**:
```
POST   /api/v1/subscriptions (protected)
GET    /api/v1/subscriptions/:id (protected)
GET    /api/v1/subscriptions (protected - list own)
PATCH  /api/v1/subscriptions/:id (protected)
POST   /api/v1/subscriptions/:id/cancel (protected)
POST   /api/v1/subscriptions/:id/pause (protected)
POST   /api/v1/subscriptions/:id/resume (protected)

GET    /api/v1/invoices/:id (protected)
GET    /api/v1/invoices (protected - list own)
GET    /api/v1/invoices/:id/pdf (protected)
POST   /api/v1/invoices/:id/retry (protected)
POST   /api/v1/invoices (admin - manual)
```

---

### Domínio 5: CHECKOUT & PAGAMENTOS
**Responsabilidade**: Processar pagamentos via Stripe/Mercado Pago

**Entities**:
```
PaymentIntent
  - id: UUID (PK)
  - customer_id: UUID (FK)
  - subscription_id: UUID (FK) nullable
  - amount: DECIMAL(15,2)
  - currency: VARCHAR(3)
  - status: ENUM (draft, pending, requires_action, succeeded, failed, canceled)
  - payment_provider: VARCHAR (stripe, mercadopago)
  - provider_intent_id: VARCHAR (stripe_pi_xxx or mp_xxx)
  - metadata: JSONB
  - error_message: TEXT nullable
  - created_at: TIMESTAMP
  - expires_at: TIMESTAMP (15min after creation)
  - Index: idx_payment_intents_provider_id
```

**Services**:
```
CheckoutService
  + initializeCheckout(productId, customerId, onboardingData) → {
      customerId,
      subscriptionId,
      paymentUrl,
      provider,
      expiresAt
    }
  + validateOnboarding(productId, data) → ValidationResult
  + createOrUpdateCustomer(dto) → Customer
  + selectPaymentProvider(customerId) → "stripe" | "mercadopago"

StripeService
  + createPaymentIntent(customerId, amount, metadata) → PaymentIntent
  + retrievePaymentIntent(id) → PaymentIntent
  + createCheckoutSession(customerId, priceId, successUrl, cancelUrl) → {
      sessionId,
      url
    }
  + handleWebhook(event) → void
    - checkout.session.completed → createSubscription()
    - payment_intent.succeeded → markInvoiceAsPaid()
    - invoice.payment_failed → markInvoiceAsFailed()
    - customer.subscription.updated → updateSubscription()

MercadoPagoService
  + createPaymentLink(customerId, amount, metadata) → {
      preferenceId,
      initPoint,
      sandboxInitPoint
    }
  + getPreference(preferenceId) → Preference
  + handleWebhook(event) → void
    - payment.approved → markInvoiceAsPaid()
    - payment.rejected → markInvoiceAsFailed()
    - preapproval.authorized → createTrialSubscription()
```

**Controllers**:
```
POST   /api/v1/checkout/start (public)
GET    /api/v1/checkout/:checkoutId (public)
POST   /api/v1/checkout/:checkoutId/confirm (public)

POST   /api/v1/webhooks/stripe (public, signature validated)
POST   /api/v1/webhooks/mercadopago (public, signature validated)
```

---

### Domínio 6: LEADS & CRM
**Responsabilidade**: Gerenciar contatos via website e integração externa

**Entities**:
```
Lead
  - id: UUID (PK)
  - email: VARCHAR(255)
  - name: VARCHAR(255)
  - phone: VARCHAR(20)
  - company: VARCHAR(255)
  - message: TEXT
  - source: VARCHAR (website, api, import)
  - status: ENUM (new, contacted, qualified, converted, rejected, spam)
  - converted_customer_id: UUID (FK → customers) nullable
  - tags: VARCHAR[] (array of tags)
  - assigned_to: UUID (FK → users) nullable
  - metadata: JSONB
  - created_at: TIMESTAMP
  - updated_at: TIMESTAMP
  - Index: idx_leads_email, idx_leads_status, idx_leads_source
```

**Services**:
```
LeadService
  + createLead(dto) → Lead
  + findLeads(filters) → { data, meta }
    filters: { status, assignedTo, source, createdFrom }
  + updateLead(leadId, dto) → Lead
  + convertToCustomer(leadId, customerId) → void
  + assignLead(leadId, userId) → Lead
  + updateStatus(leadId, status) → Lead
  + bulkImportLeads(file) → { imported, failed, errors }

NotificationService
  + sendLeadNotification(leadId) → void (email admin)
  + sendLeadAssignmentEmail(userId, leadId) → void
```

**Controllers**:
```
POST   /api/v1/leads (public - from website)
GET    /api/v1/leads (protected - admin/vendas)
GET    /api/v1/leads/:id (protected)
PATCH  /api/v1/leads/:id (protected)
POST   /api/v1/leads/bulk-import (protected - admin)
POST   /api/v1/leads/:id/convert (protected - vendas)
```

---

### Domínio 7: TICKETS & SUPORTE
**Responsabilidade**: Sistema de suporte ao cliente

**Entities**:
```
Ticket
  - id: UUID (PK)
  - customer_id: UUID (FK)
  - created_by: UUID (FK → users)
  - assigned_to: UUID (FK → users) nullable
  - title: VARCHAR(255)
  - description: TEXT
  - priority: ENUM (low, medium, high, urgent)
  - status: ENUM (open, in_progress, awaiting_customer, resolved, closed)
  - category: VARCHAR (technical, billing, feature_request, bug)
  - attachments: VARCHAR[] (S3 URLs)
  - created_at: TIMESTAMP
  - updated_at: TIMESTAMP
  - resolved_at: TIMESTAMP nullable
  - Index: idx_tickets_customer_id, idx_tickets_status

TicketMessage
  - id: UUID (PK)
  - ticket_id: UUID (FK)
  - from_user_id: UUID (FK)
  - message: TEXT
  - is_internal: BOOLEAN (só para equipe)
  - attachments: VARCHAR[]
  - created_at: TIMESTAMP
```

**Services**:
```
TicketService
  + createTicket(customerId, dto) → Ticket
  + replyTicket(ticketId, message, attachments?) → TicketMessage
  + updateTicket(ticketId, { status, priority, assignedTo }) → Ticket
  + listTickets(customerId) → Ticket[]
  + listAllTickets(filters) → { data, meta } (admin)
    filters: { status, priority, assignedTo, createdFrom }
  + closeTicket(ticketId) → Ticket
  + reopenTicket(ticketId) → Ticket

NotificationService
  + sendTicketCreatedNotification(ticketId, adminEmail) → void
  + sendTicketRepliedNotification(ticketId, recipientId) → void
  + sendTicketAssignedEmail(ticketId, userId) → void
```

**Controllers**:
```
POST   /api/v1/tickets (protected - create)
GET    /api/v1/tickets/:id (protected)
GET    /api/v1/tickets (protected)
PATCH  /api/v1/tickets/:id (protected)
POST   /api/v1/tickets/:id/messages (protected)
GET    /api/v1/tickets/:id/messages (protected)
POST   /api/v1/tickets/:id/close (protected)
```

---

### Domínio 8: RELATÓRIOS & ANALYTICS
**Responsabilidade**: Dashboard e insights

**Services**:
```
DashboardService (workspace)
  + getMetrics(dateFrom, dateTo) → {
      totalRevenue: decimal,
      mrr: decimal,
      activeSubscriptions: int,
      newSubscriptions: int,
      churnRate: decimal,
      failedPayments: int,
      topProducts: [{product, count}]
    }
  + getRevenueChart(dateFrom, dateTo, granularity) → [{date, amount}]
  + getSubscriptionMetrics() → {
      active, paused, canceled, trialing
    }
  + getCustomerInsights() → {
      totalCustomers,
      avgLTV,
      avgCACost,
      topCustomersBySpend
    }

ReportsService
  + generateMonthlyReport() → PDF
  + generateCustomerReport(customerId) → PDF
  + generatePaymentReport(dateFrom, dateTo) → CSV
```

**Controllers**:
```
GET    /api/v1/dashboard/metrics (protected - admin)
GET    /api/v1/dashboard/revenue-chart (protected - admin)
GET    /api/v1/dashboard/subscriptions (protected - admin)
GET    /api/v1/reports/monthly (protected - admin)
```

---

## 3. MODELOS DE DADOS

### Diagrama ER (Entidades & Relacionamentos)

```
┌─────────────┐
│   USERS     │
├─────────────┤
│ id (PK)     │
│ email       │
│ role        │
└─────────────┘
      │
      │ 1:N
      └──────────────┐
                     │
             ┌───────┴──────────┐
             │  CUSTOMERS       │
             ├──────────────────┤
             │ id (PK)          │
             │ email            │
             │ stripe_cust_id   │
             └──────────────────┘
                     │
        ┌────────────┼───────────────┐
        │            │               │
        │            │               │
   1:N  │       1:N  │          1:N  │
        │            │               │
        ▼            ▼               ▼
  ┌──────────┐  ┌──────────────┐  ┌────────────┐
  │ LEADS    │  │SUBSCRIPTIONS │  │ INVOICES   │
  ├──────────┤  ├──────────────┤  ├────────────┤
  │ id (PK)  │  │ id (PK)      │  │ id (PK)    │
  │ status   │  │ status       │  │ status     │
  └──────────┘  │ product_id   │  │ amount     │
                └──┬───────────┘  └────────────┘
                   │
         1:N       │
      ┌────────────┘
      │
      ▼
  ┌──────────────┐
  │ PRODUCTS     │
  ├──────────────┤
  │ id (PK)      │
  │ slug         │
  │ name         │
  └──────────────┘
      │
      │ 1:N
      └─────────────┐
                    │
              ┌─────┴──────────┐
              │  PRICE_PLANS   │
              ├────────────────┤
              │ id (PK)        │
              │ amount         │
              │ interval       │
              └────────────────┘
```

---

## 4. API ENDPOINTS

### Autenticação (sem proteção)
```
POST   /api/v1/auth/login
POST   /api/v1/auth/register
POST   /api/v1/auth/refresh
POST   /api/v1/auth/password-reset/request
POST   /api/v1/auth/password-reset/confirm
POST   /api/v1/auth/magic-link/generate
POST   /api/v1/auth/magic-link/validate
```

### Públicos (para website)
```
GET    /api/v1/products
GET    /api/v1/products/:id
GET    /api/v1/products/:id/prices
GET    /api/v1/onboarding/:productId
POST   /api/v1/checkout/start
POST   /api/v1/webhooks/stripe
POST   /api/v1/webhooks/mercadopago
POST   /api/v1/leads
```

### Workspace (admin + roles, protected)
```
# CUSTOMERS
GET    /api/v1/customers
GET    /api/v1/customers/:id
PATCH  /api/v1/customers/:id

# SUBSCRIPTIONS
GET    /api/v1/subscriptions
GET    /api/v1/subscriptions/:id
PATCH  /api/v1/subscriptions/:id
POST   /api/v1/subscriptions/:id/cancel
POST   /api/v1/subscriptions/:id/pause

# INVOICES
GET    /api/v1/invoices
GET    /api/v1/invoices/:id
POST   /api/v1/invoices (manual)
POST   /api/v1/invoices/:id/retry

# LEADS
GET    /api/v1/leads
GET    /api/v1/leads/:id
PATCH  /api/v1/leads/:id
POST   /api/v1/leads/bulk-import
POST   /api/v1/leads/:id/convert

# TICKETS
GET    /api/v1/tickets
PATCH  /api/v1/tickets/:id
POST   /api/v1/tickets/:id/messages
GET    /api/v1/tickets/:id/messages

# PRODUCTS (admin only)
POST   /api/v1/products
PATCH  /api/v1/products/:id
DELETE /api/v1/products/:id

# DASHBOARD
GET    /api/v1/dashboard/metrics
GET    /api/v1/dashboard/revenue-chart
GET    /api/v1/dashboard/subscriptions
```

### Portal (customer self-service, protected)
```
GET    /api/v1/auth/me
POST   /api/v1/auth/change-password

GET    /api/v1/customers/me
PATCH  /api/v1/customers/me

GET    /api/v1/subscriptions (own)
GET    /api/v1/subscriptions/:id (own)
GET    /api/v1/invoices (own)
GET    /api/v1/invoices/:id/pdf (own)
POST   /api/v1/invoices/:id/retry (own)

POST   /api/v1/tickets (create)
GET    /api/v1/tickets (own)
GET    /api/v1/tickets/:id (own)
POST   /api/v1/tickets/:id/messages (own)
```

---

## 5. FLUXOS DE INTEGRAÇÃO

### Fluxo 1: Checkout Completo (novo-site → workspace → pagamento)

```
1. Cliente acessa /planos no novo-site
2. Cliente clica "Escolher plano"
3. Frontend redireciona para /checkout/[planId]
4. Cliente preenche dados + onboarding (5 steps)
5. Frontend chama: POST /api/checkout/start
   - Envia: { productSlug, email, firstName, lastName, phone, companyName, onboardingData }

WORKSPACE RECEBE:
6. CheckoutService.initializeCheckout()
   6a. Valida onboarding via OnboardingService
   6b. Cria/atualiza Customer
   6c. Cria PriceIntent (draft)
   6d. Retorna: { customerId, paymentUrl, provider }

NOVO-SITE RECEBE:
7. Frontend redireciona para paymentUrl (Stripe ou Mercado Pago)
8. Cliente confirma pagamento

PAGAMENTO PROCESSADO:
9. Stripe/Mercado Pago retorna sucesso
10. Webhook entra no workspace:
    - StripeService.handleWebhook() ou
    - MercadoPagoService.handleWebhook()

SERVICE PROCESSA:
11. SubscriptionService.createSubscription()
12. InvoiceService.markAsPaid()
13. Email confirmation enviado
14. Magic link gerado para portal: token_temporário
15. Frontend redireciona para /checkout/success?token=xxx

CLIENTE ACESSA:
16. Cliente clica link no email ou acessa portal
17. Portal valida token
18. Portal cria sessão com refreshToken
19. Cliente vê dashboard com serviço ativo
```

### Fluxo 2: Renovação Automática (cron diário)

```
1. BillingService.processUpcomingBillings() (cron daily)
2. Busca subscriptions com current_period_end < tomorrow
3. Para cada subscription:
   4. Cria novo Invoice (status=pending)
   5. Chama Stripe ou Mercado Pago para cobrar
   6. Se sucesso: marca como paid, email receipt
   7. Se falha: retenta em 4 horas (cron 6x)
   8. Após 6 falhas: marca como failed, email alerta
```

### Fluxo 3: Portal Cliente Login (magic link)

```
1. Cliente recebe email com magic link:
   https://portal.innexar.com.br/auth/magic-link?token=xxxx

2. Portal/pages/auth/magic-link/[token]
   3. Valida token (exp < 15min)
   4. Chama: POST /api/v1/auth/magic-link/validate
   5. Workspace retorna: { customerId, accessToken, refreshToken }
   6. Portal salva tokens (httpOnly cookie + localStorage)

7. Cliente redireciona para /dashboard
   8. Frontend chama: GET /api/v1/customers/me
   9. Mostra dados pessoais, subscriptions, invoices
```

---

## 6. ESTRUTURA DE PASTAS

### Backend (workspace-backend)

```
workspace-backend/
├── app/
│   ├── __init__.py
│   ├── main.py                          # FastAPI app setup
│   ├── config.py                        # Env vars, settings
│   ├── dependencies.py                  # DI (database, auth)
│   │
│   ├── core/
│   │   ├── security.py                  # JWT, password hashing
│   │   ├── permissions.py               # RBAC decorators
│   │   ├── pagination.py                # Pagination helpers
│   │   └── errors.py                    # Custom exceptions
│   │
│   ├── database/
│   │   ├── __init__.py
│   │   ├── session.py                   # AsyncSession
│   │   ├── base.py                      # Base model for all entities
│   │   ├── migrations/                  # Alembic
│   │   │   ├── versions/
│   │   │   │   ├── 001_initial.py
│   │   │   │   └── 002_add_subscriptions.py
│   │   │   └── env.py
│   │   └── models.py                    # All entities (SQLAlchemy)
│   │
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── __init__.py
│   │   │   ├── entities.py              # User, Session
│   │   │   ├── dtos.py                  # LoginRequestDto, etc
│   │   │   ├── repositories.py          # UserRepository
│   │   │   ├── services.py              # AuthService, PermissionService
│   │   │   ├── controllers.py           # AuthController
│   │   │   └── routes.py                # /api/v1/auth/*
│   │   │
│   │   ├── products/
│   │   │   ├── entities.py
│   │   │   ├── dtos.py
│   │   │   ├── repositories.py
│   │   │   ├── services.py
│   │   │   ├── controllers.py
│   │   │   └── routes.py
│   │   │
│   │   ├── customers/
│   │   │   ├── entities.py
│   │   │   ├── dtos.py
│   │   │   ├── repositories.py
│   │   │   ├── services.py
│   │   │   ├── controllers.py
│   │   │   └── routes.py
│   │   │
│   │   ├── subscriptions/
│   │   │   ├── entities.py
│   │   │   ├── dtos.py
│   │   │   ├── repositories.py
│   │   │   ├── services.py
│   │   │   ├── controllers.py
│   │   │   └── routes.py
│   │   │
│   │   ├── checkout/
│   │   │   ├── entities.py
│   │   │   ├── dtos.py
│   │   │   ├── repositories.py
│   │   │   ├── services/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── checkout.py          # CheckoutService
│   │   │   │   ├── stripe.py            # StripeService
│   │   │   │   └── mercadopago.py       # MercadoPagoService
│   │   │   ├── controllers.py
│   │   │   ├── routes.py
│   │   │   └── webhooks.py              # webhook handlers
│   │   │
│   │   ├── leads/
│   │   │   ├── entities.py
│   │   │   ├── dtos.py
│   │   │   ├── repositories.py
│   │   │   ├── services.py
│   │   │   ├── controllers.py
│   │   │   └── routes.py
│   │   │
│   │   ├── tickets/
│   │   │   ├── entities.py
│   │   │   ├── dtos.py
│   │   │   ├── repositories.py
│   │   │   ├── services.py
│   │   │   ├── controllers.py
│   │   │   └── routes.py
│   │   │
│   │   └── dashboard/
│   │       ├── dtos.py
│   │       ├── services.py
│   │       ├── controllers.py
│   │       └── routes.py
│   │
│   ├── shared/
│   │   ├── __init__.py
│   │   ├── services/
│   │   │   ├── email.py                 # EmailService (SendGrid)
│   │   │   ├── storage.py               # S3Service
│   │   │   ├── notification.py          # NotificationService
│   │   │   └── cache.py                 # RedisCache
│   │   │
│   │   ├── utils/
│   │   │   ├── validators.py
│   │   │   ├── formatters.py
│   │   │   └── helpers.py
│   │   │
│   │   └── events/
│   │       ├── __init__.py
│   │       ├── customer_created.py
│   │       ├── payment_succeeded.py
│   │       └── email_events.py
│   │
│   └── tasks/                           # Celery/APScheduler
│       ├── __init__.py
│       ├── billing.py                   # Cron jobs
│       ├── reminder.py                  # Email reminders
│       └── cleanup.py                   # Cleanup tasks
│
├── tests/
│   ├── conftest.py                      # Test setup
│   ├── test_auth.py
│   ├── test_products.py
│   ├── test_checkout.py
│   ├── test_subscriptions.py
│   └── test_payments.py
│
├── requirements.txt
├── .env.example
├── alembic.ini
├── Dockerfile
├── docker-compose.yml
└── README.md
```

### Frontend Portal (portal-frontend)

```
portal-frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                     # Home redirect
│   │   ├── globals.css
│   │   │
│   │   ├── (auth)/
│   │   │   ├── layout.tsx
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   ├── password-reset/page.tsx
│   │   │   └── magic-link/[token]/page.tsx
│   │   │
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx               # ProtectedLayout
│   │   │   ├── page.tsx                 # Dashboard
│   │   │   ├── profile/page.tsx
│   │   │   ├── subscriptions/page.tsx
│   │   │   ├── invoices/page.tsx
│   │   │   ├── invoices/[id]/page.tsx
│   │   │   ├── tickets/page.tsx
│   │   │   ├── tickets/[id]/page.tsx
│   │   │   └── settings/page.tsx
│   │   │
│   │   └── api/
│   │       └── auth/[...nextauth]/route.ts
│   │
│   ├── components/
│   │   ├── atoms/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Badge.tsx
│   │   │   └── Avatar.tsx
│   │   │
│   │   ├── molecules/
│   │   │   ├── FormField.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── Table.tsx
│   │   │
│   │   ├── organisms/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── SubscriptionsList.tsx
│   │   │   ├── InvoicesList.tsx
│   │   │   └── TicketList.tsx
│   │   │
│   │   └── layout/
│   │       ├── ProtectedLayout.tsx
│   │       └── AuthLayout.tsx
│   │
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useCustomer.ts
│   │   ├── useSubscriptions.ts
│   │   ├── useInvoices.ts
│   │   └── useFetch.ts
│   │
│   ├── modules/
│   │   ├── dashboard/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── services/
│   │   │
│   │   ├── subscriptions/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── services/
│   │   │
│   │   ├── tickets/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── services/
│   │   │
│   │   └── invoices/
│   │       ├── components/
│   │       ├── hooks/
│   │       └── services/
│   │
│   ├── services/
│   │   ├── api.ts                       # Axios client
│   │   ├── auth.service.ts
│   │   ├── customers.service.ts
│   │   ├── subscriptions.service.ts
│   │   ├── invoices.service.ts
│   │   └── tickets.service.ts
│   │
│   ├── stores/
│   │   └── auth.store.ts                # Zustand auth store
│   │
│   ├── types/
│   │   ├── auth.ts
│   │   ├── customer.ts
│   │   ├── subscription.ts
│   │   ├── invoice.ts
│   │   └── ticket.ts
│   │
│   ├── utils/
│   │   ├── formatters.ts
│   │   ├── validators.ts
│   │   └── helpers.ts
│   │
│   └── middleware.ts
│
├── public/
├── .env.example
├── package.json
├── next.config.mjs
├── tsconfig.json
└── tailwind.config.ts
```

---

## PRÓXIMAS ETAPAS

1. ✅ Arquitetura documentada
2. ⏳ Implementação do projeto estrutura de pastas
3. ⏳ Banco de dados (migrations)
4. ⏳ Autenticação & JWT
5. ⏳ Produtos & Planos
6. ⏳ Checkout & Pagamentos
7. ⏳ Integração Stripe + Mercado Pago
8. ⏳ Portal frontend
9. ⏳ Testes automatizados
10. ⏳ CI/CD pipeline

---

**Arquitetura 100% pronta para implementação! 🚀**
