# 🚀 PLANO DE IMPLEMENTAÇÃO - WORKSPACE & PORTAL

## 📊 ENTREGA SEQUENCIAL (Sprint-Based)

---

## FASE 0: SETUP INICIAL (1-2 dias)

### Sprint 0.1: Criação de Repositórios & Ambiente

**Deliverables:**
- ✅ GitHub repos: `workspace-backend`, `portal-frontend`
- ✅ Docker compose setup (PostgreSQL 15, Redis)
- ✅ CI/CD pipeline (GitHub Actions)
- ✅ Environment files (.env.example)
- ✅ Pre-commit hooks (formatting, lint)

**Tarefas:**
```
1. Criar repo workspace-backend (FastAPI boilerplate)
   - pyproject.toml / requirements.txt
   - Python 3.11+
   - SQLAlchemy 2.0+
   - Pydantic v2
   - FastAPI 0.104+

2. Criar repo portal-frontend (Next.js 14)
   - TypeScript
   - Tailwind CSS
   - React Query / SWR
   - NextAuth.js

3. Setup PostgreSQL & Redis em docker-compose.yml

4. Configure GitHub Actions:
   - Backend: pytest + coverage (90% minimum)
   - Frontend: vitest + coverage (90% minimum)
   - Auto-deploy em staging
```

---

## FASE 1: AUTENTICAÇÃO & BASE (3-5 dias)

### Sprint 1.1: Banco de Dados & Migrations

**Entidades:**
- `users` (role, email, password_hash, created_at, updated_at, deleted_at)
- `sessions` (expires_at)

**Tasks:**
```sql
# 001_initial_schema.sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role VARCHAR(50) DEFAULT 'cliente',
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  device_fingerprint VARCHAR,
  ip_address VARCHAR,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
```

### Sprint 1.2: JWT & Auth Service

**Implementação:**
```python
# modules/auth/services.py
class AuthService:
    async def login(self, email: str, password: str) -> LoginResponseDto:
        user = await UserRepository.find_by_email(email)
        if not user or not verify_password(password, user.password_hash):
            raise UnauthorizedException("Invalid credentials")
        
        access_token = self.generate_jwt(user, expires_in=900)  # 15m
        refresh_token = self.generate_jwt(user, expires_in=86400*7)  # 7 days
        
        await SessionRepository.create(
            user_id=user.id,
            expires_at=datetime.now() + timedelta(days=7)
        )
        
        return LoginResponseDto(
            accessToken=access_token,
            refreshToken=refresh_token,
            expiresIn=900,
            user=UserDto.from_entity(user)
        )
    
    async def validate_token(self, token: str) -> JwtPayload | None:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
            return JwtPayload(**payload)
        except JWTError:
            return None
```

### Sprint 1.3: Auth Controllers & Endpoints

**Endpoints:**
```python
# modules/auth/routes.py
@router.post("/login")
async def login(request: LoginRequestDto) -> LoginResponseDto:
    return await auth_service.login(request.email, request.password)

@router.post("/refresh")
async def refresh(request: RefreshRequestDto) -> LoginResponseDto:
    payload = await auth_service.validate_token(request.refreshToken)
    if not payload:
        raise UnauthorizedException("Invalid refresh token")
    user = await UserRepository.find_by_id(payload.userId)
    return await auth_service.generate_response(user)

@router.post("/logout")
async def logout(token: str = Depends(get_token)) -> None:
    payload = await auth_service.validate_token(token)
    await SessionRepository.invalidate(payload.sessionId)

@router.post("/register")
async def register(request: RegisterRequestDto) -> UserDto:
    return await auth_service.register(request)
```

### Sprint 1.4: Permission & Role System

**Implementação:**
```python
# core/permissions.py
class PermissionService:
    ROLE_PERMISSIONS = {
        'admin': ['read:all', 'write:all', 'delete:all'],
        'financeiro': ['read:invoices', 'write:invoices'],
        'vendas': ['read:leads', 'write:leads', 'read:customers'],
        'suporte': ['read:tickets', 'write:tickets'],
        'cliente': ['read:own', 'write:own']
    }
    
    async def check_permission(self, user_id: UUID, action: str):
        user = await UserRepository.find_by_id(user_id)
        if action not in self.ROLE_PERMISSIONS[user.role]:
            raise ForbiddenException("Permission denied")

# Decorator
def require_permission(action: str):
    async def decorator(request, call_next):
        token = get_token(request)
        payload = await auth_service.validate_token(token)
        await permission_service.check_permission(payload.userId, action)
        return await call_next(request)
    return decorator
```

