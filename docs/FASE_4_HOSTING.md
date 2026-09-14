# FASE 4 — INNEXAR CLOUD / HOSTING (concluída em 2026-09-14)

## RECON (somente leitura)

- 1 host Docker; ~50 containers; compose por stack (`name:` como identidade).
- Descoberta: apps cliente (ag-p-outdoor, pilates, toufic, heavyclean, dhv),
  platform, observability, mail, USA. Heavy-clean fora de `/srv` (`/root/projetos`).
- Achado-chave: containers web de clientes têm código **baked, sem mounts** —
  file manager atua onde há root vinculado (host bind ou container fs);
  resto é metadata real (nada mockado).
- Deploy: `docker compose build/up` por stack; backup: só prospector/pilates
  tinham cron; logs via Loki/Promtail; health via Traefik + healthchecks.

## HOSTING SERVER / SERVICE

- `hosting_servers` (auto-registro `primary`; fix: lookup por nome estável, pois
  hostname do container muda a cada recreate) + `hosting_services` (link
  admin-only: customer, container, root_path, path_mode, domain, env,
  limites, status, deploys/backups timestamps).
- Migration `q4r5s6t7u8v9` + fix `r5s6t7u8v9w0`; 13 perms `hosting.*` seedadas.

## HOSTING PROVIDER / DOCKER PROVIDER

- `DockerHostingProvider`: inspect/status (online/offline/restarting/degraded…),
  metrics one-shot (CPU/RAM/rede/uptime, cache 30s), logs com redaction
  (bearer/key/password/secret/token/cookie), restart/start/stop idempotentes,
  files via `docker cp` + comandos fixos, `readlink -f` pós-escrita.
- Segredos nunca no frontend; sem socket/API/SSH expostos.

## PRODUCT/PRICE

- `managed-hosting` (category `hosting`) criado, SEM prices (sem valores
  comerciais definidos — NÃO inventados). Preços pendentes de decisão comercial.

## SERVICE LINKING

- Workspace → Sites → Descoberta (50 containers reais) → Vincular (customer +
  root + domínio) com AuditLog. Sem auto-link por nome.

## METRICS / LOGS / SSL / DEPLOY / DATABASE

- Reais: `docker stats`, `docker logs --tail` (search/copy/refresh, máx 1000),
  TLS ao vivo (issuer/validade/dias), DNS (IPs + points_here), deploy
  (StartedAt/imagem/git do root host), DB (engine/container/status do projeto).
- Sem polling agressivo (cache 30s; logs sob demanda).

## FILES / PATH SECURITY / REVISIONS / BACKUPS

- Contenção `realpath`, anti `..`, anti double-encoding, anti null byte,
  blocklist (`.env`, Dockerfile, compose, keys, secrets, `.git/.ssh`),
  extensões de edição permitidas, teto 2MB.
- Revisão ANTES de editar (DB ≤100KB), diff unificado, restore auditado.
- Backups async (jobs + worker cron 5min), retenção por payload (default 5),
  restore admin-only. Upload/download com teto.

## BILLING LIFECYCLE

- Reuso integral: suspend (docker **stop** reversível, preserva tudo) e
  reactivate (start) no `suspend_overdue`/`reactivate_customer`; provado ao
  vivo (running→exited→running). Notificações `hosting_*` PT/EN.
- Purge destrutivo NÃO implementado de propósito.

## SUSPENSION / REACTIVATION / NOTIFICATIONS / RBAC / AUDIT

- 13 permissões; portal com feature flag `hosting` + entitlement ativo;
- restart cliente com rate limit 5/min + confirmação; start/stop admin;
- 14 eventos de audit; IDOR 404 em overview/files/restart.

## WORKSPACE / PORTAL / MOBILE

- Workspace: Innexar Cloud (Overview/Sites/Servers/Backups) + seção na ficha
  do cliente (Fase 2 intacta). Portal: Meus Serviços → Hospedagem (lista +
  detalhe com 5 tabs), cards mobile-first, skeletons/empty/error states,
  editor com Ctrl+S + unsaved warning.

## TESTS / E2E / BUGS

- Unit (sqlite): 43 paths (traversal, symlink, roundtrip) + API (link, 502,
  IDOR) + 28 fases anteriores = 71 verdes.
- E2E real (fixture nginx dedicada, removida após): link, overview online +
  metrics, files CRUD, revision+diff, backup job, restart, ciclo
  past_due→suspend(exited)→paid→running, IDOR, cleanup total (0 restos).
- Bugs achados e corrigidos: `normalize(".")`, server lookup por hostname
  volátil, `HostingError` duplicada, import `Server` faltante no nav (quebrava
  TODAS as páginas do portal — bundle stale mascarou), TS strict no workspace,
  labels `docker ps` como string.

## PENDÊNCIAS

1. Revogar PAT GitHub. 2. Preços do `managed-hosting` (decisão comercial).
3. ~400 customers de teste históricos. 4. Cert toufic + MTA enforce (Fase 3).
5. Monaco como upgrade do editor; restore de backup pelo cliente (só admin hoje).

## FASE 5 recomendada — OPERAÇÃO E ENDURECIMENTO

- Preços hosting + geração recorrente por contrato de hospedagem.
- Alertas preditivos (disco >80%, SSL <14d automático, offline → página + e-mail).
- Restore pelo cliente com confirmação forte; file manager no workspace-staff.
- MTA enforce + cert toufic; limpeza dos customers de teste; Monaco.
