# infra/docker — deploy de produção

Cada app mantém `Dockerfile` + `docker-compose.yml` próprios (padrão herdado e
funcional). O deploy é por componente via compose no servidor + Traefik.

- Backend: `services/api` (imagem `innexar-usa-workspace-backend`, `:8000`).
- Frontends: `:3000` (workspace, portal, website-us), `:3003` (website-br).
- Banco Postgres compartilhado — nunca recriar (`DATABASE_URL` do ambiente).
- Não commitar `docker-compose.override.yml` (dev local; ver `.gitignore` futuro).
- Nomes de imagens/containers preservados para não quebrar o deploy atual.
