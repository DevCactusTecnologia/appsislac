# Status Financeiro — Single Source of Truth (P1)

> Data: 2026-06-15 · Fase 1 do P1 Hardening · **Somente documentação** (Olhou. Entendeu. Manteve.)

## 1. Pergunta-guia
> Qual deve ser a única fonte de verdade para `pago | parcial | pendente | cancelado | estornado`?

## 2. Resposta canônica

| Camada | Papel | Local |
|---|---|---|
| **Origem (SSOT real)** | Coluna `atendimentos.status_pagamento` | banco |
| **Quem calcula** | Trigger DB `recompute_atendimento_status` (executa em `atendimento_pagamentos` + `atendimento_exames`) | `supabase/migrations/20260417204746_*.sql` |
| **Quem normaliza p/ UI** | `derivePagamentoStatus()` | `src/lib/atendimentoStatus.ts` |
| **Quem persiste** | `update_atendimento_tx` (RPC) via `update-atendimento` (Edge Function) | `supabase/functions/update-atendimento/index.ts` |
| **Quem exibe** | Componentes que leem `atendimento.statusPagamento.{label,type}` | UI |

**Conclusão:** o SSOT já está estabelecido e respeitado. O cálculo é exclusivo do banco (trigger). Frontend **lê** e **classifica visualmente**, nunca recalcula.

## 3. Rótulos canônicos (espelham o trigger)

```
Pagamento efetuado   → success   (pago integral)
Pagamento parcial    → info      (parcial)
Pagamento pendente   → warning   (pendente / não pago)
Pagamento cancelado  → danger    (cancelado / estornado lógico)
```

Fonte: `STATUS_PAGAMENTO_TYPES` em `src/lib/atendimentoStatus.ts:37-42`.

## 4. Mapa de consumo

| Arquivo | Papel | Lê SSOT? |
|---|---|---|
| `src/data/atendimentoStore/_internal.ts:101-133` | Hidrata `statusPagamento` via `derivePagamentoStatus(atRow.status_pagamento)` | ✅ |
| `src/components/AtendimentoDetalheDialog.tsx:205,356` | Exibe badge | ✅ |
| `src/components/dashboard/RecepcionistaDashboard.tsx:172` | Filtros UI | ✅ |
| `src/pages/Financeiro/services/filterEntradasPagas.ts:14` | Filtra `"pago" / "pagamento efetuado"` na view `financeiro_entradas` | ✅ (via view) |
| `src/pages/Financeiro/components/EntradasSaidasTable.tsx:54` | Render texto | ✅ |
| `src/pages/Financeiro/components/dialogs/DetailEntryDialog.tsx:124` | Detalhe | ✅ |
| `src/hooks/useAReceberPacientes.ts` | RPC `a_receber_pacientes_page` | ✅ (DB-side) |
| `src/components/PagamentoDialog.tsx` | Mutação → Edge Fn (NÃO grava status) | ✅ |

## 5. Risco residual — legado A-Receber

`docs/audits/critical-flows/ssot/financeiro-single-source-of-truth.md` aponta um caminho legado que ainda recomputa `valorTotalPaciente` via `tabelaPrecoStore` em vez de `atendimento_exames.valor` (R-01). **Não é cálculo de status**, é cálculo de saldo. Mantido fora do escopo desta fase porque envolveria mudança comportamental.

## 6. Decisão P1

- ❌ **Não criar** `src/lib/finance/statusPagamento.ts` — duplicaria o SSOT existente em `src/lib/atendimentoStatus.ts`.
- ✅ **Manter** `derivePagamentoStatus()` como ponto único de mapeamento DB → UI.
- ✅ **Documentar** (este arquivo) que qualquer novo consumidor deve importar `derivePagamentoStatus` e nunca redefinir as 4 strings.

## 7. Regra para novos PRs

> Proibido string-literal `"Pagamento efetuado" | "Pagamento parcial" | "Pagamento pendente" | "Pagamento cancelado"` fora de `src/lib/atendimentoStatus.ts`. Use `STATUS_PAGAMENTO_TYPES` ou `derivePagamentoStatus()`.

## 8. Veredito
**Status financeiro POSSUI SSOT.** Nenhuma extração necessária. Zero alterações de código nesta fase.