**Tests (90% coverage):**
```python
# tests/test_auth.py
async def test_login_success():
    user = await user_repo.create(email="test@example.com", password="pwd123")
    response = await auth_service.login("test@example.com", "pwd123")
    assert response.accessToken
    assert response.refreshToken

async def test_login_invalid_password():
    with pytest.raises(UnauthorizedException):
        await auth_service.login("test@example.com", "wrong")

async def test_jwt_expired():
    token = auth_service.generate_jwt(user, expires_in=-1)
    result = await auth_service.validate_token(token)
    assert result is None

async def test_permission_denied():
    user = await user_repo.create(role='cliente')
    with pytest.raises(ForbiddenException):
        await permission_service.check_permission(user.id, 'read:all')
```

---

## FASE 2: PRODUTOS & CATÁLOGO (2-3 dias)

### Sprint 2.1: Product Entities & Migrations

**Entidades:**
```python
# modules/products/entities.py
class Product(Base):
    __tablename__ = "products"
    
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    slug: Mapped[str]  # "site-pro"
    name: Mapped[str]
    description: Mapped[str]
    icon: Mapped[str | None]
    features: Mapped[list] = mapped_column(JSON)
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]
    
    prices: Mapped[list["PricePlan"]] = relationship(back_populates="product")

class PricePlan(Base):
    __tablename__ = "price_plans"
    
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    product_id: Mapped[UUID] = mapped_column(ForeignKey("products.id"))
    product: Mapped["Product"] = relationship()
    
    name: Mapped[str]  # "Mensal"
    amount: Mapped[Decimal]  # em centavos: 19900
    currency: Mapped[str] = mapped_column(default="BRL")
    interval: Mapped[str]  # "month", "year"
    interval_count: Mapped[int] = mapped_column(default=1)
    trial_days: Mapped[int] = mapped_column(default=0)
    stripe_price_id: Mapped[str | None]
    mercadopago_plan_id: Mapped[str | None]
    is_active: Mapped[bool] = mapped_column(default=True)
```

### Sprint 2.2: Product Services

```python
# modules/products/services.py
class ProductService:
    async def list_products(self) -> list[ProductDto]:
        products = await ProductRepository.find_all(is_active=True)
        return [ProductDto.from_entity(p) for p in products]
    
    async def get_product(self, product_id: UUID) -> ProductDto:
        product = await ProductRepository.find_by_id(product_id)
        if not product.is_active:
            raise NotFoundException()
        return ProductDto.from_entity(product)
    
    async def get_product_by_slug(self, slug: str) -> ProductDto:
        product = await ProductRepository.find_by_slug(slug)
        return ProductDto.from_entity(product)
    
    async def list_prices(self, product_id: UUID) -> list[PricePlanDto]:
        prices = await PricePlanRepository.find_by_product(product_id)
        return [PricePlanDto.from_entity(p) for p in prices]
```

### Sprint 2.3: Onboarding Templates

**Schema Dinâmico:**
```python
class OnboardingTemplate(Base):
    __tablename__ = "onboarding_templates"
    
    id: Mapped[UUID] = mapped_column(primary_key=True)
    product_id: Mapped[UUID] = mapped_column(ForeignKey("products.id"), unique=True)
    form_schema: Mapped[dict] = mapped_column(JSON)  # JSON-Schema

# Exemplo de schema (JSONB):
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
          "required": true,
          "validation": {"minLength": 2, "maxLength": 255}
        },
        {
          "id": "website",
          "type": "url",
          "label": "Website",
          "required": false
        }
      ]
    },
    {
      "id": "design_preferences",
      "title": "Preferências de Design",
      "fields": [
        {
          "id": "main_color",
          "type": "select",
          "label": "Cor Principal",
          "options": ["blue", "green", "red"],
          "required": true
        }
      ]
    }
  ]
}
```

### Sprint 2.4: Controllers & API

```python
# modules/products/routes.py
@router.get("/")
async def list_products() -> PaginatedResponse[ProductDto]:
    products = await product_service.list_products()
    return PaginatedResponse(data=products, meta={"total": len(products)})

@router.get("/{product_id}")
async def get_product(product_id: UUID) -> ProductDto:
    return await product_service.get_product(product_id)

@router.get("/{product_id}/prices")
async def list_prices(product_id: UUID) -> list[PricePlanDto]:
    return await product_service.list_prices(product_id)

@router.post("/", tags=["admin"])
async def create_product(request: CreateProductDto, token=Depends(get_token)) -> ProductDto:
    await permission_service.require_admin(token)
    return await product_service.create(request)
```

**Tests:**
```python
async def test_list_products():
    await product_repo.create(name="Site Essencial", is_active=True)
    products = await product_service.list_products()
    assert len(products) == 1

async def test_get_product_by_slug():
    await product_repo.create(slug="site-pro", name="Site Pro")
    product = await product_service.get_product_by_slug("site-pro")
    assert product.name == "Site Pro"
```

---

## FASE 3: CLIENTES (2-3 dias)

### Sprint 3.1: Customer Entities & Migrations

