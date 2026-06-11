# Financeiro — Single Source of Truth Audit

> Audit date: 2025-06-11 | Auditor: Senior Architect / Lab PO

---

## 1. Preços (Exam Prices)

### Where prices live
| Location | Table / Store | Persisted? |
|---|---|---|
| At-creation snapshot | `atendimento_exames.valor` | ✅ Yes — DB row |
| Runtime recalculation | `tabelaPrecoStore.getPrecoExame()` | ❌ No — in-memory, from `tabela_precos` table |

### Conflict
- The DB trigger `recompute_atendimento_status` (migration 20260417204746, line 50) reads `SUM(atendimento_exames.valor)` — uses **persisted** per-exam price. ✅
- The RPC `a_receber_pacientes_page` uses the same persisted value. ✅
- The legacy A-Receber path (Financeiro.tsx:264-268) calls `getPrecoExame(nome, tabela)` — uses **current** price table. ❌

**SSOT verdict:** `atendimento_exames.valor` is the intended SSOT. The legacy path violates it.

### Orcamentos
- `orcamentos.subtotal`, `.desconto`, `.total` are computed at creation and persisted.
- `orcamento_exames.nome_exame` stores the exam name but NOT the price per exam.
- If an orçamento is viewed after a price change, the displayed per-item price (re-fetched from `tabelaPrecoStore`) will differ from the stored total. **No per-item price is stored in orcamento_exames.**

---

## 2. Descontos (Discounts)

| Context | SSOT | Computed where | Stored where |
|---|---|---|---|
| Orçamento | `orcamentos.desconto` (header) | UI at creation | `orcamentos.total` |
| Fatura convênio | `convenio_faturas.desconto` (header) | `criarFatura()` client-side | `convenio_faturas.total` |
| Atendimento/Pagamento | ❌ No discount field | — | — |
| Saída | ❌ No discount field | — | — |

**Gaps:**
1. No per-item discount in either orcamentos or faturas.
2. No discount on individual atendimento payments — a receptionist cannot register "patient paid R$80 of R$100 as a courtesy discount" without under-recording the payment. The saldo would remain R$20 stuck in A-Receber.
3. `convenio_faturas.desconto` is not recomputed when items are removed (no such UI exists, but cancellation frees items — the header total is stale).

---

## 3. Recebimentos (Payments Received)

### Patient payments
| Layer | Table/View | Write path | Read path |
|---|---|---|---|
| Source of truth | `atendimento_pagamentos` | `update-atendimento` Edge Fn → `update_atendimento_tx` RPC | atendimentoStore, financeiro_entradas view |
| Derived status | `atendimentos.status_pagamento` | DB trigger `recompute_atendimento_status` | Every consumer |
| Financeiro Entradas | `financeiro_entradas` VIEW | — (read-only) | `fetchEntradasView()` |
| A-Receber (RPC) | `a_receber_pacientes_page` | — | `useAReceberPacientes` |
| A-Receber (legacy) | in-memory cache | — | `getAtendimentos()` |

**SSOT:** `atendimento_pagamentos` is the canonical table. All other representations are derived. ✅

**Violation:** The legacy A-Receber path computes `valorTotalPaciente` from `tabelaPrecoStore` rather than `atendimento_exames.valor`, making `saldo` a different number than what the DB computes. ❌

### Convênio payments
| Layer | Table | Write path | Read path |
|---|---|---|---|
| Source of truth | `convenio_faturas` | `convenioFaturasStore.marcarFaturaPaga()` | `fetchFaturas()` |
| Derived entry | `financeiro_entradas` VIEW | — | `fetchEntradasView()` |

**SSOT:** `convenio_faturas.status='paga'` is the canonical signal. ✅

---

## 4. Saídas (Expenses)

| Field | SSOT | Notes |
|---|---|---|
| All fields | `financeiro_saidas` | ✅ Single table, CRUD owned by financeiroStore |
| `forma_pagamento` | Encoded in `descricao` column as `[pgto:X]` | ❌ NOT a real column — SSOT is a regex parse |

**The payment method for saídas has no true SSOT column.** It is a derived parse of a text field.

---

## 5. Status Pagamento Derivation Chain

```
atendimento_pagamentos (INSERT/DELETE)
    │
    ▼  trigger: recompute_atendimento_status()
atendimentos.status_pagamento  ← SSOT for payment status
    │
    ├── atendimentoStore (in-memory cache, synced via Realtime)
    │       └── legacy A-Receber path reads this
    │
    ├── financeiro_entradas VIEW (reads a.status_pagamento directly)
    │       └── Financeiro Entradas tab filters on 'pago'/'pagamento efetuado'
    │
    └── a_receber_pacientes_page RPC (reads atendimentos.status_pagamento)
            └── RPC A-Receber path
```

All paths ultimately read `atendimentos.status_pagamento` — genuine SSOT enforced by DB trigger. ✅

---

## 6. SSOT Health Summary

| Domain | SSOT Defined? | All consumers use it? | Risk |
|---|---|---|---|
| Exam prices | ✅ `atendimento_exames.valor` | ❌ Legacy A-Receber reads tabelaPrecoStore | 🔴 R-01 |
| Patient payment totals | ✅ `atendimento_pagamentos` | ✅ via trigger + view | None |
| Payment status | ✅ `atendimentos.status_pagamento` | ✅ all paths | None |
| Convênio payment | ✅ `convenio_faturas.status` | ✅ | None |
| Saída payment method | ❌ No column — regex from descricao | N/A | 🟠 R-05 |
| Discounts | ⚠️ Header-only, not per-item | Partial | 🟡 Medium |
| Orçamento per-item price | ❌ Not stored | N/A | 🟡 Medium |
