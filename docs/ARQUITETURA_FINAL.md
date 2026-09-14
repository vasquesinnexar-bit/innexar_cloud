# ARQUITETURA FINAL — pós-limpeza 2026-09-14

```
                    workspace.innexar.app (:3000)
                    innexar-usa-workspace-app (Next)
                                │
                                ▼
                    api3.innexar.app (:8000)
              innexar-usa-workspace-backend (FastAPI)
              DB: innexar-usa-workspace-postgres/innexar_workspace
              Billing: Stripe + Mercado Pago (BRL→MP, USD→Stripe)
                                │
                ┌───────────────┼───────────────┐
                ▼                               ▼
  panel.innexar.app                portal.innexar.com.br
  innexar-usa-portal :3000 (Next, /en)   MESMO container (/pt)
```

- **Workspace oficial**: `innexar-usa-workspace-app` + backend + `innexar-usa-workspace-postgres`.
- **Portal oficial (único)**: `innexar-usa-portal` serve `panel` + `portal` (i18n por rota).
- **API oficial**: `innexar-usa-workspace-backend` (`api3`; `api.innexar.com.br` sem conflito).
- **Sites**: US `innexar-usa-website` :3000 (`innexar.app`); BR `innexar-brasil-2-0-website`
  :3003 (`innexar.com.br`), ambos apontando p/ api3 + portal correto.
- **Mail**: `innexar-mailserver` (+ Roundcube, mail-admin, autoconfig).
- Borda: Traefik :80/:443; sem Nginx/Apache de sistema (mascarado).

Regras: gateway por cliente/contrato (nunca por domínio); um banco por domínio de
negócio; sem routers duplicados; sem stack legada em execução.
