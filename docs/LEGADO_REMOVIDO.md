# LEGADO REMOVIDO — 2026-09-14

## Validação prévia (resumo)

| Pergunta | Portal legado | Backend legado | Banco legado |
|---|---|---|---|
| Recebe tráfego? | NÃO (0 hits Traefik) | Só bots (5 hits scanner) | N/A |
| Cron? | NÃO | NÃO | N/A |
| Webhook real? | NÃO | NÃO (Stripe/MP usam host que permanece) | N/A |
| Chamado por outro serviço? | NÃO | NÃO (site BR usa api3) | NÃO |
| Dado exclusivo? | NÃO | NÃO | NÃO — banco VAZIO |
| DNS direto? | NÃO (sombreado) | NÃO (dividia host) | N/A |
| Script depende? | NÃO | NÃO | N/A |

## Removido

- **Containers**: `innexar-brasil-2-0-portal`, `innexar-brasil-2-0-backend`, `innexar-brasil-2-0-db`
- **Volumes**: `innexar-brasil-2-0_db_data`, `innexar-brasil-2-0_settings_data`
- **Routers Traefik**: `innexar-br20-portal`, `innexar-br20-api` (tráfego de
  `api.innexar.com.br` 100% em `usa-api-br`; `portal.innexar.com.br` 100% em `usa-portal`)
- **Compose** `innexar-br-2.0/docker-compose.yml`: serviços `db`, `backend`,
  `portal-cliente`, `workspace-app` + volumes removidos (só `innexar-br-website` permanece)
- **Pastas**: `portal-cliente-innexarbr/`, `workspace-backend-innexarbr/`,
  `workspace-app-innexarbr/`, `skillstripe/` (vazia)
- **Config**: `docker-stacks.conf` (linha innexar-brasil sem `-f` legado);
  `.env`/`.env.example` sem chaves de backend/db; `.bak` do traefik realocados
- **Banco**: `innexar_workspace` legado removido com o container (estava vazio)

## Backup

`/srv/innexar/backups/legacy-retirement/2026-09-14/` (dump, schema, compose original,
envs, tarballs, MANIFEST.txt).

## Testes realizados

Com legados parados e após remoção: workspace 307, sites/portais/APIs 200,
webmail/mailadmin 200, login inválido 401. Routers verificados nos logs do Traefik.
