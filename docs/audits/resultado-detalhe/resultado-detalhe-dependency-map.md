# Dependency Map — ResultadoDetalhe Flow

**Audit date:** 2025-07  
**Auditor role:** Senior Architect + Lab PO + QA

---

## 1. Entry-point component tree

```
src/pages/Resultados.tsx                   ← list page (entry)
  └─ navigate("/resultado/:protocolo")
       └─ src/pages/ResultadoDetalhe.tsx   ← 2 619 lines, monolith
            ├─ src/pages/ResultadoDetalhe/types.ts          (ExameStatus, Parametro, Exame, Paciente, DbIdMap)
            ├─ src/pages/ResultadoDetalhe/helpers.ts        (pure fns: buildExamesFromDB, buildPacienteFromAtendimento, deriveStatusGeral, …)
            └─ src/pages/ResultadoDetalhe/ParamTypedInput.tsx (typed input renderer)
```

Also reachable via `/consultar-resultado/:id` (`modoConsulta = true`).

---

## 2. Data stores consumed

| Store / source | File | What it provides |
|---|---|---|
| `atendimentoStore` | `src/data/atendimentoStore.ts` | `getAtendimentoExamesDB`, `updateAtendimentoExame`, `fetchAtendimentoByProtocolo`, `getAtendimentos` |
| `exameCatalogoStore` | `src/data/exameCatalogoStore.ts` | `getExamesCatalogo` — name→id lookup |
| `exameParametrosStore` | `src/data/exameParametrosStore.ts` | `loadParametros`, `getParametros` — critico_min/max, tipo, chave |
| `exameLayoutsStore` | `src/data/exameLayoutsStore.ts` | `loadLayouts`, `addLayout` |
| `valoresReferenciaStore` | `src/data/valoresReferenciaStore.ts` | `resolverReferencia` — structured ref limits |
| `labApoioStore` | `src/data/labApoioStore.ts` | `getLabsApoio` — support lab detection |
| `labConfigStore` | `src/data/labConfigStore.ts` | lab info for PDF header |
| `documentoTemplatesStore` | `src/data/documentoTemplatesStore.ts` | `getTemplatePadrao` — header/footer |
| `motivosCancelamentoStore` | `src/data/motivosCancelamentoStore.ts` | cancellation reasons |
| `featureFlags` | `src/lib/featureFlags.ts` | `USE_LEGACY_STORE`, `paginated_atendimentos` |
| Supabase `profiles` | direct `supabase.from("profiles")` call at ResultadoDetalhe.tsx:123 | assinatura_tipo, assinatura_imagem_key, assinatura_conselho |
| Supabase `atendimento_audit` | via `criticoAudit.ts` | critical release audit trail |

---

## 3. Library layer

```
src/lib/
  layoutScientificRuntime.ts   ← SSOT for digitação pipeline
    ├── uses: exameLayoutsStore, exameParametrosStore
    └── uses: laudoTemplate.ts (auto-seed buildLayoutTemplate)

  laudoLayout.ts               ← HTML render from layout + resultados jsonb
    ├── uses: exameLayoutsStore, exameParametrosStore
    └── uses: valoresReferenciaStore (resolverReferencia for REF_/FLAG_ placeholders)

  criticoChecker.ts            ← stateless: avaliarCritico, isCritico
  criticoAudit.ts              ← writes atendimento_audit (Supabase)
    └── uses: protocoloLookup.ts, persist.ts

  regulatorioResolver.ts       ← COALESCE(snapshot, catalog) for metodologia/unidade (RDC 786/2023)
  regulatorio.ts               ← TUSS/CBHPM validation helpers (used in catalog config, not in render)

  documentoRenderer.ts         ← renderCabecalhoPadrao / renderRodapePadrao
    ├── uses: documentoTemplatesStore
    └── uses: mapaPlaceholders.ts

  parseValorReferencia.ts      ← heuristic text→FaixaCandidato (used in admin import)
  idadeFaixas.ts               ← age-range helpers (used in admin config of valores_referencia)

  printHtml.ts                 ← printHtmlInHiddenFrame
  laudoResolver.ts             ← resolverLaudoPdf → Edge: integration-pdf-resolve
```

