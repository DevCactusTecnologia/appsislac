# UX Audit — ResultadoDetalhe Flow

**Audit date:** 2025-07  
**Focus:** Friction, Efficiency, User Error Prevention

---

## 1. Process Friction & Click-Count

### 1.1 Multi-Step Liberation
**Current Flow:** 
1. Click "Assinar e Liberar" button.
2. Click "Confirmar e Liberar" in the Confirmation Modal.
3. (If Critical) Fill Conduta + Check 3 boxes + Click "Confirmar e Liberar" in Critical Modal.
- **Issue:** 2 to 6 clicks per exam. For an attendance with 10 exams, this is 20-60 clicks. The "Liberar Todos" bypasses safety (as noted in Risk Audit) but is the only efficient way.

### 1.2 Separate Save/Release
**Evidence:** `ResultadoDetalhe.tsx:1552, 1561`
The user must manually click "Salvar" before "Liberar" to ensure data integrity.
- **Issue:** Higher risk of data loss or releasing stale data. No "Save & Release" single action.

### 1.3 Navigation Overhead
**Current Flow:**
User must click each exam card header to expand the input fields.
- **Issue:** No "Expand All" or keyboard shortcut (Tab) to move between exams. Forces heavy mouse usage.

---

## 2. Information Scrutiny & Rework

### 2.1 Lack of Pre-Save Validation
**Evidence:** `handleSalvar` (`ResultadoDetalhe.tsx:521`)
There is no validation of mandatory fields (`param.obrigatorio`) before saving to the DB.
- **Issue:** Users can save incomplete results, which might be missed during liberation if the "Analisar" step is skipped or rushed.

### 2.2 Retification "Black Box"
**Evidence:** `ResultadoDetalhe.tsx:276`
When an exam is retified, the audit log shows "Valores anteriores à retificação (não versionados)."
- **Issue:** If an analyst needs to see *what* was corrected (e.g., was it a typo or a clinical change?), they cannot find it in the UI. Forces rework/manual checking of external logs if available.

### 2.3 Hardcoded Default Analyst
**Evidence:** `ResultadoDetalhe.tsx:116`
Defaults to "Felipe Andrade Melo". 
- **Issue:** Every other user in the lab must click to "Change Analyst" or perform work under the wrong identity by default. High friction for multi-user environments.

---

## 3. Visual Feedback & Clarity

### 3.1 Formula Inertia
**Evidence:** `ParamTypedInput.tsx:53–54`
Formula fields are rendered as disabled grey boxes with a title tooltip.
- **Issue:** There is no visual indicator in the exam list that an exam has "Dead" fields that won't calculate. Users might expect auto-calculation and wait for it.

### 3.2 Status Mapping Confusion
**Evidence:** `helpers.ts:39` (`STATUS_DB_TO_UI`)
The DB status `finalizado` is mapped to the UI label `"Digitado"`, but the action is called `"Liberar"`.
- **Issue:** Vocabulary mismatch between DB, Code, and UI labels (`Digitado` vs `Liberado` vs `Finalizado`) creates mental mapping overhead for developers and support.

