# 📋 ESPECIFICAÇÃO TÉCNICA - DTOs & VALIDAÇÕES

## 1. AUTH MODULE

### DTOs

#### LoginRequestDto
```python
from pydantic import BaseModel, EmailStr, Field

class LoginRequestDto(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    rememberMe: bool = False
    
    class Config:
        schema_extra = {
            "example": {
                "email": "user@example.com",
                "password": "senha123",
                "rememberMe": True
            }
        }
```

#### LoginResponseDto
```python
class UserDto(BaseModel):
    id: UUID
    email: str
    firstName: str
    lastName: str
    role: str
    
    class Config:
        from_attributes = True

class LoginResponseDto(BaseModel):
    accessToken: str
    refreshToken: str
    expiresIn: int = 900  # segundos
    user: UserDto
```

#### RegisterRequestDto
```python
class RegisterRequestDto(BaseModel):
    email: EmailStr
    password: str = Field(
        min_length=8,
        max_length=128,
        regex=r"^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$"
    )
    firstName: str = Field(min_length=2, max_length=100)
    lastName: str = Field(min_length=2, max_length=100)
    
    class Config:
        schema_extra = {
            "example": {
                "email": "user@example.com",
                "password": "SecurePass123!",
                "firstName": "John",
                "lastName": "Doe"
            }
        }
```

#### ChangePasswordDto
```python
class ChangePasswordDto(BaseModel):
    currentPassword: str = Field(min_length=6)
    newPassword: str = Field(
        min_length=8,
        regex=r"^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$"
    )
    confirmPassword: str
    
    @validator('confirmPassword')
    def passwords_match(cls, v, values):
        if v != values.get('newPassword'):
            raise ValueError('Passwords do not match')
        return v
```

---

## 2. CUSTOMERS MODULE

### DTOs

#### CreateCustomerDto
```python
class CreateCustomerDto(BaseModel):
    email: EmailStr
    firstName: str = Field(min_length=2, max_length=100)
    lastName: str = Field(min_length=2, max_length=100)
    phone: str = Field(regex=r"^\+?1?\d{9,15}$")
    companyName: str = Field(min_length=2, max_length=255)
    website: HttpUrl | None = None
    industry: str | None = Field(max_length=100)
    country: str = Field(min_length=2, max_length=2, default="BR")
    
    class Config:
        schema_extra = {
            "example": {
                "email": "empresa@example.com",
                "firstName": "João",
                "lastName": "Silva",
                "phone": "+5511999999999",
                "companyName": "Tech Solutions",
                "website": "https://techsolutions.com.br",
                "industry": "Technology",
                "country": "BR"
            }
        }
```

#### UpdateCustomerDto
```python
class UpdateCustomerDto(BaseModel):
    firstName: str | None = Field(min_length=2, max_length=100)
    lastName: str | None = Field(min_length=2, max_length=100)
    phone: str | None = Field(regex=r"^\+?1?\d{9,15}$")
    companyName: str | None = Field(min_length=2, max_length=255)
    website: HttpUrl | None = None
    industry: str | None = Field(max_length=100)
```

#### CustomerDto
```python
class CustomerDto(BaseModel):
    id: UUID
    email: str
    firstName: str
    lastName: str
    phone: str | None
    companyName: str | None
    website: str | None
    industry: str | None
    country: str
    status: str
    estimatedMrr: Decimal
    createdAt: datetime
    updatedAt: datetime
    
    class Config:
        from_attributes = True
```

#### CustomerStatsDto
```python
class CustomerStatsDto(BaseModel):
    activeSubscriptions: int
    totalSpent: Decimal
    nextBillingDate: date | None
    churnRisk: bool = False
    avgMonthlyAmount: Decimal
```

---

## 3. PRODUCTS MODULE

### DTOs

#### CreateProductDto
```python
class CreateProductDto(BaseModel):
    slug: str = Field(
        regex=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
        max_length=100
    )
    name: str = Field(min_length=3, max_length=255)
    description: str = Field(min_length=10, max_length=2000)
    icon: HttpUrl | None = None
    features: list[str] = Field(min_items=1, max_items=10)
    
    class Config:
        schema_extra = {
            "example": {
                "slug": "site-pro",
                "name": "Site Profissional",
                "description": "Plano completo para empresas",
                "features": ["Domínio grátis", "SSL", "200GB storage"]
            }
        }
```

