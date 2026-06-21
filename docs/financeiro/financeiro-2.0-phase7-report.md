# Financeiro 2.0 — Fase 7 (SSOT definitivo do "A Receber")

**Data:** 2026-06-21
**Status:** ✅ Concluída

## Objetivo

Eliminar qualquer divergência de "A Receber" entre Dashboard, Recepção,
Painel Financeiro, Financeiro detalhado e a RPC `dashboard_kpis`.
Toda tela passa a perguntar a **mesma** RPC e exibir o **mesmo** número.

## O que foi feito

### Banco de dados

1. **Criada** `public.financeiro_a_receber_totais()` — RPC oficial dos totais
   (pacientes + convênios) usando *exatamente* as mesmas CTEs de
   `financeiro_a_receber_v2`. Retorna `total_pacientes`, `qtd_pacientes`,
   `total_convenios`, `qtd_convenios`, `total_geral`.
2. **Corrigida** `public.dashboard_kpis()`:
   - Receita lida de `atendimento_pagamentos` (a tabela `pagamentos` não existe).
   - Saídas lidas de `financeiro_saidas` com `foi_pago = true`
     (a tabela `saidas` não existe).
   - "A Receber" passa a consultar `financeiro_a_receber_totais()`.
   - Resultado: a função agora executa sem erro e produz o mesmo número
     que aparece em qualquer outra tela.
3. **Removida** `public.a_receber_pacientes_page()` — RPC legada sem
   consumidores no frontend.

### Frontend

| Arquivo | Mudança |
|--------|---------|
| `src/hooks/useAReceberPacientes.ts` | Adicionado `useAReceberTotais()` (consome a nova RPC). |
| `src/pages/Financeiro/services/computePainelKpis.ts` | Assinatura passa a receber `AReceberTotaisInput` (totais do SSOT) em vez de somar arrays paginados. Removida a soma client-side enganosa. |
| `src/pages/Financeiro.tsx` | Wireado `useAReceberTotais` + repassa para `computePainelKpis`. Refresh automático em mutações de atendimento. |
| `src/pages/Dashboard.tsx` | `financeiro.aReceber` sempre vem do SSOT (sobrepõe legado e RPC `dashboard_kpis`). |
| `src/components/dashboard/RecepcionistaDashboard.tsx` | Removido cálculo client-side de `aReceber`; agora vem do SSOT. |

### Documentação

- `docs/financeiro/a-receber-audit.md` — auditoria completa.
- `docs/financeiro/a-receber-dependency-map.md` — mapa de dependências.
- `docs/financeiro/financeiro-2.0-phase7-report.md` — este relatório.

## Antes × Depois

| Tela | Antes | Depois |
|------|-------|--------|
| Dashboard (admin) | Soma local sobre todos os `examesCobranca` (sem filtrar `cobranca_destino`); convênios faturados também entravam | `financeiro_a_receber_totais` |
| Recepção | Mesma soma local | `financeiro_a_receber_totais` |
| Painel Financeiro | `aReceberPacientes.reduce(...)` da página corrente (50 linhas) | `financeiro_a_receber_totais` |
| `dashboard_kpis.financeiro.aReceber` | Soma sobre `pagamentos`/`saidas` (tabelas inexistentes → erro) | Delegação para `financeiro_a_receber_totais` |
| Financeiro » A Receber (lista) | `financeiro_a_receber_v2` | `financeiro_a_receber_v2` (sem alteração) |

## Checklist de validação

| Pergunta | Resposta |
|----------|----------|
| Existe apenas uma fonte de verdade para o total? | **Sim** — `financeiro_a_receber_totais` |
| Existe cálculo paralelo no frontend? | **Não** |
| Existe store paralela? | **Não** |
| Existe query paralela? | **Não** |
| Existe KPI paralelo? | **Não** — `dashboard_kpis` agora delega |
| Quantos consumidores usam o SSOT? | **5** componentes/hooks (Painel, Dashboard, Recepção, lista pacientes, lista convênios) via 3 hooks (`useAReceberPacientes`, `useAReceberConvenios`, `useAReceberTotais`) |
| Quantos fluxos legados foram removidos? | **3** caminhos divergentes + 1 RPC legada + tabelas inexistentes em `dashboard_kpis` |
| Existe código morto removido? | **Sim** — soma client-side em `computePainelKpis` e em `RecepcionistaDashboard.kpis.aReceber`; `a_receber_pacientes_page` dropada |
| Existe divergência de valores? | **Não** — todas as telas consultam o mesmo agregado server-side |
| O contador verá o mesmo número em qualquer tela? | **Sim** |

## Segurança / RLS

Preservado integralmente:

- Ambas as RPCs filtram por `current_tenant_id()` em todas as CTEs.
- `financeiro_a_receber_totais` é `STABLE` `SECURITY INVOKER` (default), respeitando
  RLS das tabelas subjacentes.
- `dashboard_kpis` continua `SECURITY DEFINER` (igual ao original) para
  permitir agregados eficientes; o `current_tenant_id()` ainda é verificado
  no início da função.
- Grants concedidos para `authenticated` e `service_role`.
- Nenhuma policy, trigger, edge function ou fluxo de auth foi tocado.

## Regra de parada

Aplicada. Fase 7 encerrada. Caixa, Convênios, Pagamentos e UX permanecem inalterados.
