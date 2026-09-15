# PRODUCTION MAP — pós-switch (2026-09-15)

| DOMAIN | TRAEFIK ROUTER | SERVICE | CONTAINER | APP | MONOREPO PATH |
|---|---|---|---|---|---|
| workspace.innexar.app | usa-workspace-app | workspace-app | innexar-usa-workspace-app:3000 | workspace | apps/workspace |
| panel.innexar.app | usa-portal | portal | innexar-usa-portal:3000 | portal | apps/portal |
| portal.innexar.com.br | usa-portal | portal | idem | portal | apps/portal |
| innexar.app | usa-website | website | innexar-usa-website:3000 | website-us | apps/website-us |
| innexar.com.br | br20-website | website | innexar-brasil-2-0-website:3003 | website-br | apps/website-br |
| api3.innexar.app | usa-api | api | innexar-usa-workspace-backend:8000 | api | services/api |
| api.innexar.com.br | usa-api-br | api | idem | api | services/api |
| mail.* / webmail | innexar-mail-* | mail | stack mail | mail | (infra global, fora do core) |

DB: `innexar-usa-workspace-postgres` / `innexar_workspace` @ r5s6t7u8v9 (intocado).