---

## 4. Edge functions called from this flow

| Function | Caller location | Purpose |
|---|---|---|
| `assinatura-url` | ResultadoDetalhe.tsx:131 | Pre-signed URL for analyst signature image (S3, 1 h TTL) |
| `upload-assinatura` | Profile settings (not directly from ResultadoDetalhe) | Upload/remove analyst signature to S3 |
| `integration-pdf-resolve` | `laudoResolver.ts:25` | Resolve PDF of outsourced exam (override → provider) |
| `comprovante-resolve` | `src/pages/[public route]` | Resolve shortlink → signed URL (public, no JWT) |
| `comprovante-shortlink` | `src/lib/comprovantes.ts` | Create short PDF link (JWT required) |

---

## 5. Call-graph: Save → Release → Print

```
User edits param value
  → updateParametro(exameId, paramIndex, valor)       [local state only]

User clicks "Salvar"
  → handleSalvar()
      → buildResultadosByChave(params, values)        [layoutScientificRuntime.ts]
      → updateAtendimentoExame(dbId, {status:"em_analise", resultados})
      → addAuditEntry(exameId, "Resultado salvo")     [local state — NOT persisted to DB audit table]

User clicks "Liberar"
  → handleAnalisarLiberar()
      → getParametrosCriticosDoExame(exam)
          → avaliarNivelCritico → avaliarCritico()    [criticoChecker.ts]
      [if critico] → open CriticoConfirm modal
      → executarLiberacao(dbId)
          → updateAtendimentoExame(dbId, {status:"finalizado", data_liberacao, analista})
          → [if critico] registrarLiberacaoCritica()  [criticoAudit.ts → atendimento_audit]
          → addAuditEntry(exameId, "Resultado liberado") [local state only]

User clicks "Imprimir"
  → preloadLayoutsParaExames(exameNomes)              [laudoLayout.ts]
  → for each exam: renderExameComLayout(...)          [laudoLayout.ts]
      → loadLayouts + loadParametros
      → buildValueMap (resultados + resolverReferencia)
      → applyPlaceholders (##KEY##, {{key}}, {key}, #key)
  → buildLaudoHtml(exames, customByExame)             [ResultadoDetalhe.tsx]
      → renderCabecalhoPadrao / renderRodapePadrao    [documentoRenderer.ts]
      → renderRegulatorioFooterHtml                   [regulatorioResolver.ts]
      → [assinatura] carimbo or presigned img URL
  → printHtmlInHiddenFrame(html)                      [printHtml.ts]
```

---

## 6. useResultadosPage (list page)

```
src/pages/Resultados.tsx
  ├── [feature flag paginated_atendimentos=true] → useResultadosPage(filters, enabled)
  │     └── supabase.rpc("resultados_page", …) — cursor-based pagination
  └── [flag=false] → getAtendimentos() — in-memory legacy store (MockAtendimento[])
```

Dual data paths coexist and are gated by `featureFlags`.

---

## 7. Supabase tables touched

| Table | Operations |
|---|---|
| `atendimento_exames` | SELECT (list), UPDATE (save/release/cancel/recoleta) |
| `atendimentos` | SELECT via `fetchAtendimentoByProtocolo` |
| `profiles` | SELECT (assinatura fields), via admin in edge functions |
| `atendimento_audit` | INSERT (critical values only via criticoAudit.ts; regular audit is local state) |
| `exame_layouts` | SELECT via loadLayouts, INSERT via ensureDefaultLayout (auto-seed) |
| `exame_parametros` | SELECT via loadParametros |
| `comprovante_links` | INSERT (shortlink), SELECT+UPDATE (resolve+counter) |
| `tenants` | SELECT (CNPJ for S3 key, dominio_custom for shortlink) |
