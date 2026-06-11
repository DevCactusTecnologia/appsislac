# Business Rules — ResultadoDetalhe Flow

**Audit date:** 2025-07  
**Scope:** atendimento → exames → valores → laudo → assinatura → liberação → PDF → paciente

---

## 1. Generation pipeline (happy path)

### 1.1 Atendimento hydration

- Entry: `ResultadoDetalhe.tsx:78` reads `id` from URL param (= protocolo).
- Two branches gated by feature flags (lines 175–179):
  - `USE_LEGACY_STORE=true` → `getAtendimentos()` in-memory cache (MockAtendimento).
  - `paginated_atendimentos=true` (default new path) → `getAtendimentoExamesDB(id)` + `fetchAtendimentoByProtocolo(id)` direct DB queries.
- Patient demographics (`buildPacienteFromAtendimento`, helpers.ts:160) read from `MockAtendimento` or DB row; age is recalculated client-side via `calcIdadeAnosMeses` (helpers.ts:36 → `formatIdadeDetalhada`).

### 1.2 Exame loading (LayoutScientificRuntime)

For each non-TERCEIRIZADO exam row (ResultadoDetalhe.tsx:192–211):
1. Load `exame_parametros` (cached or DB).
2. `hidratarSegmentosParaDigitacao(catalogoId, nome, params, resultados)` (layoutScientificRuntime.ts:379):
   - `ensureDefaultLayout` — loads or auto-seeds the padrão layout.
   - `buildDigitacaoSegments` — parses `##KEY##` placeholders from HTML, emits `{ kind:"header" | "param" }` segments preserving section titles.
   - Dual-read: tries `chave → rotulo → abreviacao → UPPER(chave) → UPPER(rotulo)` to hydrate saved values from `resultados` jsonb (layoutScientificRuntime.ts:126–148).
3. Fall-through: exams with no catalogoId or failed hydration fall to single-param generic input (helpers.ts:110–123).

### 1.3 Valores (digitação)

- UI renders `ParamTypedInput` per segment, one of: `Select`, `Número`, `Formula` (disabled — "runtime ainda não implementado", ParamTypedInput.tsx:53–54), `Texto`.
- Each keystroke calls `updateParametro(exameId, paramIndex, valor)` → local React state only, no debounced save.
- Required params: `parametro.obrigatorio` flag, but **there is no enforcement gate at save time** — `handleSalvar` does not validate mandatory fields before persisting.

### 1.4 Save (Resultado Salvo)

`handleSalvar` (ResultadoDetalhe.tsx:521–564):
1. `buildResultadosByChave` — serializes params to `{chave: valor}` jsonb (canonical form).
2. `updateAtendimentoExame(dbId, { status:"em_analise", resultados, data_analise })`.
3. Supabase trigger is expected to update `atendimentos.status_atendimento` to "Resultado Salvo".
4. Local audit entry added (not persisted to `atendimento_audit`).
5. Popup shown; confetti does NOT fire on save, only on full liberation.

### 1.5 Reference Limits

Two independent resolution paths:

**Path A — Structured (valoresReferenciaStore):**  
`resolverReferencia(exameNome, paramNome, sexo, idade)` → returns `{ refMin, refMax, refUnidade }`.  
Used in: UI display (ResultadoDetalhe.tsx:434–443) and PDF rendering (laudoLayout.ts:121–141).

**Path B — Descriptive text (exame_parametros.valor_referencia):**  
Stored as free text in `parametro.valorReferencia`.  
Used as fallback in `getResolvedRef` (line 441) and as `##REF_<chave>##` placeholder when Path A returns null.

`parseValorReferencia.ts` is a **utility for admin import only**; it parses descriptive text into structured candidates. It is **not used at display time** within ResultadoDetalhe.

`isValueInRange` (from `ResultadoValidationBar`) uses a third comparison approach (imported at line 7) — adds a third code path for out-of-range detection separate from `criticoChecker.ts`.

### 1.6 Critical Values

`avaliarCritico(valor, criticoMin, criticoMax)` (criticoChecker.ts:29):
- Parses numerically (tolerant: comma/dot, strips `<>`).
- Returns `"critico_baixo"` if `v < min`, `"critico_alto"` if `v > max`, else `"normal"`.
- Thresholds come from `exame_parametros.critico_min/critico_max` — distinct from clinical reference limits.
- Lookup in `avaliarNivelCritico` (ResultadoDetalhe.tsx:370–378): matches by rotulo OR chave (lowercase), returns "normal" if no config found — **silent miss; no warning if parametroId not found in cache**.

When liberar is triggered and criticos detected:
1. `RegistrarCriticoDialog` must be filled (conduta, notificouMedico, revisado checkboxes).
2. Only after confirmation does `executarLiberacao` run.
3. `registrarLiberacaoCritica` then inserts into `atendimento_audit` with `resultado_critico=true`.

**Gap:** `handleLiberarTodos` (line 629) does **NOT** check for critical values — bulk release bypasses the critico gate entirely.

