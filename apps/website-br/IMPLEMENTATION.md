# Implementação de Planos, Onboarding e Checkout - Innexar

## 📋 O que foi implementado

### 1. ✨ Novas Seções na Homepage
- **Seção de Vantagens** - Por que escolher Innexar
- **Seção de Processo** - Como funciona (4 passos)
- **Seção de Cursos/Cases** - Portfólio com projetos reais
- **Seção de FAQ** - Perguntas frequentes (acordeão interativo)
- **Seção de Estatísticas** - Números da empresa (500+ clientes, etc)
- **Header Melhorado** - Com detecção de scroll, animações Framer Motion, dropdown melhorado

### 2. 🎨 Componentes Reutilizáveis
- `StepCard` - Cards para o fluxo de processo
- `FeatureCard` - Cards genéricos com ícones
- `SectionHeader` - Header padrão com badge/título/subtitle
- `FAQItem` - Item acordeão para FAQ

### 3. 💰 Página de Planos (`/planos`)
5 planos profissionais:
- **Site Essencial** (R$ 299/mês) - Site básico + hospedagem
- **Site Profissional** (R$ 499/mês) - Site + Leads + Marketing
- **Site Máquina de Vendas** (R$ 799/mês) - Completo com CRM + Automação
- **Ads + Redes** (R$ 399/mês) - Gerenciamento de campanhas
- **Ads + Redes Premium** (R$ 699/mês) - Gestão marketing digital completa

Cada plano com:
- Lista de features com checkmarks
- Badge "Popular" / "Recomendado"
- CTA "Escolher plano"

### 4. 🎯 Onboarding Profissional (`/checkout/[planId]`)
Multi-step form com 5 etapas:

**Etapa 1 - Dados Pessoais:**
- Nome, sobrenome
- Email, telefone

**Etapa 2 - Empresa:**
- Nome da empresa
- Ramo de atuação (select)
- Site atual (opcional)

**Etapa 3 - Detalhes do Projeto:**
- Domínio desejado
- Objetivos (checkboxes: leads, vendas, marca, etc)
- Informações adicionais (textarea)

**Etapa 4 - Revisão:**
- Mostra todos os dados preenchidos
- Permite voltar para editar

**Etapa 5 - Pagamento:**
- Confirmação visual
- Botão "Finalizar"

Features:
- Progress bar visual
- Step indicators com números
- Validação por etapa
- Smooth transitions com Framer Motion
- Tratamento de erros

### 5. 🔄 Fluxo de Checkout Completo

**Frontend (novo-site):**
```
/planos 
  ↓ (clica "Escolher plano")
/checkout/[planId] (onboarding)
  ↓ (finaliza formulário)
/api/checkout/create-user (cria usuário)
  ↓
/api/checkout/create-order (cria pedido)
  ↓
/api/checkout/generate-token (gera token provisório)
  ↓ (redireciona com token)
portal.innexar.com.br/checkout?token=XXX&orderId=YYY
```

**Backend (workspace):**
- Recebe requisição com dados do usuário
- Cria customer e invoice no banco
- Integra com Mercado Pago
- Webhook confirma pagamento
- Ativa subscription

### 6. 📡 API Routes (Next.js)

#### POST `/api/checkout/create-user`
Cria novo usuário no backend
```json
{
  "email": "user@example.com",
  "firstName": "João",
  "lastName": "Silva",
  "phone": "+5513991821557",
  "companyName": "Acme Corp"
}
```
Response: `{ customerId, email }`

#### POST `/api/checkout/create-order`
Cria pedido/assinatura
```json
{
  "customerId": "cust_123",
  "planId": "site-pro",
  "email": "user@example.com",
  "companyName": "Acme Corp",
  "domain": "acme.com.br",
  "additionalInfo": "..."
}
```
Response: `{ orderId, invoiceId, planName }`

#### POST `/api/checkout/generate-token`
Gera token provisório para autenticação
```json
{
  "customerId": "cust_123",
  "orderId": "inv_456"
}
```
Response: `{ token, expiresIn, customerId, orderId }`

### 7. 📄 Páginas de Sucesso/Erro
- `/checkout/success` - Pagamento aprovado ✅
- `/checkout/cancel` - Pagamento cancelado ❌

## 🚀 Como Usar

### 1. Configuração

```bash
cp .env.example .env.local
```

Variáveis necessárias:
```env
NEXT_PUBLIC_SITE_URL=https://innexar.com.br
JWT_SECRET=seu_secret_aleatorio_32_chars_ou_mais
```

### 2. Instalação e Execução

```bash
npm install
npm run dev
```

### 3. Testar Localmente

1. Acesse: `http://localhost:3000/planos`
2. Clique em "Escolher plano"
3. Preencha o formulário de onboarding
4. Clique em "Finalizar"
5. Veja confirmação em `/checkout/success`

## 📁 Arquitetura de Arquivos

```
novo-site/
├── src/
│   ├── app/
│   │   ├── api/checkout/
│   │   │   ├── create-user/route.ts
│   │   │   ├── create-order/route.ts
│   │   │   └── generate-token/route.ts
│   │   ├── checkout/
│   │   │   ├── [planId]/page.tsx
│   │   │   ├── success/page.tsx
│   │   │   └── cancel/page.tsx
│   │   ├── planos/
│   │   │   └── page.tsx
│   │   └── page.tsx (homepage com todas as seções)
│   └── components/
│       ├── sections/
│       │   ├── Advantages.tsx
│       │   ├── CompanyStats.tsx
│       │   ├── Portfolio.tsx
│       │   ├── Process.tsx
│       │   ├── FAQ.tsx
│       │   ├── Services.tsx
│       │   ├── Testimonials.tsx
│       │   ├── Hero.tsx
│       │   └── CTASection.tsx
│       ├── layout/
│       │   ├── Header.tsx (melhorado)
│       │   └── Footer.tsx
│       └── ui/
│           └── ReusableCards.tsx (componentes)
├── .env.example
├── CHECKOUT_FLOW.md (documentação do fluxo)
└── BACKEND_ENDPOINTS.py (guia de endpoints esperados)
```

## ⚠️ Funcionalidade Atual & Futura

| Feature | Status | Notas |
|---------|--------|-------|
| Página de planos | ✅ Completo | 5 planos com CTA |
| Onboarding (wizard) | ✅ Completo | 5-step form com validação |
| API Routes | ✅ Inicial | Retorna IDs de exemplo, pronto para integração |
| Tokens provisórios | ✅ Básico | Gerado localmente (SHA256) |
| Integração workspace | ⏳ Pendente | Será integrado quando workspace criar API |
| Mercado Pago | ⏳ Pendente | Será integrado com workspace |
| Portal cliente | ⏳ Pendente | Será criado em repositório separado |

## 🔒 Segurança

✅ Validação de inputs em server-side
✅ HTTPS obrigatório em produção
✅ JWT_SECRET em variáveis de ambiente
✅ Sem dados sensíveis no frontend
✅ Tokens com expiração (1h)

## 📞 Próximos Passos

Quando workspace e portal forem criados:
1. Atualizar `.env.example` com WORKSPACE_API_URL e WORKSPACE_API_TOKEN
2. Implementar chamadas para endpoints do workspace em cada rota API
3. Integrar com Mercado Pago (via workspace)
4. Configurar webhooks de pagamento
5. Habilitar workflows de email
6. Criar páginas dinâmicas para portal

---

**Desenvolvido com ❤️ pela Innexar**