```python
class Customer(Base):
    __tablename__ = "customers"
    
    id: Mapped[UUID] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(unique=True)
    first_name: Mapped[str]
    last_name: Mapped[str]
    phone: Mapped[str | None]
    company_name: Mapped[str | None]
    website: Mapped[str | None]
    industry: Mapped[str | None]
    country: Mapped[str] = mapped_column(default="BR")
    status: Mapped[str] = mapped_column(default="active")
    stripe_customer_id: Mapped[str | None]
    mercadopago_customer_id: Mapped[str | None]
    estimated_mrr: Mapped[Decimal] = mapped_column(default=0)
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]
    deleted_at: Mapped[datetime | None]
    
    subscriptions: Mapped[list["Subscription"]] = relationship()
    
    __table_args__ = (
        Index("idx_customers_email", "email"),
        Index("idx_customers_status", "status"),
    )
```

### Sprint 3.2: Customer Services

```python
class CustomerService:
    async def create_customer(self, dto: CreateCustomerDto) -> CustomerDto:
        existing = await CustomerRepository.find_by_email(dto.email)
        if existing:
            raise ConflictException("Email already registered")
        
        customer = await CustomerRepository.create(Customer(**dto.dict()))
        
        # Integrar com Stripe/Mercado Pago
        stripe_cust = await stripe_service.create_customer(customer.email)
        customer.stripe_customer_id = stripe_cust['id']
        await CustomerRepository.save(customer)
        
        return CustomerDto.from_entity(customer)
    
    async def list_customers(self, page: int, limit: int, filters: dict) -> PaginatedResponse:
        query = CustomerRepository.query()
        
        if filters.get('status'):
            query = query.where(Customer.status == filters['status'])
        if filters.get('searchTerm'):
            term = f"%{filters['searchTerm']}%"
            query = query.where(
                or_(
                    Customer.email.ilike(term),
                    Customer.company_name.ilike(term)
                )
            )
        
        total = await query.count()
        customers = await query.offset((page-1)*limit).limit(limit).all()
        
        return PaginatedResponse(
            data=[CustomerDto.from_entity(c) for c in customers],
            meta={
                "total": total,
                "page": page,
                "limit": limit,
                "totalPages": (total + limit - 1) // limit
            }
        )
    
    async def get_customer_stats(self, customer_id: UUID) -> CustomerStatsDto:
        subs = await SubscriptionRepository.find_by_customer(customer_id)
        active = len([s for s in subs if s.status == 'active'])
        total_spent = sum(s.amount for s in subs if s.status in ['active', 'paused'])
        
        next_billing = min(
            [s.current_period_end for s in subs if s.status == 'active'],
            default=None
        )
        
        return CustomerStatsDto(
            activeSubscriptions=active,
            totalSpent=total_spent,
            nextBillingDate=next_billing
        )
```

### Sprint 3.3: Customer Controllers

```python
# modules/customers/routes.py
@router.post("/")
async def create_customer(request: CreateCustomerDto) -> CustomerDto:
    return await customer_service.create_customer(request)

@router.get("/")
async def list_customers(
    page: int = 1,
    limit: int = 20,
    status: str | None = None,
    token = Depends(get_token)
) -> PaginatedResponse:
    await permission_service.require_admin(token)
    filters = {"status": status} if status else {}
    return await customer_service.list_customers(page, limit, filters)

@router.get("/me")
async def get_current_customer(token = Depends(get_token)) -> CustomerDto:
    payload = await auth_service.validate_token(token)
    customer = await customer_service.find_by_email(payload.email)
    return CustomerDto.from_entity(customer)

@router.get("/{customer_id}/stats")
async def get_stats(customer_id: UUID, token = Depends(get_token)) -> CustomerStatsDto:
    await permission_service.check_own_resource(get_user_id(token), customer_id)
    return await customer_service.get_customer_stats(customer_id)

@router.patch("/{customer_id}")
async def update_customer(customer_id: UUID, request: UpdateCustomerDto, token = Depends(get_token)) -> CustomerDto:
    await permission_service.check_own_resource(get_user_id(token), customer_id)
    return await customer_service.update_customer(customer_id, request)
```

---

## FASE 4: CHECKOUT & PAGAMENTOS (5-7 dias) ⭐

### Sprint 4.1: Payment Entities & Migrations

```python
class PaymentIntent(Base):
    __tablename__ = "payment_intents"
    
    id: Mapped[UUID] = mapped_column(primary_key=True)
    customer_id: Mapped[UUID] = mapped_column(ForeignKey("customers.id"))
    subscription_id: Mapped[UUID | None] = mapped_column(ForeignKey("subscriptions.id"))
    amount: Mapped[Decimal]
    currency: Mapped[str] = mapped_column(default="BRL")
    status: Mapped[str]  # draft, pending, succeeded, failed
    payment_provider: Mapped[str]  # stripe, mercadopago
    provider_intent_id: Mapped[str | None]
    error_message: Mapped[str | None]
    created_at: Mapped[datetime]
    expires_at: Mapped[datetime]  # 15 minutos
    metadata: Mapped[dict] = mapped_column(JSON, default={})
    
    __table_args__ = (
        Index("idx_payment_intents_provider_intent_id", "provider_intent_id"),
    )
```

