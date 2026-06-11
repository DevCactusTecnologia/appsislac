# Financeiro — Dependency Map

> Audit date: 2025-06-11 | Auditor: Senior Architect / Lab PO

---

## 1. Entry-point module tree

```
src/pages/Financeiro.tsx  (2 392 lines)
├── src/pages/Financeiro/types.ts          — TabType, SaidaStatusFilter, FinanceiroEntry, baseTabs, paymentIcons
├── src/pages/Financeiro/helpers.ts        — saidaToEntry, entradaViewToEntry, parseDate, maskDateBR, isValidDateBR
│
├── DATA STORES
│   ├── src/data/financeiroStore.ts        — getSaidas, subscribeFinanceiro, addSaida, updateSaida, removeSaida,
│   │                                        fetchEntradasView  (→ VIEW financeiro_entradas)
│   ├── src/data/financeiroListasStore.ts  — getTiposDespesa, getDestinosPagamento, getFormasPagamento,
│   │                                        subscribeListas, createItem, deleteItem, reloadAll
│   ├── src/data/convenioFaturasStore.ts   — fetchFaturas, fetchItensFatura, fetchItensFaturaveis,
│   │                                        fetchSaldoEmAbertoPorConvenio, criarFatura, marcarFaturaPaga, cancelarFatura
│   └── src/data/atendimentoStore.ts       — getAtendimentos, subscribe (READ-ONLY from Financeiro perspective)
│                                            atendimento_pagamentos touched via create/update Edge Functions
│
├── HOOKS
│   ├── src/hooks/useAReceberPacientes.ts  — useAReceberPacientes (RPC a_receber_pacientes_page),
│   │                                        useFinanceiroResumo  (RPC financeiro_resumo)
│   └── src/hooks/useEnsureStore.ts        — lazy hydration gate for ["financeiro","financeiroListas"]
│
├── FEATURE FLAGS (src/lib/featureFlags.ts)
│   ├── paginated_atendimentos             — switches A-Receber source from getAtendimentos() → RPC
│   └── USE_LEGACY_STORE                   — disables RPC path when ON
│
├── LAZY DIALOGS (code-split chunks)
│   ├── src/components/financeiro/CriarItemDialog.tsx
│   ├── src/components/financeiro/FecharFaturaDialog.tsx    — wraps criarFatura + marcarFaturaPaga
│   ├── src/components/financeiro/FaturaDetalheDialog.tsx   — wraps fetchItensFatura
│   └── src/components/NovaEntradaSaidaDialog.tsx           — persists to atendimento_pagamentos (entrada) / addSaida (saída)
│
└── SHARED UI
    ├── src/components/financeiro/SearchableSelect.tsx
    ├── src/components/financeiro/IntegracoesWebhookPanel.tsx
    └── src/components/shared/PageHeader.tsx
```

---

## 2. Supabase tables / views touched

| Object | Type | Read | Write | Owner |
|---|---|---|---|---|
| `financeiro_saidas` | Table | financeiroStore | financeiroStore (CRUD) | Financeiro |
| `financeiro_entradas` | **View** | financeiroStore.fetchEntradasView | — (read-only derived) | DB trigger |
| `atendimento_pagamentos` | Table | atendimentoStore, financeiro_entradas view | Edge Fn create/update-atendimento | Atendimento |
| `atendimentos` | Table | atendimentoStore, convenioFaturasStore | Edge Fn create/update-atendimento | Atendimento |
| `atendimento_exames` | Table | convenioFaturasStore (faturáveis, saldo) | Edge Fn | Atendimento |
| `convenio_faturas` | Table | convenioFaturasStore | convenioFaturasStore | Financeiro |
| `convenio_fatura_itens` | Table | convenioFaturasStore | convenioFaturasStore | Financeiro |
| `financeiro_tipos_despesa` | Table | financeiroListasStore | financeiroListasStore | Financeiro |
| `financeiro_destinos_pagamento` | Table | financeiroListasStore | financeiroListasStore | Financeiro |
| `financeiro_formas_pagamento` | Table | financeiroListasStore | financeiroListasStore | Financeiro |
| `convenios` | Table | convenioFaturasStore (join), Financeiro.tsx L16 | — | Master data |
| `orcamentos` | Table | orcamentoStore | orcamentoStore | Orçamentos |

---

## 3. Database RPCs consumed

| RPC | Called from | Purpose |
|---|---|---|
| `a_receber_pacientes_page` | useAReceberPacientes.ts:62 | Paginated A-Receber (flag-gated) |
| `financeiro_resumo` | useAReceberPacientes.ts:140 | Aggregate totals (flag-gated) |
| `create_atendimento_tx` | create-atendimento Edge Fn | Transactional create |
| `update_atendimento_tx` | update-atendimento Edge Fn | Transactional update/payment/cancel |
| `recompute_atendimento_status` | DB trigger after INSERT/DELETE on `atendimento_pagamentos` | Derives `status_pagamento` |
| `current_tenant_id` | financeiroListasStore:41, financeiroStore via _tenant | Tenant isolation |

---

## 4. Realtime subscriptions

| Channel | Table | Handler | File |
|---|---|---|---|
| `atendimentos-store` (centralised) | `atendimentos`, `atendimento_pagamentos`, `atendimento_exames` | triggers `subscribeAtendimentos` listeners | atendimentoStore.ts:582 |
| none (polling) | `financeiro_entradas` view | `refreshEntradas()` called on atendimentos store event | Financeiro.tsx:209-213 |

> **Note:** `financeiro_entradas` is a VIEW and cannot subscribe to Realtime directly. Updates propagate via the atendimentoStore channel — see §Risk for latency implications.

---

## 5. Inter-page data flow

```
Orçamentos.tsx ──markAsConverted()──▶ orcamentos.convertido=true
                                       (atendimento created separately by user)

Atendimento flow ──(create/update Edge Fn)──▶ atendimento_pagamentos
                                               atendimento_exames
                                               atendimentos.status_pagamento (trigger)
                                                   │
                                                   ▼
Financeiro.tsx ──fetchEntradasView()──▶ financeiro_entradas VIEW (read-only)
               ──getAtendimentos()──▶  local cache (A Receber legacy path)
               ──fetchSaldoEmAbertoPorConvenio()──▶ atendimento_exames direct read

convenioFaturasStore ──criarFatura()──▶ convenio_faturas + convenio_fatura_itens
                     ──marcarFaturaPaga()──▶ convenio_faturas.status='paga'
                                             ──▶ financeiro_entradas VIEW (fatura_convenio branch)
```

---

## 6. Orphaned / legacy code flags

| Item | Location | Risk |
|---|---|---|
| `buildSaidaFromRow` marked `@deprecated` | financeiroStore.ts:94 | Dead code; confuses future devs |
| Legacy A-Receber path (getAtendimentos) | Financeiro.tsx:257-286 | Capped at store's 100-record boot limit |
| `getNextFaturaCodigo` marked `@deprecated` | convenioFaturasStore.ts:270 | FAT-TMP code sent to DB then overwritten by trigger — redundant round-trip |
| `_counter` manual counter | orcamentoStore.ts:27 | Duplicates server-side sequence; race condition possible |
