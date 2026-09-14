# 🎯 SETUP INICIAL - STRUCTURE & BOILERPLATE

## PARTE 1: WORKSPACE-BACKEND (FastAPI)

### 1.1 Estrutura de Pastas

```
workspace-backend/
├── venv/                              # virtual environment
├── app/
│   ├── __init__.py
│   ├── main.py                        # FastAPI app
│   ├── config.py                      # Environment & settings
│   ├── dependencies.py                # Dependency injection
│   │
│   ├── core/
│   │   ├── __init__.py
│   │   ├── security.py                # JWT, hashing
│   │   ├── permissions.py             # RBAC
│   │   ├── pagination.py              # Pagination helpers
│   │   └── errors.py                  # Custom exceptions
│   │
│   ├── database/
│   │   ├── __init__.py
│   │   ├── session.py                 # AsyncSession factory
│   │   ├── base.py                    # Base model
│   │   ├── models.py                  # All SQLAlchemy entities
│   │   └── migrations/                # Alembic versions
│   │       ├── env.py
│   │       ├── script.py.mako
│   │       └── versions/
│   │           ├── 001_initial.py
│   │           └── 002_add_subscriptions.py
│   │
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── __init__.py
│   │   │   ├── dtos.py
│   │   │   ├── repositories.py
│   │   │   ├── services.py
│   │   │   ├── controllers.py
│   │   │   └── routes.py
│   │   │
│   │   ├── products/
│   │   │   ├── __init__.py
│   │   │   ├── dtos.py
│   │   │   ├── repositories.py
│   │   │   ├── services.py
│   │   │   ├── controllers.py
│   │   │   └── routes.py
│   │   │
│   │   ├── customers/
│   │   │   ├── __init__.py
│   │   │   ├── dtos.py
│   │   │   ├── repositories.py
│   │   │   ├── services.py
│   │   │   ├── controllers.py
│   │   │   └── routes.py
│   │   │
│   │   ├── subscriptions/
│   │   │   ├── __init__.py
│   │   │   ├── dtos.py
│   │   │   ├── repositories.py
│   │   │   ├── services.py
│   │   │   ├── controllers.py
│   │   │   └── routes.py
│   │   │
│   │   ├── checkout/
│   │   │   ├── __init__.py
│   │   │   ├── dtos.py
│   │   │   ├── repositories.py
│   │   │   ├── services/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── checkout.py
│   │   │   │   ├── stripe.py
│   │   │   │   └── mercadopago.py
│   │   │   ├── controllers.py
│   │   │   ├── routes.py
│   │   │   └── webhooks.py
│   │   │
│   │   ├── leads/
│   │   │   ├── __init__.py
│   │   │   ├── dtos.py
│   │   │   ├── repositories.py
│   │   │   ├── services.py
│   │   │   ├── controllers.py
│   │   │   └── routes.py
│   │   │
│   │   ├── tickets/
│   │   │   ├── __init__.py
│   │   │   ├── dtos.py
│   │   │   ├── repositories.py
│   │   │   ├── services.py
│   │   │   ├── controllers.py
│   │   │   └── routes.py
│   │   │
│   │   └── dashboard/
│   │       ├── __init__.py
│   │       ├── dtos.py
│   │       ├── services.py
│   │       ├── controllers.py
│   │       └── routes.py
│   │
│   ├── shared/
│   │   ├── __init__.py
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── email.py
│   │   │   ├── storage.py
│   │   │   ├── notification.py
│   │   │   └── cache.py
│   │   │
│   │   ├── utils/
│   │   │   ├── __init__.py
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
│   └── tasks/
│       ├── __init__.py
│       ├── billing.py
│       ├── reminder.py
│       └── cleanup.py
│
├── tests/
│   ├── conftest.py
│   ├── test_auth.py
│   ├── test_products.py
│   ├── test_checkout.py
│   ├── test_subscriptions.py
│   ├── test_payments.py
│   ├── test-data/
│   │   ├── users.py
│   │   ├── products.py
│   │   └── customers.py
│   └── integration/
│       ├── test_checkout_flow.py
│       └── test_payment_flow.py
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
│
├── .env.example
├── .env.test
├── .gitignore
├── requirements.txt
├── setup.py
├── pytest.ini
├── alembic.ini
├── docker-compose.yml
├── Dockerfile
├── Dockerfile.test
├── README.md
└── CHANGELOG.md
```

