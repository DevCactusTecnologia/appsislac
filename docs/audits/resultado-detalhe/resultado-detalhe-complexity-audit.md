# Complexity Audit — ResultadoDetalhe Flow

**Audit date:** 2025-07

---

## 1. Size & structure

| File | Lines | Issue |
|---|---|---|
| `src/pages/ResultadoDetalhe.tsx` | **2 619** | God component: state, business logic, PDF assembly, print layout, dialogs |
| `src/lib/laudoLayout.ts` | 247 | Acceptable |
| `src/lib/layoutScientificRuntime.ts` | 387 | Acceptable |
| `src/lib/documentoRenderer.ts` | 325 | Acceptable |

The 2 619-line component violates single-responsibility. It contains at minimum 8 distinct concerns that could each be a hook or sub-component.

---

## 2. Duplicated logic (code duplication)

### 2.1 `calcStatusGeral` duplicated
- `deriveStatusGeral` in `helpers.ts:147–158` — pure function, exported.
- `calcStatusGeral` **re-declared inline** in `ResultadoDetalhe.tsx:490–499` — identical logic.
- `calcStatusGeral` is called from `updatePacienteExames` (line 505), while `deriveStatusGeral` is called from `buildPacienteFromAtendimento`. Both exist simultaneously.

### 2.2 `escapeHtml` tripled
- `laudoTemplate.ts:89` — local private function.
- `regulatorioResolver.ts:77` — local private function.
- `laudoLayout.ts` — not shown in excerpt but same normalization pattern used throughout.
No shared utility; three identical implementations.

### 2.3 Numeric parser duplicated
- `parseNum(s)` in `laudoLayout.ts:40`.
- `parseNumeric(val)` in `criticoChecker.ts:18`.
Same algorithm (comma→dot, parseFloat, isFinite check), different names.

### 2.4 Duplicate terceirizado detection
- `isExameTerceirizadaById(uiId)` (ResultadoDetalhe.tsx:406–411): checks `dbRows` by `tipo_processo`.
- `isExameTerceirizada(exameNome)` (lines 412–418): checks catalog + labApoio.
- `selectedIsTerceirizada` (line 429–431) ORs both. If they disagree, one wins silently.

### 2.5 Date formatter duplicated
- `fmtDateTime` inline closure in `reloadExames` (lines 240–243).
- `addAuditEntry` formats its own `dataHora` identically (lines 393–394).
Same 25-line format string repeated.

---

## 3. Multiple sources of truth (see also ssot doc)

### 3.1 Status mapping layers
```
DB status (atendimento_exames.status)
  → STATUS_DB_TO_UI (helpers.ts:39)       maps em_analise → "Resultado salvo", finalizado → "Digitado"
  → statusDbToUi()  (helpers.ts:49)       layered on top, adds "Retificado"/"Em retificação"
  → ExameStatus union (types.ts:5)        UI type
  → statusAnaliseLabel() (line 738)       human label (a 4th mapping)
  → matchesStatusFilter() (line 445)      filter logic (5th hardcoded set)
```
Adding a new status requires touching 5 places.

### 3.2 isExameLiberado defined twice
- `isExameLiberado` function (ResultadoDetalhe.tsx:750).
- Equivalent inline check: `e.status === "Digitado" || e.status === "Impresso" || e.status === "Retificado"` repeated at lines 151, 153, 475, 495, 654 without calling the function.

### 3.3 Signature URL lifecycle
- Fetched on mount (lines 118–137), stored in `assinaturaLaudo` state.
- Used later in `buildLaudoHtml` when printing.
- No re-fetch on expiry (1 h S3 TTL). Long sessions will embed an expired URL in the PDF.

---

## 4. Dead / inert code

### 4.1 `templatesParametrosLegado` (helpers.ts:14–27)
Declared as `Record<string, …> = {}` — always empty. Referenced in `buildPacienteFromAtendimento` for fallback nome/sexo/etc., but will never contribute data. Comment says "Mantido vazio." Safe to delete.

### 4.2 `Formula` type in ParamTypedInput
`ParamTypedInput.tsx:53–54`: Formula renders a disabled input with `title="Tipo Fórmula: runtime ainda não implementado."` Formula parameters are silently ignored at save time (their empty value is persisted). There is no UI warning that these are non-functional.

### 4.3 `showImportarDialog` state
`showImportarDialog` state (line 104) — toggled but the corresponding dialog/modal is not visible in the audited lines. May be dead state.

### 4.4 `statusAnterior` state (line 139)
`statusAnterior: Record<number, ExameStatus>` — declared but never populated in the audited sections. Likely dead state from a previous retificação approach.

### 4.5 `assinaturaRightOffsetMm` calculation (line 783)
`Math.max(0, Math.max(m.right, 15) - m.right)` — with `m.right=11` this always equals `4`. The variable is declared but only partially used; final `assinaturaLineWidthMm` depends on it but the actual rendered HTML line width for signature is hardcoded to `60mm` in the template string (not visible in excerpts but typically found in signature block).

---

## 5. Fragile implicit contracts

### 5.1 `dbIdMap` as the only bridge between UI id and DB row id
UI exame IDs are assigned as `idx + 1` (helpers.ts:125). The `dbIdMap` maps `uiId → dbRow.id`. If `buildExamesFromDB` is called twice with different row orderings (e.g. after a reload), `dbIdMap` is replaced atomically — but between the old `setDbRows` and the new `setDbIdMap` there is a brief inconsistency window where `dbIdMap[selectedExameId]` could resolve to the wrong DB row.

### 5.2 `handleLiberarTodos` critico bypass
`handleLiberarTodos` (line 629–677) iterates liberáveis and calls `updateAtendimentoExame` directly **without** calling `getParametrosCriticosDoExame`. Critical value gate is fully bypassed in bulk release — a clinical safety rule is silently ignored.

### 5.3 Audit log attribution hardcoded
All audit log entries (lines 261–315 and `addAuditEntry:397`) attribute actions to `"Felipe Andrade Melo"` / `"FA"`. The real authenticated user (`authUser`) is available via `useAuth()` but only used for the signature fetch. Actions visible to staff in the audit panel are therefore misleading.

### 5.4 No save-before-release enforcement
`handleAnalisarLiberar` calls `executarLiberacao` even if the exam is still `"Pendente"` (no save was performed). The DB update sets `status:"finalizado"` with an empty `resultados` jsonb.