#### ProductDto
```python
class ProductDto(BaseModel):
    id: UUID
    slug: str
    name: str
    description: str
    icon: str | None
    features: list[str]
    isActive: bool
    prices: list["PricePlanDto"] = []
    createdAt: datetime
    updatedAt: datetime
    
    class Config:
        from_attributes = True
```

#### CreatePricePlanDto
```python
class CreatePricePlanDto(BaseModel):
    productId: UUID
    name: str = Field(max_length=50)  # "Mensal", "Anual"
    amount: Decimal = Field(gt=0)  # em BRL
    currency: str = Field(default="BRL")
    interval: str = Field(regex=r"^(month|year)$")
    intervalCount: int = Field(ge=1, default=1)
    trialDays: int = Field(ge=0, default=0)
    stripePriceId: str | None = None
    mercadopagoPlanId: str | None = None
    
    @validator('amount')
    def validate_amount(cls, v):
        if v < Decimal('0.01'):
            raise ValueError('Valor mínimo é R$ 0,01')
        if v > Decimal('99999.99'):
            raise ValueError('Valor máximo excedido')
        return v
```

#### PricePlanDto
```python
class PricePlanDto(BaseModel):
    id: UUID
    productId: UUID
    name: str
    amount: Decimal
    currency: str
    interval: str
    intervalCount: int
    trialDays: int
    stripePriceId: str | None
    mercadopagoPlanId: str | None
    isActive: bool
    createdAt: datetime
    updatedAt: datetime
    
    class Config:
        from_attributes = True
```

#### OnboardingAnswersDto
```python
class OnboardingAnswersDto(BaseModel):
    productId: UUID
    responses: dict  # Respostas dinâmicas baseadas no schema
    
    # Validação customizada no service
```

---

## 4. CHECKOUT MODULE

### DTOs

#### StartCheckoutDto
```python
class StartCheckoutDto(BaseModel):
    productSlug: str
    email: EmailStr
    firstName: str = Field(min_length=2, max_length=100)
    lastName: str = Field(min_length=2, max_length=100)
    phone: str | None = Field(regex=r"^\+?1?\d{9,15}$")
    companyName: str
    onboardingData: dict
    
    class Config:
        schema_extra = {
            "example": {
                "productSlug": "site-pro",
                "email": "novo@example.com",
                "firstName": "Maria",
                "lastName": "Santos",
                "phone": "+5511999999999",
                "companyName": "Consultoria ABC",
                "onboardingData": {
                    "company_name": "Consultoria ABC",
                    "main_color": "blue"
                }
            }
        }
```

#### CheckoutResponseDto
```python
class CheckoutResponseDto(BaseModel):
    customerId: UUID
    productId: UUID
    paymentUrl: str
    provider: str  # "stripe" ou "mercadopago"
    expiresAt: datetime
```

---

## 5. SUBSCRIPTIONS MODULE

### DTOs

#### CreateSubscriptionDto
```python
class CreateSubscriptionDto(BaseModel):
    customerId: UUID
    productId: UUID
    pricePlanId: UUID
    couponCode: str | None = None
    
    @validator('couponCode')
    def validate_coupon(cls, v):
        if v and len(v) > 50:
            raise ValueError('Cupom inválido')
        return v
```

#### SubscriptionDto
```python
class SubscriptionDto(BaseModel):
    id: UUID
    customerId: UUID
    productId: UUID
    pricePlanId: UUID
    status: str  # "active", "paused", "canceled", "trialing"
    quantity: int
    currentPeriodStart: datetime
    currentPeriodEnd: datetime
    cancelAt: datetime | None
    canceledAt: datetime | None
    cancellationReason: str | None
    stripeSubscriptionId: str | None
    createdAt: datetime
    updatedAt: datetime
    
    class Config:
        from_attributes = True
```

#### CancelSubscriptionDto
```python
class CancelSubscriptionDto(BaseModel):
    reason: str | None = Field(max_length=500)
    feedback: str | None = Field(max_length=1000)
```

#### PauseSubscriptionDto
```python
class PauseSubscriptionDto(BaseModel):
    months: int = Field(ge=1, le=12, default=1)
    reason: str | None = Field(max_length=500)
```

---

## 6. INVOICES MODULE

### DTOs

#### InvoiceDto
```python
class InvoiceDto(BaseModel):
    id: UUID
    customerId: UUID
    subscriptionId: UUID
    amount: Decimal
    currency: str
    status: str  # "pending", "paid", "failed", "refunded"
    paymentMethod: str  # "stripe", "mercadopago"
    dueDate: datetime
    paidAt: datetime | None
    stripeInvoiceId: str | None
    mercadopagoInvoiceId: str | None
    createdAt: datetime
    updatedAt: datetime
    
    class Config:
        from_attributes = True
```