### 1.2 Arquivos Iniciais

#### requirements.txt
```txt
# Core
FastAPI==0.104.1
uvicorn==0.24.0
python-dotenv==1.0.0
pydantic==2.5.0
pydantic-settings==2.1.0

# Database
sqlalchemy==2.0.23
alembic==1.13.0
asyncpg==0.29.0
psycopg2-binary==2.9.9

# Security
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
bcrypt==4.1.1
cryptography==41.0.7

# Payments
stripe==7.4.0
mercado-pago==2.2.0

# Async
aiohttp==3.9.1

# Caching
redis==5.0.1
aioredis==2.0.1

# Scheduling
apscheduler==3.10.4

# Email
sendgrid==7.2.1

# Testing
pytest==7.4.3
pytest-asyncio==0.21.1
pytest-cov==4.1.0
httpx==0.25.2

# Linting & Formatting
black==23.12.0
flake8==6.1.0
isort==5.13.2
mypy==1.7.1
pylint==3.0.3

# Monitoring
sentry-sdk==1.39.1

# Documentation
pip-audit==1.5.1
```

#### .env.example
```env
# APP
APP_ENV=development
APP_DEBUG=true
APP_NAME="Innexar Workspace API"
API_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000

# DATABASE
DATABASE_URL=postgresql://user:password@localhost:5432/innexar_db
DATABASE_ECHO=true

# REDIS
REDIS_URL=redis://localhost:6379/0

# JWT
JWT_SECRET=your_super_secret_key_change_in_prod
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24
JWT_REFRESH_EXPIRATION_DAYS=7

# STRIPE
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLIC_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_test_xxx

# MERCADO PAGO
MERCADOPAGO_ACCESS_TOKEN=APP_USR_xxx
MERCADOPAGO_PUBLIC_KEY=APP_USR_xxx

# EMAIL (SendGrid)
SENDGRID_API_KEY=SG.xxx
SENDER_EMAIL=noreply@innexar.com.br

# AWS S3
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_S3_BUCKET=innexar-uploads
AWS_REGION=us-east-1

# SENTRY
SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0

# CORS
CORS_ORIGINS=["http://localhost:3000", "http://localhost:3001"]

# RATE LIMITING
RATE_LIMIT_ENABLED=true
RATE_LIMIT_PER_MINUTE=60
```

#### app/main.py
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZIPMiddleware
from contextlib import asynccontextmanager
import logging

from app.config import settings
from app.database.session import init_db
from app.modules.auth.routes import router as auth_router
from app.modules.products.routes import router as products_router
from app.modules.customers.routes import router as customers_router
from app.modules.subscriptions.routes import router as subscriptions_router
from app.modules.checkout.routes import router as checkout_router
from app.modules.leads.routes import router as leads_router
from app.modules.tickets.routes import router as tickets_router
from app.modules.dashboard.routes import router as dashboard_router

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting up...")
    await init_db()
    yield
    # Shutdown
    logger.info("Shutting down...")

app = FastAPI(
    title=settings.app_name,
    description="API para gerenciar workspaces, subscriptions e pagamentos",
    version="1.0.0",
    lifespan=lifespan
)

