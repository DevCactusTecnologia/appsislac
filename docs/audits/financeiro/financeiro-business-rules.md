# Financeiro — Business Rules

> Audit date: 2025-06-11 | Auditor: Lab PO / Senior Architect

---

## 0. Canonical lifecycle: atendimento → cobrança → pagamento → conciliação → relatório

```
[ATENDIMENTO CRIADO]
     │  create-atendimento Edge Fn → create_atendimento_tx RPC
     │  INSERT atendimentos + atendimento_exames + atendimento_pagamentos (if any at creation)
     │  TRIGGER recompute_atendimento_status → status_pagamento = 'Pagamento pendente'
     ▼
[EXAMES REALIZADOS]
     │  status per-exam: pendente → coletado → em_analise → finalizado
     │  TRIGGER recompute → status_atendimento updated
     ▼
[COBRANÇA DETERMINADA]
     │  atendimento_exames.cobranca_destino IN ('paciente', 'convenio')
     │  cobranca_destino='paciente'  → enters A-Receber (paciente sub-tab)
     │  cobranca_destino='convenio'  → enters A-Receber (convênio sub-tab / saldo em aberto)
     ▼
[PAGAMENTO REGISTRADO — PACIENTE]
     │  NovaEntradaSaidaDialog → update-atendimento Edge Fn → update_atendimento_tx
     │  INSERT atendimento_pagamentos (tipo, valor, observacao, data)
     │  TRIGGER recompute_atendimento_status
     │     total_pago < total_valor  → 'Pagamento parcial'
     │     total_pago >= total_valor → 'Pagamento efetuado'
     │  VIEW financeiro_entradas (pagamento branch) picks up row on next fetch
     ▼
[FATURAMENTO — CONVÊNIO]
     │  Financeiro aba A-Receber/Convênios → FecharFaturaDialog
     │  convenioFaturasStore.criarFatura() → INSERT convenio_faturas (status='aberta')
     │                                     → INSERT convenio_fatura_itens (N exames)
     │  marcarFaturaPaga() → UPDATE convenio_faturas SET status='paga', data_pagamento, forma_pagamento
     │  VIEW financeiro_entradas (fatura_convenio branch) → single aggregate entrada
     ▼
[CONCILIAÇÃO / LIVRO-CAIXA]
     │  Financeiro aba Caixa
     │  entradas (status='pago'|'pagamento efetuado') + saídas pagas (foiPago='Sim')
     │  Sorted chronologically; running saldo_acumulado computed client-side (Financeiro.tsx:622-628)
     ▼
[RELATÓRIO / IMPRESSÃO]
     │  imprimirDetalhado() → HTML print (filtered view)
     │  imprimirLivroCaixa() → HTML print with saldo inicial + running balance
```

---

## 1. Entradas — Read-Only Rule

**Memory rule:** "Entradas" are strictly read-only (driven by atendimentoStore).

**Implementation evidence:**
- `financeiroStore.fetchEntradasView()` issues `SELECT *` on view `financeiro_entradas` — no INSERT/UPDATE path exists. (financeiroStore.ts:308-333)
- The view is defined with `GRANT SELECT ON public.financeiro_entradas TO authenticated` (migration 20260419025053). No `GRANT INSERT/UPDATE/DELETE`.
- Financeiro.tsx:222-232: entradas filtered client-side; no mutation handler for entries with `tipo='entrada'`.
- Edit/Delete buttons are rendered only for `tipo==='saida'` entries (Financeiro.tsx:722-752).
- `handleNovaEntrada` (Financeiro.tsx:711-720): when `entry.tipo==='entrada'`, only calls `refreshEntradas()` — does NOT call addSaida or any write path.

**Conclusion:** Rule is correctly enforced at UI and database layers.

---

## 2. Regime de Caixa

- Only `status_pagamento IN ('pago','pagamento efetuado')` entries appear in "Entradas" tab (Financeiro.tsx:227-230).
- Saídas enter Caixa only when `foiPago === 'Sim'` (Financeiro.tsx:577-578).
- Pendentes/parciais are segregated in "A Receber" — never pollute cash flow.

---

## 3. Recebimento Parcial

- DB trigger `recompute_atendimento_status` (migration 20260417204746):
  - `total_pago > 0 AND total_pago < total_valor` → `'Pagamento parcial'`
  - `total_pago >= total_valor AND total_valor > 0` → `'Pagamento efetuado'`
