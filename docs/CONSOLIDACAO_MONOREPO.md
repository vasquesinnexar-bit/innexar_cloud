# CONSOLIDAÇÃO MONOREPO — innexar-plat/innexar_cloud (2026-09-14/15)

## SOURCE REPOS / ORIGINAL PATHS

- `/srv/innexar/production/innexar-usa` (remote `innexar-plat/innexar-usa.git`,
  branch `main` @ `248dfcc`) → apps + api + CI base.
- `/srv/innexar/production/innexar-brasil/ineexar-brasil-2.0/innexar-br-2.0`
  (remote `innexar-plat/innexar-br-2.0.git`, `main` @ `39b281b`) → site BR.
- Repos remotos antigos MANTIDOS (archive futuro); nada deletado no GitHub.

## ACTIVE PROJECTS (mapeamento)

| Origem | Destino | Produção |
|---|---|---|
| `innexar-usa/innexar-workspace-app` | `apps/workspace` | workspace.innexar.app |
| `innexar-usa/innexar-portal` | `apps/portal` | panel + portal |
| `innexar-usa/innexar-website` | `apps/website-us` | innexar.app |
| `innexar-br-2.0/innexar-br-website` | `apps/website-br` | innexar.com.br |
| `innexar-usa/innexar-workspace` (compose+backend) | `services/api` | api3 + DB |

Pacotes npm renomeados `@innexar/*` (exceto `novo-site`→`@innexar/website-br`).
Identificadores infra (imagens, containers, networks, volumes, routers)
PRESERVADOS para switch sem downtime.

## REMOVED LEGACY (não migrado)

- `framwork/` (vazio), `legalize-landing/` (demo sem tráfego/container),
  `infra/observability` (symlink p/ stack global), skillstripe (já removido antes).
- Build artifacts, `.env` (→ `/srv/innexar/secrets/`), node_modules, `.next`.
- `docker-compose.override.yml` NÃO migrados (dev-only; ver `.gitignore` futuro).
- `portal-cliente/backend/workspace-app` BR: já removidos na Fase 4.

## CLIENT PROJECTS EXTRACTED

- `projetocorepilates-main` (repo próprio `projetocorepilates.git`, compose com
  `name:` explícito) movido para `/srv/innexar/production/clients/core-pilates/`
  sem restart (containers intactos, compose reconhece, cron de backup atualizado).
- Demais clients já estavam em `production/clients/`. Nada de cliente no core.

## NEW STRUCTURE

`apps/{workspace,portal,website-us,website-br}`, `services/api`,
`packages/{ui,types,config,utils}` (READMEs; sem refactor — Fase 4 decidiu),
`infra/{docker,traefik,scripts,observability}` (docs + compose api),
`docs/` (+`archive/`), `.github/workflows/ci.yml`, `Makefile`, README,
`.gitignore`, `.gitleaks.toml`. Sem npm workspaces (apps independentes, decisão).

## CI / SECRETS / DOCKER / TRAEFIK

- CI com path-filter por app, typecheck estrito (4/4 passam), pytest+ruff+black,
  `alembic heads`, gitleaks. CD: manual (sem deploy automático).
- Segredos: `/srv/innexar/secrets/*.env` (0600) + symlinks `.env` (gitignored);
  gitleaks verde; 4 placeholders auditados em allowlist documentada.
- Traefik: hosts oficiais preservados; labels idênticas; nenhuma rota legada.

## DEPLOY / PRODUCTION MIGRATION

Switch por componente (API→workspace→portal→site US→site BR), `up -d --build`
in-place (mesmo `name:`, mesmos containers/networks/volumes). Banco NUNCA
tocado (r5s6t7u8v9). Detalhes e evidências abaixo em "switch log".

## TESTS

- Backend: 71 unit verdes (sqlite) + E2E ao vivo fases anteriores.
- Frontends: 4 builds npm + 5 imagens Docker a partir dos novos paths.
- Bateria 10 URLs após cada switch (registrada no relatório de sessão).

## ROLLBACK

Código: checkouts antigos intactos + backup
`/srv/innexar/backups/pre-monorepo-consolidation/2026-09-14/` (tarballs 40MB,
secrets 600, manifests git). Switch: `up -d` a partir do path antigo
rebuilda/restaura. Banco: intocado (sem rollback de dados necessário).

## OLD LOCAL REPOS REMOVED

PENDENTE (aguardando push + checklist §98). NÃO removidos nesta passada.

## PENDING

Push bloqueado (sem credencial write p/ innexar-plat neste servidor);
preços `managed-hosting`; ~400 customers de teste; cert toufic; MTA enforce;
revogar PAT (operador).
