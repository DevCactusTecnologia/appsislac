# WhatsApp / Z-API — Complexity Audit
> Audit date: 2025-07  |  Scope: cyclomatic, coupling, accidental complexity

---

## 1. Cyclomatic Complexity Hot-Spots

### 1a. `whatsapp-send/index.ts` — Main handler

| Branch | Lines | Notes |
|--------|-------|-------|
| OPTIONS preflight | 39 | trivial |
| Method ≠ POST | 43-45 | trivial |
| Missing env vars | 50-52 | trivial |
| Missing/bad auth | 54-67 | 2 conditions |
| JSON parse error | 71-75 | trivial |
| Phone validation | 77-80 | simple |
| pdfUrl validation | 81-83 | simple |
| `ativo = false` | 107-113 | early return |
| `modo = simples` | 121-128 | early return |
| `modo = cloud_api` | 136-168 | 4 sub-branches |
| `modo = zapi` | 169-203 | 4 sub-branches |
| catch outer | 205-207 | trivial |
| status check before response | 221-223 | trivial |

**Estimated CC ≈ 14** — within acceptable range for an edge function, but could be split into mode-specific handlers.

### 1b. `PdfPreviewDialog.tsx:handleWhatsapp()` — Lines 214-277

| Branch | Notes |
|--------|-------|
| `!buildWhatsappMessage` guard | |
| `ensureBlob` failure | |
| `comprovante` prop present + `whatsappPhone` | |
| `enviarPdfWhatsappCloud` success | |
| Error with `code = NAO_CONFIGURADO` | silent |
| Error with other code | toast warning |
| wa.me open (shortUrl) | |
| catch outer: upload failure | download + wa.me without URL |

**CC ≈ 8** — high for a React handler; testing this path requires mocking 5 async dependencies.

### 1c. `comprovantes.ts:enviarComprovantePorWhatsapp()` — Lines 1074-1121

CC ≈ 4 (validation, upload try/catch, shortlink try, open).

---

## 2. Coupling Analysis

### 2a. PdfPreviewDialog is over-coupled

`PdfPreviewDialog` (UI component) directly:
- Calls `uploadPdfAndGetUrl` (I/O)
- Calls `criarShortlinkPdf` (I/O)
- Calls `enviarPdfWhatsappCloud` (I/O)
- Reads mode-specific fallback logic (business rule)
- Handles toast notifications (UX)

This violates single-responsibility; any change to the send flow requires touching the dialog.

### 2b. Two parallel send paths for comprovantes

`comprovantes.ts:enviarComprovantePorWhatsapp` (lines 1074-1121) and `PdfPreviewDialog.ts:handleWhatsapp` (lines 214-277) **both implement the upload → shortlink → send/fallback pipeline** independently. One is used for simples-mode comprovantes; the other is used when the dialog is opened with cloud_api. They share the same steps but have different error semantics.

**Accrued complexity:** a bug fix to the upload-then-shortlink sequence must be made in two places.

### 2c. Orcamento vs. Comprovante divergence

Orcamento always uses `enviarOrcamentoPorWhatsapp` (simples, `comprovantes.ts:1038`) regardless of tenant's configured mode. This is undocumented — a tenant on cloud_api mode who expects orcamentos to be sent automatically will be surprised.

### 2d. Webhook single-tenant vs. multi-tenant

The webhook's HMAC uses a **single global** `WHATSAPP_APP_SECRET`. For a multi-tenant SaaS with each tenant having their own Meta App, this is technically incorrect — each tenant's webhook should be verified against its own app secret. Currently all tenants must share the same Meta App.

---

## 3. Accidental Complexity

| Issue | Location | Impact |
|-------|----------|--------|
| `longUrl` sent to cloud_api/zapi but `shortUrl` used in wa.me text | `PdfPreviewDialog.tsx:239 vs 263` | Patient receiving link in wa.me gets short URL; Meta document attachment is raw Storage URL (may expire/rotate differently) |
| `whatsapp_mensagens` initial `status` is either `'sent'` or `'failed'` — no `'pending'` intermediate | `whatsapp-send/index.ts:131,209` | Impossible to distinguish "enqueued not yet sent" from "sent and awaiting delivery confirmation" |
| `modo` column defaults to `'simples'` in DB but edge fn reads `cfg.modo ?? 'simples'` as string guard | `index.ts:116` | Redundant: the DB column already has `NOT NULL DEFAULT 'simples'`; the nullish coalesce can never fire if the row exists |
| `filename` sanitization regex `[^A-Za-z0-9._-]` → `_` applied in edge fn | `index.ts:117` | Sanitization also done by caller at `comprovantes.ts:899-901`; double-sanitization is harmless but redundant |
| `resultados_entregas`, `criticos_comunicacoes`, `orientacoes_entregues` record `canal='whatsapp'` but are manually filled | Migration `20260424013319` | These audit logs have no automatic link to `whatsapp_mensagens` — tracing "was this critical value actually sent?" requires manual correlation |

---

## 4. Test Coverage Observations

- No unit tests found for `whatsapp-send` or `whatsapp-webhook` functions.
- No integration tests found for the `PdfPreviewDialog` WhatsApp path.
- The HMAC verification function (`verifyMetaSignature`) is a pure function and is the only logic that could be trivially unit-tested.
- Fallback chains (5 different outcomes in `handleWhatsapp`) are entirely manual-QA territory.

---

## 5. Dependency Versions

| Dependency | Version | Risk |
|------------|---------|------|
| `@supabase/supabase-js` (edge fns) | `2.103.3` (pinned via esm.sh) | Pinned — updates require manual migration |
| Meta Graph API | `v21.0` hardcoded in `whatsapp-send/index.ts:148` | Meta deprecates old versions; requires code change to migrate |
| html2pdf.js | dynamic import, no version pinned | `comprovantes.ts:68` — unpinned `import("html2pdf.js")` |

