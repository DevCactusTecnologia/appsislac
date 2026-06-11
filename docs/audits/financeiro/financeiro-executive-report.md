# Financeiro — Executive Report
> Audit date: 2025-07 | Read-only audit | Scope: `src/pages/Financeiro.tsx` + stores + RPCs

## 1. How it really works

```
Atendimento (NovoAtendimento) → atendimento_exames (com preço congelado por exame) →
  atendimento_pagamentos (parcelas/recebimentos) →
  Financeiro/Entradas (read-only, derivado do atendimentoStore) →
  Financeiro/Saídas (financeiro_saidas, CRUD próprio) →
  Faturas de convênio (convenio_faturas + convenio_fatura_itens) →
  Relatórios consolidados (helpers de agregação client-side).
```

Cobrança híbrida: parte particular + parte convênio, com desconto/acréscimo distribuído proporcionalmente pelos exames. Preço-base resolvido por `calculateExamPrice` (SSOT consolidada no hardening anterior).

## 2. Riscos consolidados

| ID | Severidade | Evidência | Resumo |
|----|------------|-----------|--------|
| F1 | 🟠 P1 | `Financeiro.tsx:264` vs RPC `create_atendimento_tx` | Recomputo legado de preço no frontend pode divergir do backend |
| F2 | 🟠 P1 | `convenioFaturasStore.ts` cancelamento | Operação não-atômica: estados intermediários possíveis em falha parcial |
| F3 | 🟡 P2 | `Financeiro.tsx` 2.392 LOC | Monolito; manutenção difícil |
| F4 | 🟢 baixo | Entradas read-only (constraint registrada) | Integridade preservada — edição só no atendimento |
| F5 | 🟢 baixo | RLS `tenant_id` em todas as tabelas financeiras | Isolamento OK |

## 3. Veredito

- **Lógica correta:** ✅ Regras de particular/convênio/desconto/acréscimo/recebimento parcial verificadas.
- **Risco financeiro:** 🟠 Médio — F1/F2 podem gerar divergência de centavos ou faturas em estado inconsistente sob alta concorrência.
- **Fonte única de verdade:** 🟡 Parcial — `calculateExamPrice` consolidado; cálculo de fatura ainda parcialmente duplicado entre tela e store.

## 4. Classificação

**Production Ready — Needs Hardening (F1, F2).**
