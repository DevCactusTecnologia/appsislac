# Single Source of Truth (SSOT) Audit — ResultadoDetalhe

**Audit date:** 2025-07  
**Focus:** Data consistency, duplicated definitions, and authoritative sources.

---

## 1. Clinical Reference Limits

### 1.1 Fragmented Resolution Paths
The system has three independent ways to determine if a value is "normal":
1. **Path A (Structured):** `valoresReferenciaStore.resolverReferencia` — used for PDF placeholders (`##REF_...`).
2. **Path B (Legacy/Text):** `exame_parametros.valor_referencia` — used as a fallback label in UI.
3. **Path C (Validation Bar):** `isValueInRange` (from `ResultadoValidationBar`) — imported and used for UI icons (Check/Alert).

- **Conflict:** If `resolverReferencia` has a bug or stale cache, the UI might show a "Success" icon (Path C) while the PDF prints a reference range that contradicts it (Path A).

---

## 2. Signatures & Identity

### 2.1 The "Felipe" Default
**Evidence:** `ResultadoDetalhe.tsx:116`
- **SSOT Violation:** The source of truth for the "current analyst" should be the authenticated session (`useAuth`), but here it is a hardcoded local state variable.

### 2.2 Signature Image URL
**Evidence:** `ResultadoDetalhe.tsx:131` vs `profiles.assinatura_imagem_key`
- **Issue:** The component caches a presigned URL. The SSOT for the *image* is S3, but the SSOT for the *access* is a short-lived URL. If the user updates their signature in another tab, this component continues to use (and potentially print) the old one until reload.

---

## 3. Exam Status & State

### 3.1 Status Mapping Proliferation
**Evidence:** `Complexity Audit Section 3.1`
There are 5+ different mappings of exam status:
- DB (`pendente`, `finalizado`)
- UI (`Pendente`, `Digitado`, `Retificado`)
- Label (`Análise Pendente`, `Digitado`)
- Filter (`matchesStatusFilter`)
- Type (`ExameStatus` union)

- **SSOT Violation:** There is no single `STATUS_CONFIG` object. Adding a status like "Em Validação" requires updating multiple switch statements and objects across 3 files.

---

## 4. Audit Trail

### 4.1 Local vs. Persistent Audit
- **Local State (`auditLog`):** Volatile, hardcoded names, covers all actions.
- **DB Table (`atendimento_audit`):** Persistent, used only for Critical Value notifications (`registrarLiberacaoCritica`).
- **DB Columns (`data_analise`, `data_liberacao`, `analista`):** Primary source for status history.

- **Issue:** The "History" tab in the UI is constructed from volatile DB columns rather than a dedicated audit log. Once a value is retified, the original "data_analise" is overwritten, losing the SSOT for the original event timing.

---

## 5. Calculations (Formulas)

### 5.1 Manual vs. Automatic
- **Status:** Formulas are not yet implemented in the runtime.
- **Risk:** Some exams might rely on manual calculation by the analyst (the human is the SSOT), while others (future) will be automatic. There is currently no "calculated_by: system" flag to distinguish the source of truth for a value.