# Middleware
app.add_middleware(GZIPMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(auth_router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(products_router, prefix="/api/v1/products", tags=["Products"])
app.include_router(customers_router, prefix="/api/v1/customers", tags=["Customers"])
app.include_router(subscriptions_router, prefix="/api/v1/subscriptions", tags=["Subscriptions"])
app.include_router(checkout_router, prefix="/api/v1/checkout", tags=["Checkout"])
app.include_router(leads_router, prefix="/api/v1/leads", tags=["Leads"])
app.include_router(tickets_router, prefix="/api/v1/tickets", tags=["Tickets"])
app.include_router(dashboard_router, prefix="/api/v1/dashboard", tags=["Dashboard"])

@app.get("/health", tags=["Health Check"])
async def health_check():
    return {"status": "healthy", "version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.app_env == "development"
    )
```

#### app/config.py
```python
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    # App
    app_env: str = "development"
    app_debug: bool = False
    app_name: str = "Innexar API"
    api_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:3000"
    
    # Database
    database_url: str
    database_echo: bool = False
    
    # Redis
    redis_url: str = "redis://localhost:6379/0"
    
    # JWT
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 24
    jwt_refresh_expiration_days: int = 7
    
    # Stripe
    stripe_secret_key: str
    stripe_public_key: str
    stripe_webhook_secret: str
    
    # Mercado Pago
    mercadopago_access_token: str
    mercadopago_public_key: str
    
    # Email
    sendgrid_api_key: str
    sender_email: str
    
    # AWS S3
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_s3_bucket: str = ""
    aws_region: str = "us-east-1"
    
    # CORS
    cors_origins: List[str] = ["http://localhost:3000"]
    
    # Sentry
    sentry_dsn: str = ""
    
    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()
```

#### app/database/base.py
```python
from sqlalchemy.orm import declarative_base
from sqlalchemy import Column, DateTime, func
from uuid import uuid4
from sqlalchemy import String

Base = declarative_base()

class TimestampMixin:
    """Mixin para adicionar created_at e updated_at a todas as tabelas"""
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

class SoftDeleteMixin:
    """Mixin para soft delete"""
    deleted_at = Column(DateTime, nullable=True)
```

#### app/database/session.py
```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.config import settings
from app.database.base import Base

engine = create_async_engine(
    settings.database_url,
    echo=settings.database_echo,
    future=True,
    pool_pre_ping=True
)

AsyncSessionLocal = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
```

---

## PARTE 2: PORTAL-FRONTEND (Next.js 14)

### 2.1 Estrutura de Pastas

```
portal-frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Root layout
│   │   ├── page.tsx                   # Home (redirect)
│   │   ├── globals.css
│   │   │
│   │   ├── (auth)/
│   │   │   ├── layout.tsx
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── register/
│   │   │   │   └── page.tsx
│   │   │   ├── password-reset/
│   │   │   │   └── page.tsx
│   │   │   └── magic-link/
│   │   │       └── [token]/page.tsx
│   │   │
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx             # Protected layout
│   │   │   ├── page.tsx               # Dashboard
│   │   │   ├── profile/
│   │   │   │   └── page.tsx
│   │   │   ├── subscriptions/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx
│   │   │   ├── invoices/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx
│   │   │   ├── tickets/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx
│   │   │   └── settings/
│   │   │       └── page.tsx
│   │   │
│   │   └── api/
│   │       └── auth/
│   │           └── [...nextauth]/
│   │               └── route.ts
│   │
│   ├── components/
│   │   ├── atoms/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Avatar.tsx
│   │   │   └── Spinner.tsx
│   │   │
│   │   ├── molecules/
│   │   │   ├── FormField.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Table.tsx
│   │   │   └── Pagination.tsx
│   │   │
│   │   ├── organisms/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── SubscriptionsList.tsx
│   │   │   ├── InvoicesList.tsx
│   │   │   └── TicketsList.tsx
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
│   │   ├── useTickets.ts
│   │   └── useFetch.ts
│   │
│   ├── modules/
│   │   ├── dashboard/
│   │   │   ├── components/
│   │   │   │   ├── MetricsCard.tsx
│   │   │   │   └── ChartSection.tsx
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
│   │   ├── api.ts                     # Axios instance
│   │   ├── auth.service.ts
│   │   ├── customers.service.ts
│   │   ├── subscriptions.service.ts
│   │   ├── invoices.service.ts
│   │   └── tickets.service.ts
│   │
│   ├── stores/
│   │   ├── auth.store.ts              # Zustand
│   │   ├── customer.store.ts
│   │   └── ui.store.ts
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
│   └── images/
│
├── .env.example
├── .env.local
├── package.json
├── next.config.mjs
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── jest.config.js
├── vitest.config.ts
├── .eslintrc.json
└── README.md
```

### 2.2 Arquivos Iniciais

#### package.json
```json
{
  "name": "innexar-portal",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest",
    "test:coverage": "vitest --coverage"
  },
  "dependencies": {
    "next": "14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "typescript": "5.3.3",
    "axios": "^1.6.2",
    "zustand": "^4.4.1",
    "next-auth": "^4.24.0",
    "react-query": "^3.39.3",
    "tailwindcss": "^3.3.6",
    "clsx": "^2.0.0",
    "date-fns": "^2.30.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.37",
    "@types/node": "^20.10.0",
    "@testing-library/react": "^14.1.2",
    "@testing-library/jest-dom": "^6.1.5",
    "vitest": "^1.1.0",
    "@vitest/coverage-v8": "^1.1.0",
    "eslint": "^8.55.0",
    "eslint-config-next": "14.0.0"
  }
}
```

#### .env.example
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_APP_NAME="Innexar Portal"
NEXT_PUBLIC_APP_DESCRIPTION="Portal de gerenciamento de assinaturas"

NEXTAUTH_SECRET=your_secret_key_change_in_prod
NEXTAUTH_URL=http://localhost:3000
```

#### src/services/api.ts
```typescript
import axios from 'axios'
import { useAuthStore } from '@/stores/auth.store'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add Authorization header
api.interceptors.request.use((config) => {
  const token = useAuthStore((state) => state.accessToken)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      // Refresh token logic
    }
    return Promise.reject(error)
  }
)

export default api
```

#### src/hooks/useAuth.ts
```typescript
import { useAuthStore } from '@/stores/auth.store'
import api from '@/services/api'

export function useAuth() {
  const { user, accessToken, setAuth, logout } = useAuthStore()

  const login = async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password })
    setAuth(response.data.data)
    return response.data.data
  }

  const register = async (data: any) => {
    const response = await api.post('/auth/register', data)
    setAuth(response.data.data)
    return response.data.data
  }

  return {
    user,
    accessToken,
    login,
    register,
    logout,
    isAuthenticated: !!accessToken,
  }
}
```

#### src/stores/auth.store.ts
```typescript
import { create } from 'zustand'

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
}

interface AuthStore {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  setAuth: (data: any) => void
  logout: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,

  setAuth: (data) => set({
    user: data.user,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  }),

  logout: () => set({
    user: null,
    accessToken: null,
    refreshToken: null,
  }),
}))
```

---

## PARTE 3: DOCKER COMPOSE

### 3.1 docker-compose.yml

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: innexar-postgres
    environment:
      POSTGRES_USER: innexar_user
      POSTGRES_PASSWORD: innexar_password_dev
      POSTGRES_DB: innexar_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U innexar_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis Cache
  redis:
    image: redis:7-alpine
    container_name: innexar-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # FastAPI Backend
  backend:
    build:
      context: ./workspace-backend
      dockerfile: Dockerfile
    container_name: innexar-backend
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://innexar_user:innexar_password_dev@postgres:5432/innexar_db
      REDIS_URL: redis://redis:6379/0
      APP_ENV: development
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./workspace-backend/app:/app/app
    command: uvicorn app.main:app --host 0.0.0.0 --reload

  # Next.js Frontend
  frontend:
    build:
      context: ./portal-frontend
      dockerfile: Dockerfile
    container_name: innexar-frontend
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8000
    depends_on:
      - backend
    volumes:
      - ./portal-frontend/src:/app/src

volumes:
  postgres_data:
  redis_data:
```

### 3.2 Dockerfile Backend

```dockerfile
# workspace-backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 3.3 Dockerfile Frontend

```dockerfile
# portal-frontend/Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json .
RUN npm ci

COPY . .
RUN npm run build

FROM node:18-alpine

WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY package.json package.json

EXPOSE 3000

CMD ["npm", "start"]
```

---

## Comandos para Iniciar

### Backend
```bash
cd workspace-backend

# Setup virtual environment
python -m venv venv
source venv/bin/activate  # ou `. venv/Scripts/activate` no Windows

# Install dependencies
pip install -r requirements.txt

# Setup .env
cp .env.example .env

# Run migrations
alembic upgrade head

# Start development server
python -m uvicorn app.main:app --reload
```

### Frontend
```bash
cd portal-frontend

# Install dependencies
npm install

# Setup .env
cp .env.example .env.local

# Start development server
npm run dev
```

### Docker Compose
```bash
# Start everything
docker-compose up -d

# View logs
docker-compose logs -f

# Stop everything
docker-compose down
```

---

**Tudo pronto para começar a implementação! 🚀**