### Sprint 4.2: Stripe Integration

```python
# modules/checkout/services/stripe.py
class StripeService:
    def __init__(self, api_key: str):
        stripe.api_key = api_key
    
    async def create_payment_intent(
        self,
        customer_id: UUID,
        amount: int,  # em centavos
        metadata: dict
    ) -> PaymentIntent:
        customer = await CustomerRepository.find_by_id(customer_id)
        
        stripe_customer_id = customer.stripe_customer_id
        if not stripe_customer_id:
            sc = stripe.Customer.create(email=customer.email)
            stripe_customer_id = sc['id']
            customer.stripe_customer_id = stripe_customer_id
            await CustomerRepository.save(customer)
        
        intent = stripe.PaymentIntent.create(
            amount=amount,
            currency="brl",
            customer=stripe_customer_id,
            metadata=metadata
        )
        
        return await PaymentIntentRepository.create(
            PaymentIntent(
                customer_id=customer_id,
                amount=amount // 100,  # convert to BRL
                provider_intent_id=intent['id'],
                payment_provider='stripe',
                status='pending',
                expires_at=datetime.now() + timedelta(minutes=15),
                metadata=metadata
            )
        )
    
    async def create_checkout_session(
        self,
        customer_id: UUID,
        price_id: str,  # Stripe price ID
        success_url: str,
        cancel_url: str
    ) -> str:
        customer = await CustomerRepository.find_by_id(customer_id)
        
        session = stripe.checkout.Session.create(
            customer_email=customer.email,
            payment_method_types=['card'],
            line_items=[{
                'price': price_id,
                'quantity': 1,
            }],
            mode='subscription',
            success_url=success_url + '?session_id={CHECKOUT_SESSION_ID}',
            cancel_url=cancel_url,
        )
        
        return session['url']
    
    async def handle_webhook(self, event: dict) -> bool:
        """Processa webhooks do Stripe"""
        if event['type'] == 'checkout.session.completed':
            session_id = event['data']['object']['id']
            await self.handle_checkout_completed(session_id)
            return True
        
        elif event['type'] == 'payment_intent.succeeded':
            intent_id = event['data']['object']['id']
            await self.handle_payment_succeeded(intent_id)
            return True
        
        elif event['type'] == 'invoice.payment_failed':
            invoice_id = event['data']['object']['id']
            await self.handle_invoice_failed(invoice_id)
            return True
        
        return False
    
    async def handle_checkout_completed(self, session_id: str):
        session = stripe.checkout.Session.retrieve(session_id, expand=['subscription'])
        subscription = session['subscription']
        
        # Criar subscription no nosso banco
        customer_id = await CustomerRepository.find_by_email(session['customer_email']).id
        price_id = subscription['items']['data'][0]['price']['id']
        product_id = await PriceRepository.find_by_stripe_price_id(price_id).product_id
        
        await SubscriptionService.create_subscription(
            customer_id=customer_id,
            product_id=product_id,
            price_plan_id=price_id,
            stripe_subscription_id=subscription['id']
        )
        
        # Notificar cliente
        await EmailService.send_welcome_email(customer_email, product_name)
```

### Sprint 4.3: Mercado Pago Integration

```python
# modules/checkout/services/mercadopago.py
class MercadoPagoService:
    def __init__(self, access_token: str, public_key: str):
        self.sdk = mercadopago.SDK(access_token)
        self.public_key = public_key
    
    async def create_payment_link(
        self,
        customer_id: UUID,
        amount: Decimal,
        description: str,
        metadata: dict
    ) -> dict:
        customer = await CustomerRepository.find_by_id(customer_id)
        
        # Criar preference no Mercado Pago
        preference_data = {
            "items": [
                {
                    "title": description,
                    "quantity": 1,
                    "unit_price": float(amount),
                }
            ],
            "payer": {
                "email": customer.email,
                "name": customer.first_name,
            },
            "external_reference": str(customer_id),
            "metadata": metadata,
            "notification_url": f"{os.getenv('API_URL')}/api/v1/webhooks/mercadopago"
        }
        
        preference = self.sdk.preference().create(preference_data)
        
        return {
            "preferenceId": preference["response"]["id"],
            "initPoint": preference["response"]["init_point"],
            "sandboxInitPoint": preference["response"]["sandbox_init_point"],
        }
    
    async def handle_webhook(self, event: dict) -> bool:
        """Processa webhooks do Mercado Pago"""
        if event['type'] == 'payment':
            payment_id = event['data']['id']
            payment = self.sdk.payment().get(payment_id)
            
            if payment['response']['status'] == 'approved':
                await self.handle_payment_approved(payment['response'])
                return True
            elif payment['response']['status'] == 'rejected':
                await self.handle_payment_rejected(payment['response'])
                return True
        
        return False
    
    async def handle_payment_approved(self, payment: dict):
        external_ref = payment['external_reference']
        customer_id = UUID(external_ref)
        
        # Marcar invoice como pago
        invoice = await InvoiceRepository.find_by_customer(customer_id)
        await InvoiceService.mark_as_paid(invoice.id, datetime.now())
        
        # Email de confirmação
        customer = await CustomerRepository.find_by_id(customer_id)
        await EmailService.send_payment_confirmation(customer.email)
```

