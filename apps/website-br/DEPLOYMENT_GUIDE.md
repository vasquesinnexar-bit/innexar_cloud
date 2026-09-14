# 🚀 DEPLOYMENT & PRODUCTION CHECKLIST

## PARTE 1: PRÉ-DEPLOYMENT CHECKLIST

### Code Quality
- [ ] Todos testes passando (backend 90%+ coverage, frontend 90%+ coverage)
- [ ] Lint sem errors (ESLint, Pylint, Black, MyPy)
- [ ] Sem hardcoded secrets ou credentials
- [ ] Sem console.logs ou debug prints em produção
- [ ] Todas as DTOs validadas com Pydantic
- [ ] Todas as queries otimizadas (sem N+1)
- [ ] Rate limiting configurado
- [ ] CORS configurado corretamente

### Security
- [ ] JWT expires configurados (access: 15min, refresh: 7 dias)
- [ ] Senhas hasheadas com bcrypt (salt >= 12)
- [ ] SQL injection prevention (usando ORM)
- [ ] XSS prevention (sanitizar inputs)
- [ ] CSRF tokens implementados
- [ ] HTTPS obrigatório
- [ ] HSTS header configurado
- [ ] Content-Security-Policy header
- [ ] X-Frame-Options: DENY
- [ ] X-Content-Type-Options: nosniff
- [ ] Senha reset via email validado
- [ ] 2FA (optional pero recomendado)

### Database
- [ ] Todas as migrations rodadas e testadas
- [ ] Índices criados para queries frequentes
- [ ] Foreign keys com ON DELETE CASCADE/RESTRICT apropriado
- [ ] Backup automático configurado
- [ ] Disaster recovery testado
- [ ] Connection pool otimizado
- [ ] Timeout configurado (30s)
- [ ] Soft delete implementado onde necessário

### API Documentation
- [ ] Swagger/OpenAPI atualizado
- [ ] Todos os endpoints documentados
- [ ] Exemplos de request/response inclusos
- [ ] Erros documentados (400, 401, 403, 404, 422, 429, 500)
- [ ] Autenticação documentada
- [ ] Rate limits documentados
- [ ] Versionamento documentado

### Frontend
- [ ] Build otimizado (bundle analysis feito)
- [ ] Images comprimidas
- [ ] Lazy loading implementado
- [ ] PWA manifest (optional)
- [ ] Sitemap.xml gerado
- [ ] robots.txt configurado
- [ ] Meta tags SEO
- [ ] Open Graph tags

### Infrastructure
- [ ] Docker images otimizadas
- [ ] .dockerignore configurado
- [ ] Environment variables todas documentadas
- [ ] Secrets em variáveis de ambiente (não em .env.local)
- [ ] CI/CD pipeline verde
- [ ] Rollback plan documentado
- [ ] Disaster recovery plan testado

### Monitoring & Alerts
- [ ] Sentry configurado (error tracking)
- [ ] DataDog ou similar (APM)
- [ ] Logs centralizados (CloudWatch, ELK, etc)
- [ ] Alertas configurados para:
  - [ ] CPU > 80%
  - [ ] Memory > 80%
  - [ ] Error rate > 5%
  - [ ] Response time > 1s (p95)
  - [ ] Failed payments
  - [ ] Database connectivity
- [ ] Status page configurado
- [ ] Uptime monitoring (UptimeRobot, Datadog)

### Business
- [ ] Termos de serviço prontos
- [ ] Política de privacidade pronta
- [ ] LGPD compliance verificado
- [ ] Invoice gerado corretamente
- [ ] Email templates testados
- [ ] Webhook signatures validadas
- [ ] Refund policy implementada
- [ ] Chargeback handling implementado

---

## PARTE 2: DEPLOYMENT PRODUCTION

### 2.1 Infrastructure Setup

#### AWS (Recomendado)

```bash
# 1. RDS PostgreSQL
aws rds create-db-instance \
  --db-instance-identifier innexar-prod \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 15.4 \
  --allocated-storage 100 \
  --storage-type gp3 \
  --master-username admin \
  --master-user-password $(openssl rand -base64 32) \
  --multi-az \
  --backup-retention-period 30

# 2. ElastiCache Redis
aws elasticache create-cache-cluster \
  --cache-cluster-id innexar-cache \
  --engine redis \
  --cache-node-type cache.t3.micro \
  --engine-version 7.0

# 3. ECS (FastAPI)
# Create ECR repository
aws ecr create-repository --repository-name innexar-backend

# Build and push Docker image
docker build -t innexar-backend:latest workspace-backend/
docker tag innexar-backend:latest $(aws ecr describe-repositories --repository-names innexar-backend --query 'repositories[0].repositoryUri' --output text):latest
docker push $(aws ecr describe-repositories --repository-names innexar-backend --query 'repositories[0].repositoryUri' --output text):latest

# 4. CloudFront + S3 (Frontend)
# Create S3 bucket
aws s3 mb s3://innexar-portal-prod --region us-east-1

# Upload Next.js build
aws s3 sync portal-frontend/.next/static s3://innexar-portal-prod/_next/static/

# Create CloudFront distribution
aws cloudfront create-distribution \
  --origin-domain-name innexar-portal-prod.s3.us-east-1.amazonaws.com \
  --default-root-object index.html
```