#### ListInvoicesQueryDto
```python
class ListInvoicesQueryDto(BaseModel):
    page: int = Field(ge=1, default=1)
    limit: int = Field(ge=1, le=100, default=20)
    status: str | None = None
    fromDate: date | None = None
    toDate: date | None = None
    sortBy: str = Field(default="createdAt", regex=r"^(createdAt|dueDate|amount)$")
    order: str = Field(default="desc", regex=r"^(asc|desc)$")
```

---

## 7. LEADS MODULE

### DTOs

#### CreateLeadDto
```python
class CreateLeadDto(BaseModel):
    email: EmailStr
    name: str = Field(min_length=2, max_length=255)
    phone: str | None = Field(regex=r"^\+?1?\d{9,15}$")
    company: str | None = Field(max_length=255)
    message: str = Field(min_length=10, max_length=2000)
    
    class Config:
        schema_extra = {
            "example": {
                "email": "contato@empresa.com",
                "name": "João Silva",
                "phone": "+5511999999999",
                "company": "Empresa XYZ",
                "message": "Gostaria de saber mais sobre o plano Pro"
            }
        }
```

#### LeadDto
```python
class LeadDto(BaseModel):
    id: UUID
    email: str
    name: str
    phone: str | None
    company: str | None
    message: str
    source: str
    status: str  # "new", "contacted", "qualified", "converted"
    convertedCustomerId: UUID | None
    tags: list[str]
    assignedTo: UUID | None
    createdAt: datetime
    updatedAt: datetime
    
    class Config:
        from_attributes = True
```

#### UpdateLeadDto
```python
class UpdateLeadDto(BaseModel):
    status: str | None = Field(regex=r"^(new|contacted|qualified|converted|rejected)$")
    assignedTo: UUID | None = None
    tags: list[str] | None = None
```

---

## 8. TICKETS MODULE

### DTOs

#### CreateTicketDto
```python
class CreateTicketDto(BaseModel):
    title: str = Field(min_length=5, max_length=255)
    description: str = Field(min_length=20, max_length=5000)
    category: str = Field(
        regex=r"^(technical|billing|feature_request|bug|other)$"
    )
    priority: str = Field(
        regex=r"^(low|medium|high|urgent)$",
        default="medium"
    )
    attachments: list[str] = Field(default=[], max_items=5)
    
    class Config:
        schema_extra = {
            "example": {
                "title": "Problema ao acessar dashboard",
                "description": "Não consigo fazer login no dashboard...",
                "category": "technical",
                "priority": "high"
            }
        }
```

#### TicketDto
```python
class TicketDto(BaseModel):
    id: UUID
    customerId: UUID
    createdBy: UUID
    assignedTo: UUID | None
    title: str
    description: str
    priority: str
    status: str  # "open", "in_progress", "awaiting_customer", "resolved", "closed"
    category: str
    attachments: list[str]
    createdAt: datetime
    updatedAt: datetime
    resolvedAt: datetime | None
    messages: list["TicketMessageDto"] = []
    
    class Config:
        from_attributes = True
```

#### TicketMessageDto
```python
class TicketMessageDto(BaseModel):
    id: UUID
    ticketId: UUID
    fromUserId: UUID
    message: str
    isInternal: bool
    attachments: list[str]
    createdAt: datetime
    
    class Config:
        from_attributes = True
```

#### ReplyTicketDto
```python
class ReplyTicketDto(BaseModel):
    message: str = Field(min_length=5, max_length=5000)
    isInternal: bool = False
    attachments: list[str] = Field(default=[], max_items=5)
```

---

## 9. DASHBOARD MODULE

### DTOs

#### DashboardMetricsDto
```python
class DashboardMetricsDto(BaseModel):
    totalRevenue: Decimal
    mrr: Decimal  # Monthly Recurring Revenue
    arr: Decimal  # Annual Recurring Revenue
    activeSubscriptions: int
    newSubscriptions: int
    churnRate: float  # 0.0 to 1.0
    failedPayments: int
    topProducts: list[dict]  # [{productName, count, revenue}]
    topCustomers: list[dict]  # [{customerName, amount}]
    netResultMonth: Decimal
    costAcquisition: Decimal
    lifetimeValue: Decimal
```

