# Financeiro — Risk Analysis

> Audit date: 2025-06-11 | Auditor: Senior Architect / QA

---

## R-01 · Cobrança Incorreta — Price source is tabelaPrecoStore, not persisted per-exam

**Severity:** 🔴 Critical  
**Location:** Financeiro.tsx:264-268 (A-Receber legacy path); `getPrecoExame` from tabelaPrecoStore

**Description:** The A-Receber legacy path recalculates `valorTotalPaciente` live from `getPrecoExame(nome, tabela)` at render time. If a price table is updated after an atendimento was created, the A-Receber balance will silently change — charging the patient a different amount than what was agreed at booking.

**Contrast:** `atendimento_exames.valor` IS persisted per-row (used by the DB trigger `recompute_atendimento_status`). The RPC path (`a_receber_pacientes_page`) uses the persisted value. **The legacy and RPC paths compute different numbers for the same atendimento when prices have changed.**

**Mitigation required:** Deprecate legacy path entirely; enforce RPC path as sole source for A-Receber values.

---

## R-02 · Integridade das Entradas — View has no tenant_id filter enforcement at view level

**Severity:** 🔴 Critical  
**Location:** supabase/migrations/20260419025053 (view definition)

**Description:** The `financeiro_entradas` VIEW is defined with `security_invoker = true` (migration 20260608140055). This means RLS of the underlying tables (`atendimento_pagamentos`, `atendimentos`, `convenio_faturas`) governs access. If RLS on any base table is misconfigured or has a bypass path (e.g., via a SECURITY DEFINER function), entries from other tenants could leak through the view.

**Evidence:** `fetchEntradasView()` (financeiroStore.ts:308) issues `SELECT *` with no `.eq("tenant_id", tenantId)` client-side guard. Tenant isolation is 100% delegated to RLS.

**Mitigation:** Add `.eq("tenant_id", await getCurrentTenantId())` as defence-in-depth in `fetchEntradasView()`, matching the pattern used in `fetchSaldoEmAbertoPorConvenio()` (convenioFaturasStore.ts:226).

---

## R-03 · Multi-Tenant — fetchSaldoEmAbertoPorConvenio passes tenant_id from client

**Severity:** 🟠 High  
**Location:** convenioFaturasStore.ts:225-229

**Description:** `fetchSaldoEmAbertoPorConvenio` calls `getCurrentTenantId()` and applies `.eq("tenant_id", tenantId)` directly on `atendimento_exames`. The `tenantId` comes from `supabase.rpc("current_tenant_id")` which is server-resolved. However, the subsequent join to `atendimentos` (line 243-248) has NO tenant_id filter — it fetches patient names for any atendimento_id returned by the first query. If `atendimento_exames` RLS is ever bypassed, cross-tenant patient names could appear.

---

## R-04 · Non-Atomic Fatura Cancellation — Data integrity risk

**Severity:** 🟠 High  
**Location:** convenioFaturasStore.ts:359-374

**Description:** `cancelarFatura` deletes items then updates the header in two separate round-trips. A network failure between the two leaves the fatura header in `status='aberta'` with zero items. The exams remain locked (excluded from `fetchItensFaturaveis` because they existed in `convenio_fatura_itens` even if deleted on re-query). Actually, items are deleted so exams become available again — but the orphan fatura header remains "aberta" forever, polluting the fatura list.

**Mitigation:** Wrap in a DB-level transaction via a dedicated RPC.

---

## R-05 · [pgto:] Encoding — Silent data corruption risk

**Severity:** 🟠 High  
**Location:** financeiroStore.ts:121-138

**Description:** The payment method for `financeiro_saidas` is embedded in the `descricao` column as a `[pgto:PIX]` suffix. Any direct DB manipulation, CSV import, or future feature that modifies `descricao` will silently destroy the payment method. The encoded value is never validated server-side.

---

## R-06 · A-Receber Legacy Path — 100-record cap

**Severity:** 🟠 High  
**Location:** Financeiro.tsx:257-286; atendimentoStore boot limit

**Description:** When `paginated_atendimentos` feature flag is OFF (or `USE_LEGACY_STORE` is ON), A-Receber is computed from `getAtendimentos()` which is bounded by the store's optimised boot limit (~100 records). Clinics with > 100 open atendimentos will show an incomplete A-Receber balance — a silent financial undercount.

---

## R-07 · Batch "Mark as Paid" — No confirmation of forma_pagamento

**Severity:** 🟡 Medium  
**Location:** Financeiro.tsx:815-827

**Description:** `marcarSaidasComoPagas()` sets `foiPago='Sim'` and `dataPagamento=today` for all selected saídas without requiring the user to specify the payment method. The `pagamento` field is left as whatever was previously stored. This means the Livro-Caixa will show these entries with potentially blank or wrong payment methods.

---

## R-08 · Shared currentPage across tabs

**Severity:** 🟡 Medium  
**Location:** Financeiro.tsx:82, 502-503

**Description:** Single `currentPage` state shared across all tabs. Tab switch does not reset page, causing users to see empty tables when switching to a tab with fewer pages than the current page number.

---

## R-09 · Float Comparison Tolerance Mismatch

**Severity:** 🟡 Medium  
**Location:** Financeiro.tsx:272 vs migration 20260417204746

**Description:** Legacy A-Receber uses `saldo <= 0.009` to exclude near-zero balances; the DB trigger uses `total_pago >= total_valor`. A balance of R$0.005 would appear in the legacy A-Receber but not in the RPC path — inconsistent user experience and potential for phantom debt display.

---

## Risk Summary Matrix

| ID | Title | Severity | Affected Area |
|---|---|---|---|
| R-01 | Price source not persisted (legacy path) | 🔴 Critical | Cobrança, A-Receber |
| R-02 | Entradas view no client-side tenant guard | 🔴 Critical | Multi-tenant, Integridade |
| R-03 | fetchSaldoEmAberto cross-tenant join | 🟠 High | Multi-tenant |
| R-04 | Non-atomic fatura cancellation | 🟠 High | Integridade Faturas |
| R-05 | [pgto:] encoding corruption | 🟠 High | Saídas, Caixa |
| R-06 | Legacy A-Receber 100-record cap | 🟠 High | A-Receber completeness |
| R-07 | Batch pay without forma_pagamento | 🟡 Medium | Saídas, Caixa |
| R-08 | Shared pagination state | 🟡 Medium | UX / Data display |
| R-09 | Float tolerance mismatch | 🟡 Medium | A-Receber accuracy |