### Sprint 4.4: Checkout Service (Orquestrador)

```python
# modules/checkout/services/checkout.py
class CheckoutService:
    async def initialize_checkout(
        self,
        product_slug: str,
        email: str,
        first_name: str,
        last_name: str,
        phone: str,
        company_name: str,
        onboarding_data: dict
    ) -> dict:
        # 1. Validar onboarding
        product = await ProductService.get_product_by_slug(product_slug)
        await OnboardingService.validate_answers(product.id, onboarding_data)
        
        # 2. Criar/atualizar customer
        customer = await self._get_or_create_customer(
            email=email,
            first_name=first_name,
            last_name=last_name,
            phone=phone,
            company_name=company_name
        )
        
        # 3. Salvar respostas onboarding
        await OnboardingService.save_answers(
            customer_id=customer.id,
            product_id=product.id,
            answers=onboarding_data
        )
        
        # 4. Selecionar provider de pagamento
        provider = self._select_payment_provider(customer.country)
        
        # 5. Criar payment intent
        if provider == 'stripe':
            price_plan = product.prices[0]  # Usar primeira planode preço
            payment_url = await StripeService.create_checkout_session(
                customer_id=customer.id,
                price_id=price_plan.stripe_price_id,
                success_url=f"{os.getenv('FRONTEND_URL')}/checkout/success",
                cancel_url=f"{os.getenv('FRONTEND_URL')}/checkout/cancel"
            )
        else:  # mercadopago
            price_plan = product.prices[0]
            payment_link = await MercadoPagoService.create_payment_link(
                customer_id=customer.id,
                amount=price_plan.amount,
                description=f"{product.name} - {price_plan.name}",
                metadata={"product_slug": product_slug}
            )
            payment_url = payment_link['initPoint']
        
        return {
            "customerId": str(customer.id),
            "productId": str(product.id),
            "paymentUrl": payment_url,
            "provider": provider
        }
    
    async def _get_or_create_customer(self, **kwargs) -> Customer:
        customer = await CustomerRepository.find_by_email(kwargs['email'])
        if customer:
            return customer
        return await CustomerService.create_customer(CreateCustomerDto(**kwargs))
    
    def _select_payment_provider(self, country: str) -> str:
        if country == 'BR':
            return 'mercadopago'  # Default para Brasil
        return 'stripe'
```

### Sprint 4.5: Checkout Controllers & Webhooks

```python
# modules/checkout/routes.py
@router.post("/start")
async def start_checkout(request: StartCheckoutDto) -> dict:
    return await checkout_service.initialize_checkout(
        product_slug=request.productSlug,
        email=request.email,
        first_name=request.firstName,
        last_name=request.lastName,
        phone=request.phone,
        company_name=request.companyName,
        onboarding_data=request.onboardingData
    )

# modules/checkout/webhooks.py
@router.post("/webhooks/stripe", include_in_schema=False)
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')
    
    try:
        event = stripe.Webhook.construct_event(
            payload,
            sig_header,
            settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    await StripeService.handle_webhook(event)
    return {"received": True}

@router.post("/webhooks/mercadopago", include_in_schema=False)
async def mercadopago_webhook(request: Request):
    data = await request.json()
    await MercadoPagoService.handle_webhook(data)
    return {"received": True}
```

---

## FASE 5: ASSINATURAS & BILLING (3-4 dias)

### Sprint 5.1: Subscription Entities

