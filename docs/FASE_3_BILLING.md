# FASE 3 — Ciclo financeiro completo (concluída em 2026-09-14)

## BILLING CORE

- Regra preservada: explícito → fallback moeda (BRL→MP, USD→Stripe); nada por domínio.
- `capabilities.py`: `supports_pix/boleto/card/subscription/refund` por provider;
  `available_methods(provider, currency)` — Portal só exibe compatíveis.

## PIX / BOLETO (oficial MP, provado ao vivo)

- `POST /portal/invoices/{id}/pay-pix`: QR + copia-e-cola + expiração (idempotente).
- `POST /portal/invoices/{id}/pay-boleto`: barcode + ticket URL (exige CPF/CNPJ +
  endereço; erro orienta completar cadastro). Rate limit 5/min.
- Ao vivo: PIX R$1 (QR/copy/exp) e boleto R$5 (barcode/ticket) criados e
  CANCELADOS; tudo limpo. PIX rejeita e-mail inválido; boleto exige mínimo e endereço.

## MP RECURRING / STRIPE

- Preapproval plans já existiam — preservados e reutilizados.
- Stripe: subscriptions/checkout/billing-portal intactos + `refund_charge`.

## INVOICE / PAYMENT / ATTEMPTS

- Estados += `past_due/refunded/void` (aditivo). Invoice separada de tentativas;
  histórico preservado (`method/amount/expires_at/paid_at/failure_code/meta` sem
  dados de cartão). `period_key` único (scheduler não duplica).

## CONTRACT BILLING / SCHEDULE

- Contract: `billing_interval/monthly…/billing_day/due_days/timezone/credit_balance`.
- Geração por contrato (setup `one_time` só na 1ª fatura; crédito aplicado;
  timezone do contrato). `billing_generate_invoice(s)` (subscriptions + contratos).

## SCHEDULER (cron host + lock PG)

`app/jobs/billing_cron.py`: generate/contracts/remind/overdue/reconcile/all.
`/etc/cron.d/innexar-billing` instalado.

## NOTIFICATIONS (PT/EN, 13 templates)

`notify_templates.py` + in_app (+email quando configurado) via NotificationService;
CLI envia direto. Lembretes antes/depois sem duplicar (`reminders_sent`).

## GRACE/SUSPENSION/REACTIVATION

Policy `contract>product>org>global>defaults` (7/3,1/1,3,5/14 dias default).
past_due → avisos → suspensão (desabilita caixas, preserva dados; só notifica se
suspendeu algo) → pagamento reativa tudo (hook no `mark_invoice_paid`, logo vale
p/ webhook/portal/manual). Cancelamento: status + (Stripe cancela sub externa);
purge destrutivo NÃO implementado de propósito.

## RECONCILIATION

Compara pendentes com MP/Stripe oficial; corrige paid/failed; nunca depende só
de webhook. Ao vivo: 2 sessions Stripe consultadas, 0 divergências.

## MTA-STS: PENDENTE (decisão documentada)

Policy `testing` com `mx: my.mailbux.com` (errado) hospedada no CNAME mailbux
(37.27.115.123) — fora do nosso controle. Removidos 12 SRV mortos
(`_imap/_pop3*`/`_caldavs`/`_carddavs`/`_jmap` → mailbux, inclui portas 143/110).
Enforce exige policy própria + mx certo: Fase futura com monitoramento.

## TOUFIC CERT: PENDENTE (caminho provado)

IMAP em `mail.touficsleiman.com.br` serve CN `mail.innexar.com.br` (mismatch).
`obtain-certs.sh` usa token da conta errada. Dry-run staging com token Dev:
SUCESSO p/ `mail.touficsleiman.com.br` (prod intacto). Workaround oficial:
configurar clientes com `mail.innexar.com.br`. Emissão prod = 1 comando quando
houver uso (só `contato@` existe; nada inventado).

## TESTS (28 verdes sqlite + ao vivo)

Unit: policy, capabilities, past_due/remind/suspend/reactivate, geração
idempotente, PIX/boleto mapeado (stub), refund erro, webhooks (duplicado,
fora-de-ordem, desconhecido, refund, falha) + Fase 1/2 intactos.
Ao vivo: PIX/boleto R$1/R$5 + cancel, ciclo atraso→suspensão→reativação,
IDOR mantido, bateria 10 URLs OK.
Bugs achados e corrigidos: naive/aware sqlite, suspend notifica sem suspender,
falha tardia reabria fatura paga, ordem do branch MP paid/failed.
Suíte legada vermelha prévia inalterada (fora do escopo, documentado na Fase 1).

## PENDÊNCIAS

1. Revogar PAT GitHub. 2. Limpar ~400 customers de teste históricos
   (`cleanup-test-customers` existe; decidir antes). 3. Cert toufic sob demanda.
4. MTA-STS enforce futuro. 5. Preço USD do e-mail (sem valor definido).

## FASE 4 recomendada — INNEXAR CLOUD / HOSTING

Reutilizar Customer/Contract/Service/BillingPolicy/jobs/notificações:
Hestia como provider (`HostingProvider` espelhando `MailProvider`), planos de
hospedagem no catálogo, provisionamento no pagamento, suspensão por inadimplência
via lifecycle existente, painel de recursos (disco/banda) no portal.
