# Convênios 2.0 — SSOT Report

> Identifica fonte oficial de verdade para cada métrica financeira do domínio Convênios.

## Métricas e suas fontes

| Métrica | Fonte oficial | Fontes alternativas existentes | Classificação |
|---|---|---|---|
| **Saldo a faturar por convênio** (exames a fechar em fatura) | RPC `financeiro_a_receber_v2(p_tipo='convenio')` | `fetchSaldoEmAbertoPorConvenio` em `convenioFaturasStore.ts` (legado, ainda exportado) | ⚠️ **DUPLICADO** — duas implementações com mesma intenção. |
| **Total a receber convênios (KPI)** | RPC `financeiro_a_receber_totais()` (campo `total_convenios`) | Cálculo client-side antigo via soma do array v2 | ✅ SSOT (Fase 7) |
| **Itens faturáveis em um período** | `fetchItensFaturaveis(convenioId, ini, fim)` no front (consulta direta a `atendimento_exames` + `convenio_fatura_itens`) | RPC v2 (não suporta período por exame) | ⚠️ **PARCIAL** — só existe no front; RPC v2 não filtra por período de exame. |
| **Valor faturado** (cabeçalho da fatura) | `convenio_faturas.total` | — | ✅ SSOT (banco) |
| **Valor recebido por fatura** | `convenio_faturas.total` quando `status='paga'` | — | ✅ SSOT |
| **Recebimentos de fatura no livro caixa** | view `financeiro_entradas WHERE origem='fatura_convenio'` | — | ✅ SSOT |
| **Valor glosado** | — | — | ❌ **AUSENTE** — não há entidade nem coluna. |
| **Valor reapresentado** | — | — | ❌ **AUSENTE**. |
| **Competência (mês de faturamento)** | `convenio_faturas.periodo_inicio`/`periodo_fim` (interpretação manual) | — | ⚠️ **IMPLÍCITO** — não há fechamento, sem coluna `competencia` em itens. |
| **Status do exame faturável** | `atendimento_exames.status` (`finalizado`) | — | ⚠️ **DIVERGÊNCIA POTENCIAL**: SSOT v2 usa `status <> 'cancelado'`, mas `fetchItensFaturaveis` exige `status = 'finalizado'`. |
| **Pagamento de paciente em atendimento** | `atendimento_pagamentos` | — | ✅ SSOT (Fase 2) |

## Pontos onde existe SSOT

1. ✅ **A Receber convênios** consolidado em `financeiro_a_receber_v2` (Fase 7).
2. ✅ **Total agregado** em `financeiro_a_receber_totais()`.
3. ✅ **Recebimento de fatura no livro caixa** via view `financeiro_entradas`.
4. ✅ **Valor da fatura** está no banco com triggers de proteção.

## Pontos onde existe duplicação

1. ⚠️ `convenioFaturasStore.fetchSaldoEmAbertoPorConvenio` ainda existe e calcula o mesmo saldo que `financeiro_a_receber_v2`. Não é mais consumido pelos componentes principais (Fase 7), mas continua exportado e pode ser chamado.
2. ⚠️ Cálculo de `subtotal/total` é feito **no front** dentro de `criarFatura`. O banco não recalcula nem valida. Se o front bugar, banco aceita.

## Pontos onde existe divergência

1. ⚠️ Critério de elegibilidade:
   - SSOT (`financeiro_a_receber_v2`): exames com `status <> 'cancelado'` (inclui pendente/coletado/em_analise).
   - Operação (`fetchItensFaturaveis`): apenas `status = 'finalizado'`.
   - **Resultado**: o KPI "saldo em aberto" pode ser maior que o "faturável agora", confundindo gestor.

## Pontos onde existe legado

1. `financeiro_tipos_despesa`, `financeiro_destinos_pagamento`, `financeiro_formas_pagamento`: não consumidos.
2. `fetchSaldoEmAbertoPorConvenio`: substituído por `useAReceberConvenios`, mas exportado.

## Veredicto SSOT por entidade

| Entidade | SSOT? | Onde |
|---|---|---|
| Convênio (cadastro) | ✅ | `convenios` |
| Tabela de preços | ✅ | `tabela_preco_itens` |
| Fatura (cabeçalho) | ✅ | `convenio_faturas` |
| Fatura (itens) | ✅ | `convenio_fatura_itens` |
| A Receber (saldo) | ✅ | `financeiro_a_receber_v2` |
| KPIs A Receber | ✅ | `financeiro_a_receber_totais` |
| Itens faturáveis (período) | ⚠️ | só no front |
| Glosa | ❌ | inexistente |
| Reapresentação | ❌ | inexistente |
| Competência | ❌ | implícita |
