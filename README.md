# Innexar Cloud — plataforma única (workspace, portal, sites, API)

Monorepo oficial da plataforma Innexar: `innexar-plat/innexar_cloud`.

## Apps e serviços

| Diretório | O quê | Produção |
|---|---|---|
| `apps/workspace` | Backoffice staff (Next.js) | workspace.innexar.app |
| `apps/portal` | Portal do cliente PT/EN/ES (Next.js) | panel.innexar.app + portal.innexar.com.br |
| `apps/website-us` | Site comercial US (Next.js) | innexar.app |
| `apps/website-br` | Site comercial BR (Next.js) | innexar.com.br |
| `services/api` | API central FastAPI + Alembic + pytest | api3.innexar.app |

Projetos de clientes moram em `/srv/innexar/production/clients/` (fora daqui).

## Desenvolvimento

```bash
make install        # instala deps dos 4 frontends + backend (venv)
make dev            # sobe tudo em modo dev (compose.dev)
make test           # testes de todos os apps
make lint           # lint de todos os apps
make build          # build de produção dos 5 componentes
```

Requer Node 20 e Python 3.12.

## Produção (servidor)

Cada app tem `Dockerfile` + `docker-compose.yml` próprios; o deploy é por
componente via compose + Traefik (ver `infra/docker/`). Banco Postgres
compartilhado — **nunca recriar** (`DATABASE_URL` do ambiente).

```bash
make prod-status    # containers/imagens/health
```

## Segredos

`.env` **nunca** entra no Git (só `.env.example`). Em produção, variáveis vêm
do ambiente/compose do servidor (ver `infra/docker/README.md`).

## CI/CD

`.github/workflows/ci.yml` com path-filter por app, typecheck estrito,
pytest + ruff/black na API, validação Alembic e gitleaks. CD: manual
aprovado (ver workflow `cd.yml` quando ativado).

## Docs

`docs/` — arquitetura, fases, mapas, consolidação. Banco de clientes de
teste históricos: tarefa separada (não limpar aqui).