```python
class Subscription(Base):
    __tablename__ = "subscriptions"
    
    id: Mapped[UUID] = mapped_column(primary_key=True)
    customer_id: Mapped[UUID] = mapped_column(ForeignKey("customers.id"))
    product_id: Mapped[UUID] = mapped_column(ForeignKey("products.id"))
    price_plan_id: Mapped[UUID] = mapped_column(ForeignKey("price_plans.id"))
    status: Mapped[str]  # active, paused, canceled, trialing
    quantity: Mapped[int] = mapped_column(default=1)
    current_period_start: Mapped[datetime]
    current_period_end: Mapped[datetime]
    cancel_at: Mapped[datetime | None]
    canceled_at: Mapped[datetime | None]
    cancellation_reason: Mapped[str | None]
    stripe_subscription_id: Mapped[str | None]
    mercadopago_subscription_id: Mapped[str | None]
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]
    
    customer: Mapped["Customer"] = relationship()
    product: Mapped["Product"] = relationship()
    price_plan: Mapped["PricePlan"] = relationship()
    invoices: Mapped[list["Invoice"]] = relationship()

class Invoice(Base):
    __tablename__ = "invoices"
    
    id: Mapped[UUID] = mapped_column(primary_key=True)
    customer_id: Mapped[UUID] = mapped_column(ForeignKey("customers.id"))
    subscription_id: Mapped[UUID] = mapped_column(ForeignKey("subscriptions.id"))
    amount: Mapped[Decimal]
    currency: Mapped[str] = mapped_column(default="BRL")
    status: Mapped[str]  # pending, paid, failed, refunded
    payment_method: Mapped[str]  # stripe, mercadopago
    due_date: Mapped[datetime]
    paid_at: Mapped[datetime | None]
    stripe_invoice_id: Mapped[str | None]
    mercadopago_invoice_id: Mapped[str | None]
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]
    
    __table_args__ = (
        Index("idx_invoices_customer_id", "customer_id"),
        Index("idx_invoices_status", "status"),
        Index("idx_invoices_due_date", "due_date"),
    )
```

### Sprint 5.2: Subscription Service

```python
class SubscriptionService:
    async def create_subscription(
        self,
        customer_id: UUID,
        product_id: UUID,
        price_plan_id: UUID,
        stripe_subscription_id: str | None = None
    ) -> Subscription:
        now = datetime.now()
        price_plan = await PricePlanRepository.find_by_id(price_plan_id)
        
        # Calcular período
        if price_plan.interval == 'month':
            period_end = now + timedelta(days=30 * price_plan.interval_count)
        else:  # year
            period_end = now + timedelta(days=365 * price_plan.interval_count)
        
        # Se tem trial
        if price_plan.trial_days > 0:
            actual_period_end = now + timedelta(days=price_plan.trial_days)
            status = 'trialing'
        else:
            actual_period_end = period_end
            status = 'active'
        
        subscription = await SubscriptionRepository.create(
            Subscription(
                customer_id=customer_id,
                product_id=product_id,
                price_plan_id=price_plan_id,
                status=status,
                current_period_start=now,
                current_period_end=actual_period_end,
                stripe_subscription_id=stripe_subscription_id
            )
        )
        
        # Criar primeira invoice (se não é trial)
        if price_plan.trial_days == 0:
            await InvoiceService.create_draft_invoice(subscription.id)
        
        # Email welcome
        customer = await CustomerRepository.find_by_id(customer_id)
        await EmailService.send_subscription_activated(customer.email, subscription)
        
        return subscription
    
    async def cancel_subscription(self, subscription_id: UUID, reason: str | None = None) -> Subscription:
        subscription = await SubscriptionRepository.find_by_id(subscription_id)
        subscription.status = 'canceled'
        subscription.canceled_at = datetime.now()
        subscription.cancellation_reason = reason
        await SubscriptionRepository.save(subscription)
        
        # Notificar cliente
        customer = await CustomerRepository.find_by_id(subscription.customer_id)
        await EmailService.send_subscription_canceled(customer.email, subscription)
        
        return subscription
    
    async def pause_subscription(self, subscription_id: UUID, months: int = 1) -> Subscription:
        subscription = await SubscriptionRepository.find_by_id(subscription_id)
        subscription.status = 'paused'
        subscription.current_period_end = datetime.now() + timedelta(days=30*months)
        await SubscriptionRepository.save(subscription)
        return subscription
    
    async def resume_subscription(self, subscription_id: UUID) -> Subscription:
        subscription = await SubscriptionRepository.find_by_id(subscription_id)
        subscription.status = 'active'
        await SubscriptionRepository.save(subscription)
        return subscription
```

### Sprint 5.3: Billing Cron Jobs

```python
# tasks/billing.py
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()

@scheduler.scheduled_job('cron', hour=0, minute=0)  # Daily at midnight
async def process_upcoming_billings():
    """Processa cobranças próximas"""
    tomorrow = datetime.now() + timedelta(days=1)
    
    subscriptions = await SubscriptionRepository.find_many(
        status__in=['trialing', 'active'],
        current_period_end__lte=tomorrow
    )
    
    for subscription in subscriptions:
        if subscription.status == 'trialing':
            # Mover de trial para ativo
            subscription.status = 'active'
            subscription.current_period_start = datetime.now()
            
            price_plan = subscription.price_plan
            if price_plan.interval == 'month':
                subscription.current_period_end = datetime.now() + timedelta(days=30)
            else:
                subscription.current_period_end = datetime.now() + timedelta(days=365)
            
            await SubscriptionRepository.save(subscription)
        
        # Criar nova invoice
        await InvoiceService.create_draft_invoice(subscription.id)

@scheduler.scheduled_job('cron', hour='*/4')  # Every 4 hours
async def process_failed_payments():
    """Tenta cobrança dos pagamentos falhados"""
    invoices = await InvoiceRepository.find_many(
        status='failed',
        updated_at__gte=datetime.now() - timedelta(days=7)
    )
    
    for invoice in invoices:
        try:
            if invoice.payment_method == 'stripe':
                payment = stripe.PaymentIntent.retrieve(invoice.stripe_invoice_id)
                stripe.PaymentIntent.confirm(payment['id'])
            
            invoice.status = 'paid'
            invoke.paid_at = datetime.now()
            await InvoiceRepository.save(invoice)
        except Exception as e:
            logger.error(f"Failed to process invoice {invoice.id}: {str(e)}")
```

