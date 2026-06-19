# Experiência Operacional — Financeiro SISLAC

> Como cada perfil utiliza efetivamente a rota `/financeiro` hoje.

## Recepção (geralmente role `user` com `registrar_pagamento` + `visualizar_atendimentos`)

| Tela usada | Ação típica |
|---|---|
| `/novo-atendimento` | Criar atendimento e registrar pagamento à vista no `PagamentoDialog` |
| `/registrar-coleta`, `/atendimentos` | Receber paciente que volta para quitar — abre `PagamentoDialog` ou navega para `/financeiro → A Receber → Pagar` |
| `/financeiro` aba **A Receber** | Listar pendências de pacientes, dar baixa parcial/total |

Informação que realmente precisa: saldo do paciente, formas aceitas, comprovante.

A recepção **não** lança despesa, **não** fecha fatura, **não** vê livro-caixa em geral (depende das permissões atribuídas).

## Financeiro / Tesouraria (role `manager` ou `admin` com `gestao_financeira` + `visualizar_financeiro`)

| Tela | Ação |
|---|---|
| `/financeiro` aba **Entradas** | Conferir recebimentos do dia/período, imprimir relatório detalhado |
| `/financeiro` aba **A Receber → Pacientes** | Acompanhar inadimplência por paciente, dar baixa |
| `/financeiro` aba **A Receber → Convênios** | Ver saldo em aberto por convênio, criar fatura (`Fechar fatura`) |
| Fatura existente | Marcar como paga, cancelar fatura aberta, drill-down nos itens |
| `/financeiro` aba **Saídas** | Lançar despesa, agendar vencimento, marcar como paga (single ou em lote) |
| `/financeiro` aba **Caixa** | Conferir e imprimir Livro-Caixa do período |
| `/financeiro` aba **Integrações** | Ver histórico de webhooks de gateway |

Informação central: total recebido vs. total a receber, saídas vencendo, saldo do caixa.

## Gestor / Diretor (admin)

Mesmo acesso da Tesouraria + capacidade de exclusão (DELETE). Usa principalmente:
- KPIs do header
- Aba Caixa para fechamento gerencial mensal (impressão)
- Aba A Receber → Convênios para acompanhamento da carteira
- Auditoria via `/auditoria` (fora do módulo Financeiro)

## Contador (geralmente acesso somente leitura — `visualizar_financeiro`)

- Aba **Entradas** com filtro por período (mensal) → impressão "Detalhado"
- Aba **Saídas** com filtro por período → impressão "Detalhado"
- Aba **Caixa** → impressão "Livro-Caixa"
- Não há export contábil (CSV/SPED). A entrega é via PDF/print do navegador.

## Super Admin (plataforma)

- Não usa `/financeiro` operacionalmente — `is_super_admin` permite SELECT cross-tenant para suporte/auditoria, mas o fluxo de gestão financeira é responsabilidade do tenant.
- Dashboard `/super-admin` cobre métricas agregadas SaaS (assinaturas, planos), não o financeiro do laboratório.

## Mapa "perfil × tela × intenção"

```
Recepção         → A Receber             → "Quanto este paciente deve?"
Tesouraria       → Entradas + Saídas     → "Quanto entrou? Quanto pagar?"
Tesouraria       → A Receber Convênios   → "O que faturar este mês?"
Tesouraria/Gestor → Caixa                → "Sobrou caixa? Imprimir."
Contador         → Entradas/Saídas/Caixa → "Conferir/baixar período."
```

## Observações de UX (descritivas, não prescritivas)

- O período rápido aplicado no header é **global** para todas as abas (filtra entradas, A Receber, saídas e caixa simultaneamente).
- Existe paginação local de 8 itens por página em todas as abas com tabela.
- A busca textual (NFD-normalizada, debounce 300ms) atua sobre `protocolo + cliente + pagamento` (ou `categoria/descricao` no caixa).
- Impressão é via `printHtmlInHiddenFrame` (HTML inline, sem PDF gerado server-side).
- Aba Integrações fica oculta para quem não tem `gestao_financeira`/`visualizar_financeiro`.
- Receber pagamento de A Receber abre **o mesmo** `NovaEntradaSaidaDialog (tipo=entrada)` que a entrada manual — diferencial é o `receberInitial = { tipo: "protocolo", protocolo }`.