#### Google Cloud (Alternative)
```bash
# Cloud SQL PostgreSQL
gcloud sql instances create innexar-prod \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --backup \
  --backup-start-time=02:00

# Cloud Run (FastAPI)
gcloud run deploy innexar-backend \
  --source=workspace-backend/ \
  --region=us-central1 \
  --memory=512Mi \
  --cpu=1

# Cloud Storage + CDN (Frontend)
gsutil mb gs://innexar-portal-prod
gsutil -m cp -r portal-frontend/.next/static gs://innexar-portal-prod/_next/static/
```

### 2.2 Environment Variables (Production)

```bash
# Backend
DATABASE_URL=postgresql://admin:XXXXX@rds-instance:5432/innexar_prod
REDIS_URL=redis://elasticache:6379/0
APP_ENV=production
API_URL=https://api.innexar.com.br
FRONTEND_URL=https://portal.innexar.com.br

JWT_SECRET=$(openssl rand -base64 32)
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24

STRIPE_SECRET_KEY=sk_live_XXXXX
STRIPE_PUBLIC_KEY=pk_live_XXXXX
STRIPE_WEBHOOK_SECRET=whsec_XXXXX

MERCADOPAGO_ACCESS_TOKEN=APP_USR_XXXXX
SENDGRID_API_KEY=SG.XXXXX
SENDER_EMAIL=noreply@innexar.com.br

AWS_ACCESS_KEY_ID=XXXXX
AWS_SECRET_ACCESS_KEY=XXXXX
AWS_S3_BUCKET=innexar-prod-uploads
AWS_REGION=us-east-1

SENTRY_DSN=https://XXXXX@sentry.io/XXXXX
CORS_ORIGINS=["https://portal.innexar.com.br"]

# Frontend
NEXT_PUBLIC_API_URL=https://api.innexar.com.br
NEXTAUTH_SECRET=$(openssl rand -base64 32)
NEXTAUTH_URL=https://portal.innexar.com.br
```

### 2.3 Database Migrations

```bash
# Backup antes de aplicar
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Apply migrations
cd workspace-backend
alembic upgrade head

# Verify
alembic current
```

### 2.4 SSL/TLS Certificates

```bash
# Using Let's Encrypt (certbot)
sudo certbot certonly --standalone \
  -d api.innexar.com.br \
  -d portal.innexar.com.br \
  --email admin@innexar.com.br

# Auto-renewal
sudo systemctl start certbot-renew.timer
```

### 2.5 Nginx Reverse Proxy

```nginx
# /etc/nginx/sites-available/innexar

upstream backend {
    server localhost:8000;
}

server {
    listen 80;
    server_name api.innexar.com.br;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.innexar.com.br;

    ssl_certificate /etc/letsencrypt/live/api.innexar.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.innexar.com.br/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=60r/m;
    limit_req zone=api_limit burst=100 nodelay;

    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
        proxy_connect_timeout 30s;
    }
}

server {
    listen 443 ssl http2;
    server_name portal.innexar.com.br;

    ssl_certificate /etc/letsencrypt/live/portal.innexar.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/portal.innexar.com.br/privkey.pem;

    root /var/www/innexar-portal;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /_next/static {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

### 2.6 Systemd Services

```bash
# Backend service
sudo tee /etc/systemd/system/innexar-backend.service > /dev/null <<EOF
[Unit]
Description=Innexar Backend API
After=network.target

[Service]
Type=notify
User=innexar
WorkingDirectory=/opt/innexar/workspace-backend
ExecStart=/opt/innexar/workspace-backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl start innexar-backend
sudo systemctl enable innexar-backend
```

---

## PARTE 3: HEALTH CHECKS & MONITORING

### 3.1 Health Check Endpoints

```python
# Backend - app/main.py

