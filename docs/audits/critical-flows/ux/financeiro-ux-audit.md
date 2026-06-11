# Financeiro — UX Audit

> Audit date: 2025-06-11 | Auditor: UX / Lab PO

---

## 1. Information Architecture

| Tab | Purpose | Issues |
|---|---|---|
| Entradas | Cash received (regime de caixa) | ✅ Clearly scoped |
| A Receber | Outstanding patient + convênio balances | ⚠️ Sub-tabs (pacientes/convênios) add depth; no visual cue when both are empty |
| Saídas | Expenses with status management | ✅ Status chips and filters are clear |
| Caixa | Running ledger | ⚠️ "Saldo inicial" only shown when dateFrom is set; no always-visible running total |
| Integrações | Webhook config | ⚠️ Shown only to permissioned users, but tab label "Integrações" gives no hint of webhook nature |

---

## 2. Filter & Period UX

- **Periodo rápido** buttons (Hoje / 7d / Mês / 30d / Ano / Tudo) are a good pattern. However, when the user picks a custom date range via the calendar popover, `periodoRapido` stays at its last value — creating a mismatch between the button highlight and the actual active range. (Financeiro.tsx:85, 393-425)
- **Filter badges** are not shown on tabs other than the active one, so a user switching from Saídas to Entradas cannot see that a date filter is still active.
- **Convenio filter** dropdown (Entradas) is populated only from current visible entries (`conveniosDisponiveis`, L428-432). If the period filter shows no entries, the dropdown is empty — user cannot pre-filter by convênio.

---

## 3. A Receber — Dual Data Source Confusion

- When `paginated_atendimentos=OFF`, data is limited to ~100 records with no warning shown to the user.
- The `rpcLoading` spinner is only shown in the RPC path. Legacy path has no loading indicator.
- The `aReceberRowsRpc` stub (Financeiro.tsx:321-351) creates empty `atendimento` objects. If any rendered component inspects `row.atendimento.exames`, it will silently show zero — no error, no empty state label.

---

## 4. Pagination Bug (shared currentPage)

As documented in R-08: switching tabs does not reset `currentPage`. Users on page 3 of Entradas who switch to Saídas (with 1 page) see an empty list with pagination controls showing "Página 3 de 1". No user-facing feedback explains why the table is empty. (Financeiro.tsx:82, 502)

---

## 5. Batch Operations

- Bulk "Marcar como pago" for saídas (Financeiro.tsx:815-827): no confirmation dialog before mutating N records. Accidental bulk pay is irreversible without manual correction of each record.
- Checkboxes only appear on the Saídas tab and only for unpaid items — the selection state (`saidasSelecionadas`) persists if the user navigates away and returns, which may confuse users.

---

## 6. Edit / Delete Guardrails

- **Delete saída:** confirmation dialog present ✅ (Financeiro.tsx:747, deleteDialogOpen).
- **Edit entrada:** No edit path — consistent with read-only rule ✅.
- **Edit saída:** No unsaved-changes guard — if user partially edits and closes the dialog via ESC, changes are lost silently.
- **Pay saída from detail:** pre-fills today's date and existing payment method ✅ — good default behaviour.

---

## 7. Empty States

- Entradas with no results: generic table empty state. No differentiation between "no payments exist yet" vs "your filters excluded all results".
- A-Receber convênios sub-tab: if `saldoConvenios` is empty map, no empty-state message is shown (renders empty table silently).

---

## 8. Livro-Caixa

- Running saldo column is a strong feature ✅.
- "Saldo inicial" row only appears when `dateFrom` is set — without a start date, there is no saldo inicial anchor, making the total balance uninterpretable as a bank reconciliation.
- Print button generates raw HTML; no preview before print. No PDF export path.

---

## 9. Faturas de Convênio

- "Fechar Fatura" action lives in A-Receber/Convênios sub-tab — not obvious to users unfamiliar with the term "fechar fatura".
- After `marcarFaturaPaga`, the view updates only on next `refreshEntradas()` call (triggered by atendimentoStore subscribe). Latency is indefinite — no optimistic UI update for fatura payment.
- `FaturaDetalheDialog` drill-down is accessible from Entradas tab only when `origem='fatura_convenio'`. This is correct but the entry in the Entradas list shows the convenio name as both `cliente` and `convenio` fields — duplicated information.

---

## 10. Accessibility & Responsiveness

- `paymentIcons` (types.ts:38-43) only covers Dinheiro, Crédito, Débito, PIX. Custom payment methods (from `financeiro_formas_pagamento`) fall back to no icon — inconsistent icon density in tables.
- No keyboard navigation testing evidence in codebase.
- Page is 2 392 lines of JSX — no evidence of responsive breakpoint testing for the Caixa running-balance table (wide table, 8 columns).

---

## UX Issue Priority

| # | Issue | Priority |
|---|---|---|
| 1 | Pagination not reset on tab change (empty table) | 🔴 High |
| 2 | Legacy A-Receber silent 100-record cap | 🔴 High |
| 3 | Bulk pay with no confirmation dialog | 🟠 Medium |
| 4 | Period filter highlight mismatch (custom dates) | 🟡 Low |
| 5 | Empty convenio filter when period has no entries | 🟡 Low |
| 6 | Fatura payment no optimistic UI | 🟡 Low |