### 1.7 Interpretation / Flags

At render time in `laudoLayout.ts:47–55`:
- `flagFor(valor, refMin, refMax)` → `"↑"` / `"↓"` / `""`.
- Flag is injected via `##FLAG_<chave>##` placeholder in the layout HTML.
- Flags are cosmetic in the PDF; no business logic blocks release based on them.

### 1.8 Assinatura (Signature)

On component mount (ResultadoDetalhe.tsx:118–137):
1. Query `profiles` for `assinatura_tipo`, `assinatura_imagem_key`, `assinatura_conselho`.
2. If `tipo="imagem"`, call Edge `assinatura-url` → S3 presigned URL (1 h TTL).
3. Result cached in `assinaturaLaudo` state for the lifetime of the page.

Two modalities:
- **Carimbo** (text): CRM/conselho text appended to PDF footer.
- **Imagem**: base64/URL of scanned signature rendered inline in PDF.

In `buildLaudoHtml` the signature block is inline HTML; the presigned URL is embedded directly in the `<img src>`. **If the 1 h TTL expires during a long session, printing will show a broken image.**

`upload-assinatura` edge function: validates caller is self OR `has_role(admin)`; uploads to S3; writes `assinatura_imagem_key` to `profiles`.

### 1.9 Liberação (Release)

`executarLiberacao` (ResultadoDetalhe.tsx:592–626):
1. `updateAtendimentoExame(dbId, { status:"finalizado", data_liberacao, analista })`.
   - `analista` is `analistaAtual.nome` — hardcoded default `"Felipe Andrade Melo"` (line 116).
   - A user can change this via `showAlterarAnalista` modal + `validarCredenciaisAnalista`.
2. DB trigger updates `atendimentos.status_atendimento` to "Resultado Liberado" when all exams are "finalizado".
3. Local confetti + `CelebracaoLiberacaoDialog` when all exams are done.

**RBAC:**  
- Visual: `canLiberar = hasPermission("liberar_resultado") || hasPermission("editar_atendimento")` (line 90).  
- Backend: trigger `BEFORE UPDATE` on `atendimento_exames` re-validates (comment at line 86).

### 1.10 PDF generation & printing

`handleImprimir` / `handleGerarPdf` pattern (approximate, from buildLaudoHtml, lines 768+):
1. `preloadLayoutsParaExames` → parallel fetch of layouts+params.
2. For each liberado exam: `renderExameComLayout(...)` → substitutes placeholders.
3. Assemble with `buildLaudoHtml`: `@page` CSS, `<thead>/<tfoot>` for repeating header/footer.
4. Print via `printHtmlInHiddenFrame` OR html2pdf (client-side).
5. Regulatório footer: `resolveResultadoRegulatorio` → `renderRegulatorioFooterHtml` (RDC 786/2023 — metodologia/unidade snapshot).

Multi-solicitante: `printDialog` state offers "one copy per solicitante" or "single copy all" (lines 149–154).

### 1.11 History

Audit timeline (`auditLog` state, lines 247–321):
- Built locally from ISO timestamps of the DB row — NOT from `atendimento_audit` table.
- Every entry is attributed to `"Felipe Andrade Melo"` / `"FA"` hardcoded (lines 261–315) regardless of who actually performed the action.
- "Resultado salvo" entry carries param values; "Resultado retificado" entry notes: "Valores anteriores à retificação (não versionados)." — previous values are **not stored**, only current values after retification.

### 1.12 Attachments

Outsourced exams (`tipo_processo = "TERCEIRIZADO"`):
- Rendered by `ExamesTerceirizadosPanel` (read-only).
- PDF attachment resolved by `laudoResolver.ts` → `integration-pdf-resolve` edge function → priority: manual override PDF → provider-delivered PDF.
- Opens in new tab via `window.open`.

### 1.13 Retificação

Workflow:
1. User opens "Retificar" dialog, enters `retificarJustificativa`.
2. `retificando=true`, `retificados` set updated locally.
3. Save via `handleSalvar` with `retificado: true` patch — DB: `atendimento_exames.retificado=true`.
4. Release via `executarLiberacao` → status "finalizado" again, UI shows "Retificado".
5. `retificado_at` timestamp read from DB for audit display (line 276).

**Previous values are never versioned** — the audit shows the marker "Valores anteriores à retificação (não versionados)." This is a regulatory gap under RDC 786/2023 which requires traceability of alterations.

### 1.14 Sharing / Patient delivery

- **Comprovante shortlink**: `comprovante-shortlink` edge function creates a 6-char code stored in `comprovante_links` (url_assinada, expira_em). Resolved via `comprovante-resolve` (public GET). Counter incremented best-effort.
- WhatsApp: `whatsapp-send` edge function (separate from this flow but referenced in delivery UI).
- `comprovante-resolve` returns the stored `url_assinada` as-is. **If the underlying signed URL (e.g. S3 presigned) expires before the shortlink TTL (24 h default), the patient receives a broken link.**