#### RevenueChartDto
```python
class RevenueChartDto(BaseModel):
    date: date
    revenue: Decimal
    newCustomers: int
    canceledSubscriptions: int
```

#### DashboardQueryDto
```python
class DashboardQueryDto(BaseModel):
    dateFrom: date = Field(default_factory=lambda: date.today() - timedelta(days=30))
    dateTo: date = Field(default_factory=date.today)
    granularity: str = Field(
        default="day",
        regex=r"^(day|week|month)$"
    )
    groupBy: str | None = None
```

---

## 10. PAGINATION & RESPONSES

### DTOs Genéricas

#### PaginatedResponseDto
```python
class MetaDto(BaseModel):
    total: int
    page: int
    limit: int
    totalPages: int

class PaginatedResponse(BaseModel):
    data: list[T]
    meta: MetaDto
```

#### ErrorResponseDto
```python
class ErrorDetailDto(BaseModel):
    field: str
    message: str
    code: str

class ErrorResponseDto(BaseModel):
    statusCode: int
    error: str
    message: str
    timestamp: datetime
    path: str | None = None
    details: list[ErrorDetailDto] = []
```

#### SuccessResponseDto
```python
class SuccessResponseDto(BaseModel):
    data: T
    meta: dict = {}
    message: str | None = None
```

---

## 11. VALIDAÇÕES COMUNS

### Email Validation
```python
from pydantic import EmailStr, field_validator
import re

class EmailValidation:
    @field_validator('email')
    def validate_email(cls, v):
        if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', v):
            raise ValueError('Invalid email format')
        if len(v) > 255:
            raise ValueError('Email too long')
        return v.lower()
```

### Phone Validation
```python
class PhoneValidation:
    @field_validator('phone')
    def validate_phone(cls, v):
        # Remove non-digits
        digits = re.sub(r'\D', '', v) if v else ''
        
        if len(digits) < 9 or len(digits) > 15:
            raise ValueError('Invalid phone number')
        
        return v
```

### URL Validation
```python
from pydantic import HttpUrl

class URLValidation:
    website: HttpUrl = Field(None)
    
    @field_validator('website')
    def validate_url(cls, v):
        if v and not str(v).startswith(('http://', 'https://')):
            raise ValueError('URL must start with http:// or https://')
        return v
```

### Decimal Validation
```python
from decimal import Decimal

class DecimalValidation:
    amount: Decimal = Field(gt=Decimal('0.00'))
    
    @field_validator('amount')
    def validate_amount(cls, v):
        # 2 casas decimais máximo
        if v.as_tuple().exponent < -2:
            raise ValueError('Maximum 2 decimal places allowed')
        return v
```

---

## 12. SECURITY HEADERS

### Response Headers
```python
from fastapi.responses import JSONResponse

class SecureJSONResponse(JSONResponse):
    def init_headers(self):
        super().init_headers()
        self.headers['X-Content-Type-Options'] = 'nosniff'
        self.headers['X-Frame-Options'] = 'DENY'
        self.headers['X-XSS-Protection'] = '1; mode=block'
        self.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        self.headers['Content-Security-Policy'] = "default-src 'self'"
        self.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
```

---

## 13. REQUEST/RESPONSE PATTERNS

### Exemplo Completo de Requisição

**POST /api/v1/checkout/start**
```json
{
  "productSlug": "site-pro",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+5511999999999",
  "companyName": "Tech Corp",
  "onboardingData": {
    "company_name": "Tech Corp",
    "website": "https://techcorp.com",
    "main_color": "blue",
    "industry": "technology"
  }
}
```

**Response: 201 Created**
```json
{
  "data": {
    "customerId": "550e8400-e29b-41d4-a716-446655440000",
    "productId": "550e8400-e29b-41d4-a716-446655440001",
    "paymentUrl": "https://checkout.stripe.com/pay/...",
    "provider": "stripe",
    "expiresAt": "2026-01-15T15:30:00Z"
  },
  "meta": {
    "timestamp": "2026-01-15T14:30:00Z"
  }
}
```

### Erro Response

```json
{
  "statusCode": 422,
  "error": "Unprocessable Entity",
  "message": "Validation failed",
  "timestamp": "2026-01-15T14:30:00Z",
  "path": "/api/v1/checkout/start",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format",
      "code": "INVALID_EMAIL"
    },
    {
      "field": "phone",
      "message": "Phone must have 9-15 digits",
      "code": "INVALID_PHONE"
    }
  ]
}
```

---

**Todas as DTOs implementadas com validação automática! ✅**