- A-Receber legacy path (Financeiro.tsx:270-282):
  - `saldo = valorTotalPaciente - valorPago`; if `saldo <= 0.009` → excluded
  - `status = valorPago > 0 ? 'parcial' : 'pendente'`
- RPC path: status returned directly by `a_receber_pacientes_page`.
- **Gap:** The `0.009` float tolerance at Financeiro.tsx:272 is not applied in the DB trigger path, creating a theoretical R$0.01 discrepancy window between the two sources.

---

## 4. Desconto e Acréscimo

### Orçamentos
- `orcamentos.desconto` stored at header level (orcamentoStore.ts:19-21).
- `total = subtotal - desconto` computed in UI at creation; stored in `orcamentos.total`.
- No acréscimo field exists in orcamentos.

### Faturas de Convênio
- `convenio_faturas.desconto` and `.subtotal` and `.total` stored in header.
- `total = subtotal - desconto` computed in `convenioFaturasStore.criarFatura()` (line 290): `Math.max(0, subtotal - (input.desconto || 0))`.
- **Gap:** No per-item discount; discount is fatura-level only. No acréscimo field.
- **Gap:** `desconto` may not be recomputed if items are cancelled after fatura creation.

### Saídas
- No discount/surcharge concept. `valorTotal` is flat (FinanceiroSaida interface).

---

## 5. Estorno / Cancelamento

### Paciente payments
- No dedicated "estorno" endpoint; cancellation is achieved via `update-atendimento` Edge Fn with `cancelar_tudo=true`.
- On cancel, `recompute_atendimento_status` sets `status_pagamento = 'Pagamento cancelado'`.
- Financeiro.tsx:227: status filter is `'pago' | 'pagamento efetuado'` — cancelled payments disappear from Entradas automatically.
- **Gap:** Individual payment row deletion (partial reversal) is not surfaced in the UI. There is no UI flow for "estornar apenas um pagamento de um atendimento parcial".

### Fatura de convênio
- `cancelarFatura()` (convenioFaturasStore.ts:359-374): DELETEs all `convenio_fatura_itens`, then sets `convenio_faturas.status='cancelada'`.
- View `financeiro_entradas` filters `WHERE cf.status = 'paga'` — cancelled fatura disappears.
- **Gap:** Non-transactional — items DELETE succeeds but header UPDATE could fail, leaving orphan header in "aberta" state (convenioFaturasStore.ts:363-373, no BEGIN/COMMIT).

---

## 6. Convênio / Fatura Flow

1. `cobranca_destino='convenio'` exams are excluded from paciente A-Receber (Financeiro.tsx:265-267).
2. `fetchSaldoEmAbertoPorConvenio()` (convenioFaturasStore.ts:223): reads `atendimento_exames` directly, excludes `cancelado` and already-linked items.
3. Items not filtered by `status='finalizado'` — all non-cancelled exams appear in saldo, including `pendente`, `coletado`, `em_analise`. This is intentional ("saldo em aberto").
4. `fetchItensFaturaveis()` (line 173) filters `status='finalizado'` — only finished exams can be billed in a fatura.
5. Period filter for faturaveis is applied at `atendimentos.data` level (line 194-195), not `atendimento_exames.created_at`.

---

## 7. Inadimplência

- No dedicated "inadimplência" status in the DB schema.
- Client-side proxies: A-Receber shows `status='pendente'` (no payments made). Aging is implicit via `data` column.
- Saídas: `saidaStatusFilter='vencidas'` shows unpaid saídas where `dataVencimento < today` (Financeiro.tsx:413).
- **Gap:** No automated alerts, no ageing report (30/60/90 days), no blocking of new atendimentos for defaulted patients.

---

## 8. Summary: Rule Implementation Matrix

| Rule | Enforced in DB? | Enforced in UI? | Gap |
|---|---|---|---|
| Entradas read-only | ✅ VIEW + GRANT SELECT only | ✅ No write handlers | None |
| Regime de caixa | ✅ `status_pagamento` trigger | ✅ Filter on fetch | None |
| Pagamento parcial | ✅ trigger 20260417204746 | ✅ `saldo > 0.009` | Float tolerance mismatch |
| Desconto fatura | ⚠️ stored but not recalculated | ✅ `Math.max(0,subtotal-desc)` | No item-cancel recompute |
| Estorno | ⚠️ via full cancel only | ❌ No partial reversal UI | Critical gap |
| Cancelamento fatura | ❌ non-atomic delete | ✅ UI calls both steps | Orphan risk |
| Inadimplência/aging | ❌ No DB concept | ⚠️ Vencidas filter only | No aging, no blocking |