---

## FASE 6: LEADS & SUPORTE (2-3 dias)

### Sprint 6.1: Lead Entity & Service

```python
class Lead(Base):
    __tablename__ = "leads"
    
    id: Mapped[UUID] = mapped_column(primary_key=True)
    email: Mapped[str]
    name: Mapped[str]
    phone: Mapped[str | None]
    company: Mapped[str | None]
    message: Mapped[str | None]
    source: Mapped[str] = mapped_column(default='website')
    status: Mapped[str] = mapped_column(default='new')
    converted_customer_id: Mapped[UUID | None] = mapped_column(ForeignKey("customers.id"))
    tags: Mapped[list] = mapped_column(JSON, default=[])
    assigned_to: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]

class Ticket(Base):
    __tablename__ = "tickets"
    
    id: Mapped[UUID] = mapped_column(primary_key=True)
    customer_id: Mapped[UUID] = mapped_column(ForeignKey("customers.id"))
    created_by: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    assigned_to: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str]
    description: Mapped[str]
    priority: Mapped[str] = mapped_column(default='medium')
    status: Mapped[str] = mapped_column(default='open')
    category: Mapped[str]
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]
    resolved_at: Mapped[datetime | None]

class TicketMessage(Base):
    __tablename__ = "ticket_messages"
    
    id: Mapped[UUID] = mapped_column(primary_key=True)
    ticket_id: Mapped[UUID] = mapped_column(ForeignKey("tickets.id"))
    from_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    message: Mapped[str]
    is_internal: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime]
```

### Sprint 6.2: Services & Controllers

```python
class LeadService:
    async def create_lead(self, dto: CreateLeadDto) -> Lead:
        lead = await LeadRepository.create(
            Lead(
                email=dto.email,
                name=dto.name,
                phone=dto.phone,
                company=dto.company,
                message=dto.message,
                source='website'
            )
        )
        
        # Notificar vendas
        await EmailService.send_lead_notification_to_sales(lead)
        
        return lead

class TicketService:
    async def create_ticket(self, customer_id: UUID, dto: CreateTicketDto) -> Ticket:
        ticket = await TicketRepository.create(
            Ticket(
                customer_id=customer_id,
                created_by=customer_id,
                title=dto.title,
                description=dto.description,
                category=dto.category,
                priority=dto.priority or 'medium'
            )
        )
        
        # Notificar suporte
        await EmailService.send_ticket_created_to_support(ticket)
        
        return ticket
    
    async def reply_ticket(self, ticket_id: UUID, message: str, from_user_id: UUID) -> TicketMessage:
        msg = await TicketMessageRepository.create(
            TicketMessage(
                ticket_id=ticket_id,
                from_user_id=from_user_id,
                message=message
            )
        )
        
        ticket = await TicketRepository.find_by_id(ticket_id)
        if from_user_id != ticket.created_by:
            # Notificar cliente que respondemos
            customer = await CustomerRepository.find_by_id(ticket.customer_id)
            await EmailService.send_ticket_replied(customer.email, ticket)
        
        return msg
```

---

## FASE 7: DASHBOARD & RELATÓRIOS (2-3 dias)

```python
class DashboardService:
    async def get_metrics(self, date_from: date, date_to: date) -> DashboardMetricsDto:
        invoices = await InvoiceRepository.find_many(
            status='paid',
            paid_at__gte=date_from,
            paid_at__lte=date_to
        )
        
        total_revenue = sum(inv.amount for inv in invoices)
        
        subscriptions = await SubscriptionRepository.find_many(
            status__in=['active', 'paused']
        )
        active_count = len([s for s in subscriptions if s.status == 'active'])
        mrr = sum(s.price_plan.amount for s in subscriptions if s.status == 'active')
        
        return DashboardMetricsDto(
            totalRevenue=total_revenue,
            mrr=mrr,
            activeSubscriptions=active_count,
            newSubscriptions=len([s for s in subscriptions if s.created_at >= date_from]),
            churnRate=0.05,  # Calcular propriamente
            failedPayments=len([inv for inv in invoices if inv.status == 'failed'])
        )
```

---

## FASE 8: FRONTEND PORTAL (5-7 dias)

### Sprint 8.1: Auth Pages

