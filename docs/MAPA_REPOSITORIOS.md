# MAPA REPOSITÓRIOS — 2026-09-14

## ACTIVE (produção)

| Checkout local | Repo / branch | Serve |
|---|---|---|
| `production/innexar-usa` | innexar-usa.git / main | workspace-app, backend, portal, site US |
| `production/innexar-brasil/.../innexar-br-2.0` | innexar-br-2.0.git / main | site BR (enxuto — só `innexar-br-website`) |
| `production/prospector-ai` | prospectiai.git / feat/sidebar-and-sonar-fixes ⚠️ | precisionia.com.br (branch não-main em prod) |
| `production/clients/*` | repos próprios / main-master | sites dos clientes |
| `infra/mail/mail-admin` | (build local, sem repo próprio) | mailadmin |

## LEGACY removido desta passada

- Serviços `portal-cliente`, `backend`, `workspace-app`, `db` do stack `innexar-br-2.0`
  (containers, volumes, routers, pastas-fonte). Repo GitHub mantido; checkout enxuto.
- Detalhes em `LEGADO_REMOVIDO.md`; backup em
  `/srv/innexar/backups/legacy-retirement/2026-09-14/`.

## UNKNOWN / fora do escopo (não tocam na produção auditada)

- `production/innexar-brasil-meta` (innexar-websitebr.git): só templates nginx + rules
  de IDE, sem compose/container — arquivo morto, sem tráfego.
- `production/clients/navaro`: checkout em branch `codex/fix-…` (não-main) + **token
  GitHub embutido na URL do remote — REVOGAR o PAT e trocar por SSH/deploy key**.
- `demos/*`, `archive/canceled-clients/*`: fora de produção.

⚠️ **Segurança**: encontrado PAT GitHub (`ghp_…`) no remote do checkout navaro.
Revogar em GitHub → Settings → Developer settings → Personal access tokens.
