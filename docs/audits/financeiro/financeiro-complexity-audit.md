# Financeiro — Complexity Audit

> Audit date: 2025-06-11 | Auditor: Senior Architect / QA

---

## 1. Lines-of-code & cyclomatic complexity summary

| File | LoC | Est. Functions | Dominant Complexity Drivers |
|---|---|---|---|
| `src/pages/Financeiro.tsx` | **2 392** | ~45 | God-component; 30+ useState; 20+ useMemo; dual data-source branch |
| `src/data/financeiroStore.ts` | 334 | 8 | encodePagamento hack, optimistic CRUD |
| `src/data/convenioFaturasStore.ts` | 375 | 7 | Multi-join waterfall (3 sequential queries) |
| `src/data/financeiroListasStore.ts` | 162 | 6 | Low |
| `src/hooks/useAReceberPacientes.ts` | 170 | 2 | Race-condition guard (reqIdRef) |
| `src/pages/Financeiro/helpers.ts` | 63 | 5 | Low |
| `src/pages/Financeiro/types.ts` | 43 | 0 | Low |

---

## 2. God-component analysis: Financeiro.tsx

### State variables (30+)
```
activeTab, searchQuery, currentPage, dateFrom, dateTo, periodoRapido,
dialogOpen, dialogTipo, saidasList, entradasView, convenioFilter,
tipoDespesaFilter, destinoPagamentoFilter, saidaStatusFilter,
aReceberStatusFilter, aReceberSubTab, saldoConvenios, fecharFaturaOpen,
fecharFaturaAlvo, faturaDetalheOpen, faturaDetalheAlvo, saidasSelecionadas,
editDialogOpen, editingEntry, deleteDialogOpen, deletingProtocolo,
detailDialogOpen, detailEntry, payDialogOpen, payTarget, payForma, payData,
receberDialogOpen, receberInitial, tiposItems, destinosItems, formasItems,
criarOpen, criarCategoria, criarInitialValue, criarOnSuccess
```

### useMemo chains with cross-dependencies
- `aReceberRows` (L257) depends on `getAtendimentos()` + `getTabelaByConvenioNome` + `getPrecoExame` — 3 external singletons not in dependency array (will not re-render on external store change unless subscribeAtendimentos fires).
- `allEntries` → `filtered` → `paginatedData` — 3-stage pipeline that recomputes on every filter change.
- `caixaMovimentos` → `caixaMovFiltrados` → `caixaLinhasComSaldo` — another 3-stage pipeline.
- `detailExames` + `detailTotalExames` + `detailTotalPago` + `detailSaldo` — 4 memos for a single detail modal.

### Dual-source branching (A-Receber)
- Feature flags `paginated_atendimentos` + `USE_LEGACY_STORE` create two completely parallel data pipelines:
  - Legacy: `getAtendimentos()` in-memory scan (capped at ~100 records by boot optimisation).
  - RPC: `useAReceberPacientes` paginated cursor (50/page).
- Both hooks are called unconditionally (L293-317) to respect Rules of Hooks; result selected by `useRpc` boolean.
- The `aReceberRowsRpc` adapter at L321-351 creates a `MockAtendimento` stub that leaves most fields empty (`exames:[]`, `examesCobranca:[]`) — any template that tries to call `getPrecoExame` on these will silently return 0.

---

## 3. Data-encoding antipattern: `[pgto:XXX]` in `descricao`

**Location:** financeiroStore.ts:121-138

```ts
// forma_pagamento is encoded as suffix in descricao field:
// "Fornecedor Biotech [pgto:PIX]"
```

- `financeiro_saidas` has no dedicated `forma_pagamento` column.
- Payment method is serialized as `[pgto:<value>]` marker appended to `descricao`.
- `decodePagamento` regex parses it back on every read.
- **Risk:** Any external tool, import, or direct DB edit that touches `descricao` will corrupt the payment method. Regex is case-insensitive but the marker format is not validated on write.
- **Migration burden:** Changing the schema later requires a data migration across all rows.

---

## 4. Sequential waterfall queries (convenioFaturasStore)

`fetchItensFatura()` (lines 109-154) runs **3 sequential round-trips**:
1. `SELECT * FROM convenio_fatura_itens WHERE fatura_id = ?`
2. `SELECT … FROM atendimento_exames WHERE id IN (…)`
3. `SELECT … FROM atendimentos WHERE id IN (…)`

`fetchItensFaturaveis()` (lines 162-215) runs **3 sequential round-trips + 1 filter pass**.

`fetchSaldoEmAbertoPorConvenio()` (lines 223-264) runs **3 sequential round-trips**.

All six of these are **read waterfalls** that could be replaced by a single DB view or RPC, reducing latency by ~60-70%.

---

## 5. Non-atomic fatura cancellation

`cancelarFatura()` (lines 359-374):
```ts
await persistOrThrow(supabase.from("convenio_fatura_itens").delete()…) // step 1
await persistOrThrow(supabase.from("convenio_faturas").update({status:"cancelada"})…) // step 2
```
No transaction wrapping. If step 2 fails, items are deleted but the fatura header remains "aberta" with zero items — phantom fatura.

---

## 6. Optimistic UI without conflict detection

`addSaida` / `updateSaida` / `removeSaida` in financeiroStore.ts follow optimistic pattern:
- Rollback on server error ✅
- No conflict detection / ETag / row version ❌
- Two tabs open simultaneously can create a lost-update scenario.

---

## 7. printHtml complexity

`imprimirLivroCaixa()` (Financeiro.tsx:641-709) and `imprimirDetalhado()` (L867-…) generate full HTML strings inline, embedded in JSX handlers. Each is ~70 lines of string concatenation. No template separation, no i18n, no test coverage.

---

## 8. Pagination: shared `currentPage` across tabs

```ts
const [currentPage, setCurrentPage] = useState(1); // line 82
```

Single `currentPage` is shared across Entradas, Saídas, A-Receber, and Caixa tabs. Switching tabs does NOT reset `currentPage`, so a user on page 3 of Entradas who switches to Saídas (which may have only 1 page) will see an empty table.

---

## 9. Complexity score summary

| Dimension | Rating | Evidence |
|---|---|---|
| File size | 🔴 Critical | 2 392 LoC single component |
| State count | 🔴 Critical | 30+ useState in one component |
| Data source duality | 🟠 High | Flag-gated dual pipeline |
| DB round-trips | 🟠 High | 3-waterfall fetches in fatura store |
| Encoding hack | 🟠 High | `[pgto:]` marker in text field |
| Non-atomic operations | 🟠 High | cancelarFatura |
| Shared pagination state | 🟡 Medium | currentPage shared across tabs |
| Print HTML inline | 🟡 Medium | No template separation |
