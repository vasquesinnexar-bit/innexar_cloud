# IDEIA — Portal multi-região + Workspace único + Mail integrado

Documento de intenção (brief do fundador). Descoberta em andamento; nenhum código
será alterado antes da auditoria (`AUDIT_ECOSSISTEMA.md`).

## URLs oficiais

| Papel | URL |
|---|---|
| Workspace interno | https://workspace.innexar.app/ |
| Site BR | https://innexar.com.br/ |
| Portal BR | https://portal.innexar.com.br/pt/login |
| Site US | https://innexar.app/en |
| Portal US | https://panel.innexar.app/en/login |

## Pergunta central da descoberta

`panel.innexar.app` e `portal.innexar.com.br` são o mesmo projeto? Mesmo deploy?
Mesmo backend/banco/auth/modelo Customer-Organization-User? Fazer o mesmo para
sites e Workspace. Não assumir — descobrir na infraestrutura.

## Operações comerciais

**BRASIL** — site `innexar.com.br`, portal `portal.innexar.com.br`, idioma PT,
moeda BRL, gateway principal Mercado Pago (PIX, boleto, cartão, recorrência).

**ESTADOS UNIDOS** — site `innexar.app`, portal `panel.innexar.app`, idioma EN,
moeda USD, gateway principal Stripe (cartão, subscriptions, invoices, links).

## Workspace único (sem workspace-BR/workspace-US)

Backoffice central em `workspace.innexar.app`. Cada cliente tem no mínimo:
`country`, `locale`, `currency`, `billing_provider`, empresa, dados fiscais,
serviços, contratos, subscriptions, invoices, pagamentos.

Ex.: BR → `country=BR, locale=pt-BR, currency=BRL, billing_provider=mercado_pago`;
US → `country=US, locale=en-US, currency=USD, billing_provider=stripe`.

## Portal multi-região

Ideal: backend compartilhado (Workspace → API central → portais BR/US), com
diferenças só de idioma/moeda/gateway/documentos/impostos/serviços — via
`tenant/region/country/domain/locale`, sem duplicar lógica de negócio.

## Portal do cliente (central do cliente)

Login; empresa; serviços contratados (sites, domínios, hospedagem, e-mails);
contratos; faturas; pagamentos; histórico financeiro; suporte; contratar adicionais.

## Mail integrado ao portal (sem portal separado de e-mail)

Portal → Meus Serviços → E-mail Profissional → Contas: domínio, plano, incluído
vs usado, contas existentes, status, webmail, configuração (celular/Outlook/Gmail),
alterar senha, criar conta.

## Cobrança de e-mail como produto (exemplo, editável no Workspace sem deploy)

Setup R$ 100 + R$ 25/mês por conta. Modelar como Product/Price (BR e US futuro).

## Fluxos

- **BR**: workspace cria cliente BR → serviço e-mail 3 contas → calcula setup R$100
  + 3×R$25 → Mercado Pago → cliente paga no portal (PIX/boleto) → webhook ativa →
  provisiona contas.
- **US**: mesmo workspace → cliente US (`currency=USD, billing_provider=stripe`)
  → Stripe customer/subscription/invoice → paga no `panel` → webhook atualiza.

## Regra de ouro

Gateway NÃO depende do domínio acessado. A regra financeira mora no
cliente/contrato (`Customer.billing_provider` / `Organization` / `Contract`).
Domínio serve só como preferência de interface.

## Desenho alvo

WORKSPACE (`workspace.innexar.app`) → API central → Customers / Services
(Mail, Sites) / Billing (Mercado Pago, Stripe) → Portal BR (`portal.innexar.com.br`,
PT-BR, BRL) + Portal US (`panel.innexar.app`, EN-US, USD).

Cliente BR vê ex.: "Site ativo / Hospedagem ativa / 3 contas de e-mail R$75/mês /
próxima cobrança 10/10/2026"; americano vê a mesma estrutura em EN/USD.
Preparado para novos países sem novo sistema.

## Auditoria obrigatória antes de implementar

Ver `AUDIT_ECOSSISTEMA.md`: workspace, portal BR, portal US (é o mesmo? backend?
banco?), sites, mail server, billing (Stripe/MP hoje?), modelo de clientes,
problemas, arquitetura recomendada. Só depois, o plano (`PLANO_IMPLEMENTACAO.md`).