@app.get("/health")
async def health_check():
    # Check database
    try:
        async with get_db_session() as session:
            await session.execute("SELECT 1")
    except Exception as e:
        return {"status": "unhealthy", "database": "error", "error": str(e)}, 503
    
    # Check Redis
    try:
        await redis_client.ping()
    except Exception as e:
        return {"status": "unhealthy", "redis": "error", "error": str(e)}, 503
    
    return {
        "status": "healthy",
        "database": "ok",
        "redis": "ok",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/readiness")
async def readiness_check():
    # Called when container starts
    return {"ready": True}
```

### 3.2 Monitoring Stack

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin
    volumes:
      - grafana_data:/var/lib/grafana

  alertmanager:
    image: prom/alertmanager:latest
    ports:
      - "9093:9093"
    volumes:
      - ./alertmanager.yml:/etc/alertmanager/alertmanager.yml

volumes:
  prometheus_data:
  grafana_data:
```

### 3.3 Alert Rules

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - localhost:9093

rule_files:
  - 'alerts.yml'

scrape_configs:
  - job_name: 'backend'
    static_configs:
      - targets: ['localhost:8000']
  
  - job_name: 'postgres'
    static_configs:
      - targets: ['localhost:5432_exporter']
```

---

## PARTE 4: ROLLBACK PROCEDURE

### 4.1 Zero-downtime Deployment

```bash
#!/bin/bash
# deploy.sh

# 1. Build novo container
docker build -t innexar-backend:v2.0 workspace-backend/
docker push innexar-backend:v2.0

# 2. Start new container (porta 8001)
docker run -d -p 8001:8000 \
  --name innexar-backend-v2 \
  -e DATABASE_URL=$DATABASE_URL \
  innexar-backend:v2.0

# 3. Health check no novo container
for i in {1..30}; do
  if curl -f http://localhost:8001/health; then
    echo "New container is healthy"
    break
  fi
  sleep 2
done

# 4. Switch Nginx (update upstream)
# Direcionar tráfego para novo container

# 5. Manter container antigo por 5min (rollback rápido)
sleep 300

# 6. Se tudo ok, remover container antigo
docker stop innexar-backend-v1
docker rm innexar-backend-v1
```

### 4.2 Database Rollback

```bash
# Se migration falhar, reverter última
cd workspace-backend
alembic downgrade -1

# Ou reverter para versão específica
alembic downgrade <revision_id>
```

---

## PARTE 5: POST-DEPLOYMENT

### 5.1 Smoke Tests

```bash
#!/bin/bash

echo "Testing API Health..."
curl -f https://api.innexar.com.br/health || exit 1

echo "Testing Portal Access..."
curl -f https://portal.innexar.com.br || exit 1

echo "Testing Login Endpoint..."
curl -f -X POST https://api.innexar.com.br/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrong"}' || exit 1

echo "All smoke tests passed! ✅"
```

### 5.2 Performance Benchmarks

```bash
#!/bin/bash

# Load testing com Apache Bench
ab -n 1000 -c 100 https://api.innexar.com.br/health

# Core Web Vitals
curl https://pagespeed.googleapis.com/pagespeedonline/v5/runPagespeed \
  ?url=https://portal.innexar.com.br \
  &key=$GOOGLE_PAGESPEED_KEY
```

### 5.3 Incident Response Checklist

```
Wenn ein Incident auftritt:

[ ] 1. Alert erhalten (Sentry/DataDog/PagerDuty)
[ ] 2. Bestätige Production ist betroffen
[ ] 3. Wert Log/Stack Trace
[ ] 4. Dokumentiere Timeline
[ ] 5. Bestimme Root Cause
[ ] 6. Implementiere Quick Fix oder Rollback
[ ] 7. Verifiziere Lösung mit Smoke Tests
[ ] 8. Poste Mortem schreiben
[ ] 9. Preventive Measures implementieren
```

---

## PARTE 6: OPERATIONAL RUNBOOKS

### 6.1 Scale-up Database

```bash
# RDS Multi-AZ (High Availability)
aws rds modify-db-instance \
  --db-instance-identifier innexar-prod \
  --multi-az \
  --apply-immediately

# Upgrade instance class
aws rds modify-db-instance \
  --db-instance-identifier innexar-prod \
  --db-instance-class db.t3.small \
  --apply-immediately
```

### 6.2 Clear Cache

```python
# Dentro do app
from app.shared.services.cache import RedisCache

cache = RedisCache()

# Clear all
await cache.flush_all()

# Clear specific key
await cache.delete_pattern("subscription:*")
```

### 6.3 Manual Invoice Generation

```python
# Script para gerar invoices manualmente se cron falhar
from app.modules.subscriptions.services import InvoiceService

async def manual_invoice_generation():
    subscriptions = await SubscriptionRepository.find_many(
        status='active',
        current_period_end__date=datetime.today()
    )
    
    for sub in subscriptions:
        await InvoiceService.create_draft_invoice(sub.id)
        print(f"Invoice created for {sub.id}")
```

---

## ✅ DEPLOYMENT CHECKLIST FINAL

- [ ] Backend deployed e healthy
- [ ] Frontend deployed e acessível
- [ ] Database migrations rodadas
- [ ] Todos endpoints testados
- [ ] SSL certificates válidos
- [ ] Monitoring ativo
- [ ] Alerts funcionando
- [ ] Backups rodando
- [ ] Documentation atualizada
- [ ] Team notificado
- [ ] Smoke tests passaram
- [ ] Performance dentro dos limites
- [ ] Nenhum erro em Sentry

---

**Pronto para Production! 🎉**
