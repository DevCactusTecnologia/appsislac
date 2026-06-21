# A Receber — Auditoria (Fase 7)

> Mapeamento completo de **todos** os pontos do SISLAC que calculavam,
> exibiam ou agregavam o valor de "A Receber" antes da consolidação SSOT.

## 1. Definição canônica

**A Receber** = saldo em aberto que o laboratório tem direito a receber, composto por:

1. **Pacientes** — atendimentos não cancelados, com exames de
   `cobranca_destino = 'paciente'`, cujo total de exames excede a soma dos
   pagamentos em `atendimento_pagamentos`. Saldo = `valor_total − valor_pago > 0`.
2. **Convênios** — exames com `cobranca_destino = 'convenio'`, status `<> 'cancelado'`,
   `convenio_cobranca_id` válido (≠ 0/Particular), atendimento não cancelado,
   **e que ainda não foram vinculados a nenhuma fatura** (`convenio_fatura_itens`).

Esta é a regra **única** do banco e é encapsulada em duas RPCs irmãs:

| RPC                                | Retorno         | Uso                                |
| ---------------------------------- | --------------- | ---------------------------------- |
| `financeiro_a_receber_v2`          | Linhas detalhadas (paginadas) | Listagens detalhadas (Financeiro/A Receber, Convênios) |
| `financeiro_a_receber_totais` 🆕   | Único totalizador | Cards/KPIs (Dashboard, Recepção, Painel, dashboard_kpis) |

Ambas compartilham **literalmente** as mesmas CTEs (`base`, `pagos`, `conv_exames`, `conv_agg`).

## 2. Pontos de cálculo encontrados (antes da Fase 7)

| # | Local | Fonte | Status | Observação |
|---|-------|-------|--------|------------|
| 1 | `financeiro_a_receber_v2` (RPC) | banco | **SSOT (linhas)** | Mantida |
| 2 | `useAReceberPacientes` (hook) | RPC v2 | OK | Listagem detalhada |
| 3 | `useAReceberConvenios` (hook) | RPC v2 | OK | Listagem detalhada |
| 4 | `Financeiro` Painel — `computePainelKpis` | `aReceberPacientes.reduce + aReceberConvenios.reduce` | **DIVERGENTE** | Somava só a página atual (50 linhas) — subreporta em datasets grandes |
| 5 | `Dashboard.tsx` — `financeiroLegacy.aReceber` | iteração local em `examesCobranca` | **DIVERGENTE** | Somava todos os exames sem filtrar `cobranca_destino`; ignorava regra de "fatura não emitida" para convênios |
| 6 | `RecepcionistaDashboard.tsx` — `kpis.aReceber` | mesma lógica do #5 | **DIVERGENTE** | Idem |
| 7 | `dashboard_kpis` (RPC) — bloco `v_a_receber` | iteração sobre `atendimentos` + `pagamentos` | **QUEBRADA + DIVERGENTE** | Referenciava as tabelas legadas `pagamentos` e `saidas` (que não existem); somava todos os exames sem filtrar `cobranca_destino`; chamada falhava em runtime |
| 8 | `a_receber_pacientes_page` (RPC) | banco | **LEGADA** | Predecessora da v2; sem consumidores no frontend (confirmado por busca) |
| 9 | `financeiro_resumo` (RPC) — `arec` CTE | banco | OK | Lógica equivalente à v2 (apenas pacientes); não exibe número de "A Receber" no UI principal — usada só para resumos do módulo Financeiro com filtro de período. **Mantida** porque é filtrada por intervalo (semantics distintas do "A Receber atual"). |

## 3. Resumo

- **3 caminhos divergentes** estavam em produção (#4, #5, #6).
- **1 RPC quebrada** (#7).
- **1 RPC legada** sem consumidores (#8).
- **1 caminho válido** sem alteração (#9 — semântica diferente).

A Fase 7 elimina os caminhos divergentes, conserta a RPC quebrada e remove a RPC legada.
