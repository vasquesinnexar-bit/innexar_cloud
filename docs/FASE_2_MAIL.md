# FASE 2 — Professional Email integrado (concluída em 2026-09-14)

## MAIL SERVER (inventário real)

- Software: `docker-mailserver` (`innexar-mailserver`, healthy). Sem banco SQL —
  contas em arquivos (postfix-accounts.cf); sem API HTTP.
- SMTP 25/587/465, IMAP 993/143; DKIM p/ 4 domínios; `mail.crt` SEM touficsleiman.
- Caixas: 6 innexar.app, 5 innexar.com.br, 1 touficsleiman (`contato@`, 7K).
- Sem primitiva suspender: disable = `restrict add send+receive` (reversível).

## INTEGRAÇÃO ESCOLHIDA: C — CLI segura via `docker exec`

Backend NÃO tinha acesso ao Docker; adicionado mount `docker.sock` +
`/usr/bin/docker` (mesmo padrão do mail-admin) + env `MAIL_CONTAINER`.
Ranking: API oficial (inexiste) < CLI segura (adotada) < banco direto (inviável —
arquivos planos). Frontend nunca fala com o mailserver.

## MAIL PROVIDER (`app/modules/mail/provider.py`)

`DockerMailserverProvider`: list/create/update/delete, quota set/del,
disable/enable idempotentes (checa `restrict list` antes — `add` falha se já
restrito), aliases, `list_domains` (contas + dirs DKIM). Senhas nunca logadas.

## PRODUCT / PRICE (catálogo, sem hardcode)

- `professional-email` / “E-mail Profissional”, category `email`,
  `provisioning_type=email_mailbox`, org `innexar-br`.
- Prices BRL: Setup R$100 (`one_time`) + R$25/mailbox/month (`recurring`,
  `unit=mailbox`). USD: estruturado, não criado (sem valor comercial definido).

## SERVICE / DOMAIN / MAILBOX

- `mail_services` (service_type, status, activated/suspended), `mail_domains`
  (tenant-isolado, verificado contra o servidor), `mail_mailboxes` (espelho, SEM
  senha), `mail_provisioning_jobs` (pending/processing/completed/failed,
  idempotency_key única, segredo limpo após concluir).
- Migration `o2p3q4r5s6t7`. Delete de Customer: desativa caixas reais (preserva
  dados!) + apaga em cascata DB.

## CONTRACT INTEGRATION

ContractItem (produto e-mail, qty, snapshot) → entitlement
contratado/usado/disponível + preço de referência (plano mensal recorrente).
Itens sem produto e-mail NÃO contam (estrito de propósito).

## PORTAL (`/[locale]/services/email`, cards, mobile-first)

Plano/uso/cobrança, webmail (URL oficial, sem SSO gambiarra), nova conta,
limite→solicitar adicional (mostra preço), senha/desativar por conta, guia
IMAP/SMTP real (mail.{domínio} 993 SSL / 465 SSL ou 587 STARTTLS). Moeda por fatura.

## WORKSPACE (tela do cliente → E-mail Profissional)

Contratadas/em uso/preço, lista com quota/status, criar, senha, ativar/desativar,
sincronizar domínio. Billing provider segue só via API (staff).

## PROVISIONAMENTO

API → job → provider (nunca bloqueia HTTP no técnico). Pagamento confirmado
(webhook/portal pay/mark-paid) → `trigger_mail_provisioning_if_needed` (mesmo
ponto do Hestia, sem quebrar) → job idempotente (pula se mailbox já existe).

## BILLING conta adicional (§29)

Limite cheio → request cria ContractItem + Invoice pendente + mailbox
`pending_payment` + job com senha **criptografada** (ENCRYPTION_KEY configurada
no backend). Pagamento → ACTIVE. Nada cobrado/criado antes da confirmação.
Dentro do plano, cria direto sem cobrança.

## TOUFIC: PENDENTE (parcial)

- DNS: completo e verificado (A/MX/SRV/SPF/DKIM/DMARC). Mailbox `contato@` existe.
- Cert: `mail.crt` SEM SAN touficsleiman — `obtain-certs.sh` usa token da conta
  errada (Vinicius) e falharia DNS-01. Workaround: configurar clientes com
  `mail.innexar.com.br` (cert válido). Emissão combinada fica p/ quando houver
  caixas em uso (nenhuma conta documentada para criar — nada inventado).

## DNS MAILBUX: limpo parcial

- Removidos 12 SRV obsoletos (`_imap/_pop3/_pop3s/_caldavs/_carddavs/_jmap` →
  my.mailbux.com, כולל portas inseguras 143/110). MX já era nosso; relay vazio.
- MANTIDOS `mta-sts` + `_mta-sts` + `_smtp._tls`: policy `mode: testing`
  (sem enforcement) porém com `mx: my.mailbux.com` errado — remover muda
  entregabilidade; corrigir (mx certo + enforce) fica p/ Fase 3 com monitoramento.

## TESTES

- Unit (sqlite, 15 verdes): CRUD/limite/duplicata/tenant/senha/quota/disable/
  sync/jobs-idempotência + resolver + contracts.
- E2E ao vivo (limpeza total): fluxo gratuito, fluxo pago (invoice R$25 →
  mark-paid → ACTIVE), IDOR (404/404/lista isolada), credenciais pós-pagamento.
- Bugs achados pelos testes e corrigidos: cascade contracts, cascade mail no
  delete, restrict idempotente, preço mensal vs setup, delete preservando dados.
- Bateria: 10 URLs OK. Webhooks existentes intocados e registrados.

## PENDÊNCIAS

1. Revogar PAT no GitHub (fora do disco; segue válido até revogação).
2. Cert touficsleiman + caixas documentadas.
3. MTA-STS correto + PIX/boleto + recorrência MP (Fase 3).
4. Suíte unit vermelha prévia (fora do módulo mail — ver FASE_1).

## FASE 3 recomendada (ordem)

1. `billing_provider` override já pronto — expor teste BR→Stripe/US→MP.
2. PIX/boleto via Bricks + `preapproval_plan` recorrente.
3. MTA-STS correto (mx nosso) + monitoramento de entregabilidade.
4. Notificações (fatura paga/atrasada, mailbox provisionada) + ciclo
   past_due→grace→suspended (job disable) →cancelled (Fase 2 já tem disable).
5. Cert touficsleiman quando houver uso real.
