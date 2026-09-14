# MAPA DOMÍNIOS — 2026-09-14 (pós-limpeza)

| HOST | ROUTER | SERVICE | CONTAINER:PORTA |
|---|---|---|---|
| workspace.innexar.app | usa-workspace-app | usa-workspace-app-service | innexar-usa-workspace-app:3000 |
| app.innexar.com.br | usa-workspace-app | idem | idem |
| api3.innexar.app | usa-api | usa-api-service | innexar-usa-workspace-backend:8000 |
| api.innexar.com.br | usa-api-br | usa-api-br-service | idem (ÚNICA origem) |
| panel.innexar.app | usa-portal | usa-portal-service | innexar-usa-portal:3000 |
| portal.innexar.com.br | usa-portal | idem (ÚNICA origem) | idem |
| innexar.app / www | usa-website | usa-website-service | innexar-usa-website:3000 |
| innexar.com.br / www | innexar-br20-website | innexar-br20-website-service | innexar-brasil-2-0-website:3003 |
| mail/webmail/mailadmin/autoconfig… | innexar-mail-* | mail-* | stack innexar-mail |

DNS (Cloudflare): todos A → 173.212.248.236; site/portal/panel/workspace com proxy;
mail/autoconfig/autodiscover/webmail DNS-only. SSL: Traefik LE (DNS-01 CF / TLS-ALPN).
Sem hosts duplicados entre routers.