```typescript
// portal-frontend/src/app/(auth)/login/page.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { login } from '@/services/auth.service'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await login(email, password)
      localStorage.setItem('accessToken', response.accessToken)
      localStorage.setItem('refreshToken', response.refreshToken)
      router.push('/dashboard')
    } catch (err) {
      setError('Invalid credentials')
    }
  }

  return (
    <form onSubmit={handleLogin} className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Login</h1>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="w-full p-2 mb-4 border rounded"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Senha"
        className="w-full p-2 mb-4 border rounded"
      />
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <button type="submit" className="w-full bg-blue-500 text-white p-2 rounded">Login</button>
    </form>
  )
}
```

### Sprint 8.2: Dashboard Pages

```typescript
// portal-frontend/src/app/(dashboard)/page.tsx
'use client'

import { useAuth } from '@/hooks/useAuth'
import { useEffect, useState } from 'react'
import { getCustomerStats } from '@/services/customers.service'
import { listSubscriptions } from '@/services/subscriptions.service'

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [subscriptions, setSubscriptions] = useState([])

  useEffect(() => {
    const loadData = async () => {
      if (user) {
        const statsData = await getCustomerStats(user.id)
        const subsData = await listSubscriptions()
        setStats(statsData)
        setSubscriptions(subsData)
      }
    }
    loadData()
  }, [user])

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      
      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card title="Assinaturas Ativas" value={stats.activeSubscriptions} />
          <Card title="Total Gasto" value={`R$ ${stats.totalSpent}`} />
          <Card title="Próxima Cobrança" value={stats.nextBillingDate} />
        </div>
      )}

      <h2 className="text-2xl font-bold mt-8 mb-4">Suas Assinaturas</h2>
      <SubscriptionsList subscriptions={subscriptions} />
    </div>
  )
}
```

---

## FASE 9: TESTES & CI/CD (3-5 dias)

### Sprint 9.1: Backend Tests (90% coverage)

```python
# tests/test_auth.py (20+ testes)
# tests/test_checkout.py (30+ testes)
# tests/test_subscriptions.py (25+ testes)
# tests/test_payments.py (20+ testes)

# Command: pytest --cov=app --cov-report=html
# Verificar: coverage >= 90%
```

### Sprint 9.2: Frontend Tests (90% coverage)

```typescript
# tests/auth.test.ts
# tests/dashboard.test.ts
# tests/subscriptions.test.ts

# Command: vitest --coverage
# Coverage >= 90%
```

### Sprint 9.3: CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: CI/CD

on: [push, pull_request]

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - run: pip install -r requirements.txt
      - run: pytest --cov=app --cov-report=xml --cov-fail-under=90
      - uses: codecov/codecov-action@v3

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run lint
      - run: npm run test -- --coverage --coverage-fail-under=90
```

---

## FASE 10: DEPLOY & LAUNCH (2-3 dias)

### Sprint 10.1: Docker & Kubernetes

```dockerfile
# workspace-backend/Dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0"]

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
CMD ["next", "start"]
```

### Sprint 10.2: Environment & Secrets

```bash
# .env.prod (secrets in GitHub)
DATABASE_URL=postgresql://user:pass@prod-db:5432/innexar
REDIS_URL=redis://prod-redis:6379
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
MERCADOPAGO_ACCESS_TOKEN=xxx
JWT_SECRET=xxxxx
FRONTEND_URL=https://portal.innexar.com.br
API_URL=https://api.innexar.com.br
```

### Sprint 10.3: Launch Checklist

```
□ Database migrations rodadas em produção
□ Backups configurados e testados
□ SSL/TLS certificates válidos
□ CORS configurado corretamente
□ Rate limiting ativado
□ Monitoring e alertas configurados (Sentry, DataDog)
□ Email templates prontos
□ SMS templates (optional)
□ Landing page pronta
□ Documentação técnica completa
□ Swagger/OpenAPI publicado
□ Status page configurado
□ Disaster recovery plan
□ Performance benchmarks
□ Security audit feito
```

---

## CRONOGRAMA TOTAL

| Fase | Sprint | Dias | Status |
|------|--------|------|--------|
| 0 | 0.1-0.2 | 2 | ⏳ To Do |
| 1 | 1.1-1.4 | 5 | ⏳ To Do |
| 2 | 2.1-2.4 | 3 | ⏳ To Do |
| 3 | 3.1-3.3 | 3 | ⏳ To Do |
| 4 | 4.1-4.5 | 7 | ⏳ To Do |
| 5 | 5.1-5.3 | 4 | ⏳ To Do |
| 6 | 6.1-6.2 | 3 | ⏳ To Do |
| 7 | 7.1 | 3 | ⏳ To Do |
| 8 | 8.1-8.2 | 7 | ⏳ To Do |
| 9 | 9.1-9.3 | 5 | ⏳ To Do |
| 10 | 10.1-10.3 | 3 | ⏳ To Do |
| **TOTAL** | | **45 dias** | - |

---

**Pronto para começar! 🚀**
