# WhatsApp / Z-API — Single Source of Truth Audit
> Audit date: 2025-07

---

## 1. Templates (Message Text)

**Current state: No SSOT — templates are scattered across 3 locations.**

| Location | Content | Editable? |
|----------|---------|-----------|
| `comprovantes.ts:1111-1119` | Comprovante message body (simples mode) | Code only |
| `PdfPreviewDialog.tsx:buildWhatsappMessage` prop (injected by callers) | Comprovante message for cloud_api | Code only, per callsite |
| `comprovantes.ts:1052-1070` | Orcamento message body | Code only |
| `whatsapp-send/index.ts:118` | Caption truncation at 1024 chars | Edge fn config |

**Problem:** The same message for a "comprovante de pagamento" is built differently depending on whether mode is simples (`comprovantes.ts:1111`) or cloud_api (`PdfPreviewDialog.tsx` caller). Changing the greeting requires touching multiple files.

**Recommendation:** Introduce a `whatsapp_templates` table keyed by `(tenant_id, tipo_documento)` with a `corpo TEXT` column and `{{variavel}}` substitution. The edge fn renders the template server-side. Fallback to hardcoded defaults if no custom template exists.

---

## 2. Queues / Delivery Pipeline

**Current state: No queue — fully synchronous.**

| Aspect | State |
|--------|-------|
| Queue table | None |
| Retry queue | None |
| Dead-letter queue | None |
| `whatsapp_mensagens` as implicit queue | `status='failed'` rows are never retried automatically |

The `whatsapp_mensagens` table functions as a delivery log but not as a queue. Failed sends are permanent failures unless an attendant manually retries.

**Recommendation:** Add `next_retry_at TIMESTAMPTZ`, `retry_count INT` to `whatsapp_mensagens`. A Supabase cron job (`pg_cron`) picks up rows where `status='failed' AND retry_count < 3 AND next_retry_at < now()` and calls `whatsapp-send`.

---

## 3. Logs

| Log type | Where | Gaps |
|----------|-------|------|
| Send attempt (cloud_api / zapi) | `whatsapp_mensagens` row | ✅ Always written |
| Send attempt (simples) | Nowhere | 🔴 No record of wa.me opens |
| Send attempt (orcamento) | Nowhere | 🔴 `enviarOrcamentoPorWhatsapp` never writes any log |
| Delivery confirmation (cloud_api) | `whatsapp_mensagens.status` updated by webhook | ✅ |
| Delivery confirmation (zapi) | Never | 🔴 |
| Critical value notification via WhatsApp | `criticos_comunicacoes.canal='whatsapp'` | ✅ Manual entry; no automatic link to `whatsapp_mensagens` |
| Result delivery via WhatsApp | `resultados_entregas.canal='whatsapp'` | ✅ Manual entry; no automatic link |
| Config changes | No audit log on `tenant_whatsapp_config` | 🟡 Credential rotation is invisible |

---

## 4. Credential SSOT

**Problem:** Three sets of credentials can coexist in `tenant_whatsapp_config` simultaneously (cloud_api fields + zapi fields + numero_simples). Only the active `modo` is used at send time. Stale credentials for unused modes accumulate in plaintext.

**Recommendation:** Clear credentials for non-active modes on save, or encrypt all credential columns with per-tenant keys.

---

## 5. Phone Normalization SSOT

Phone normalization (`replace(/\D/g,"")` + prepend `"55"` if missing) is implemented in:
- `whatsapp-send/index.ts:32-36` (`normalizePhone`)
- `comprovantes.ts:1026-1035` (`buildWaUrl`)

Two implementations of the same rule. If Brazil ever changes the country-code prefix or rules, both must be updated.

**Recommendation:** Extract to `_shared/phoneUtils.ts` in edge functions and a shared frontend util.

---

## 6. Mode Enum SSOT

The mode type `"simples" | "cloud_api" | "zapi"` is declared in:
- `WhatsappCloudConfig.tsx:19` (TypeScript type alias)
- `migration 20260430192530` (PostgreSQL ENUM `public.whatsapp_modo`)
- `whatsapp-send/index.ts:116` (string comparison, no TypeScript type)

No shared Zod schema or generated types bridge the DB enum to the frontend type — a new mode added to the DB enum requires manual updates in all three places.

