# WhatsApp / Z-API — Business Rules Audit
> Audit date: 2025-07  |  Evidence: code references below

---

## 1. Mode Selection Rules

**Source:** `WhatsappCloudConfig.tsx:19`, `whatsapp-send/index.ts:116`

| Mode | Trigger | Backend call | Delivery log |
|------|---------|--------------|--------------|
| `simples` | Default; `ativo` can be true but no credentials needed | Edge fn returns 412 immediately (`comprovantes.ts:1038` never calls edge fn) | None |
| `cloud_api` | Requires `phone_number_id` + `access_token` | POST Meta Graph v21 | `whatsapp_mensagens` row |
| `zapi` | Requires `zapi_instance_id` + `zapi_token` | POST Z-API REST | `whatsapp_mensagens` row |

**Rule:** If `ativo = false`, edge fn returns 412 `"WhatsApp nao configurado"` — validated at `index.ts:107`.

**Rule:** `enviarOrcamentoPorWhatsapp` (`comprovantes.ts:1038`) **never** calls `whatsapp-send`. Orçamentos always use wa.me regardless of mode.

---

## 2. Notification / Send Rules

### 2a. Comprovante (pagamento, atendimento, comparecimento)

**Source:** `PdfPreviewDialog.tsx:214-277`, `comprovantes.ts:1074-1121`

1. PDF rendered client-side via html2pdf (html2canvas scale=2).
2. Blob uploaded via `upload-pdf` edge fn → public Storage URL (`longUrl`).
3. Shortlink created via `comprovante-shortlink` edge fn (`shortUrl`, TTL 24 h).
4. **If `whatsappPhone` + `comprovante` props set:**
   - Try `whatsapp-send` with `longUrl` (not shortUrl — see §6 SSOT).
   - On `WHATSAPP_NAO_CONFIGURADO` → silent fallback to wa.me.
   - On any other error → toast warning + fallback.
5. **Fallback:** `window.open(wa.me?text=<msg with shortUrl>)`.
6. **Upload failure:** download PDF locally → open wa.me with instructions to attach manually.

**Missing rule:** No business rule prevents the same `(protocolo, tipo, telefone)` from being sent multiple times — no idempotency check.

### 2b. Resultado Liberado

**Source:** `ResultadoDetalhe.tsx:84-2147` — No WhatsApp send found in this page.

`ResultadoDetalhe` does not call `whatsapp-send` or `enviarComprovantePorWhatsapp`. Result-release flow is separate from the comprovante-send flow. A patient is **not** automatically notified via WhatsApp when a laudo is released.

### 2c. Código de Confirmação / Verificação

**Source:** `comprovantes.ts:160-168`

```ts
export function codigoVerificacao(input: string): string {
  let h = 0x811c9dc5;
  // FNV-1a hash → 8-char hex → "XXXX-XXXX"
}
```

- Deterministic FNV-1a hash of `tipo|protocolo|pacienteNome|data|total`.
- QR code in comprovante PDF links to `/verificar/<codigo>`.
- This is a **document integrity code**, not a WhatsApp OTP/confirmation code.
- No table lookup on generation — verification page recomputes and compares.

**Risk:** Two different patients with the same name, same protocol format, same date, and same total would get the same verification code (birthday collision risk; acceptable given clinical data uniqueness).

---

## 3. Templates

**Source:** `comprovantes.ts:1111-1119`, `PdfPreviewDialog.tsx:161-175` (buildWhatsappMessage prop)

There is **no server-side template table** for WhatsApp message text. All message bodies are:
- Constructed inline as multiline template literals.
- Passed as `caption` (≤1024 chars, truncated at `whatsapp-send/index.ts:118`) for cloud_api/zapi.
- Embedded in wa.me `?text=` for simples mode.

No tenant can customize the WhatsApp message text from the UI — it is hardcoded per document type.

---

## 4. Retentativas (Retries)

**Source:** `whatsapp-send/index.ts:135-207`

- **Zero retries.** A single `fetch()` call to Meta/Z-API with no retry loop.
- On network failure: `catch(e)` sets `erroMsg`, writes `status='failed'` to `whatsapp_mensagens`.
- **Frontend retry:** The user can click "Enviar WhatsApp" again — this creates a new `whatsapp_mensagens` row. No idempotency guard at DB level.

---

## 5. Falhas e Tratamento de Erro

| Scenario | Edge fn response | Frontend action |
|----------|-----------------|----------------|
| `ativo = false` | 412 | Silent fallback to wa.me (code≠NAO_CONFIGURADO not triggered) |
| `modo = simples` | 412 | Same |
| Meta API returns non-2xx | 502 | toast "Falha no envio oficial" + wa.me fallback |
| Z-API returns non-2xx | 502 | same |
| No `messageId` in response | 502 | same |
| Network timeout | 502 (catch block) | same |
| `WHATSAPP_APP_SECRET` missing | webhook returns 503 | (outbound not affected) |
| Invalid HMAC in webhook | 401 | Meta retries per its own policy |

**Observation:** `whatsapp_mensagens` is **always inserted** regardless of success/failure (`index.ts:209-219`), providing an audit trail. However the `status` initial value in the INSERT is derived from the send result, not `'pending'` — there is no "in-flight" state.

---

## 6. Webhooks

**Source:** `whatsapp-webhook/index.ts`

### 6a. Meta handshake (GET)
- Verifies `hub.verify_token` against **any** tenant's `webhook_verify_token` in `tenant_whatsapp_config`.
- Returns raw `hub.challenge`.
- **Cross-tenant risk:** A tenant whose verify_token is leaked can accept webhooks meant for another tenant's verification (token is shared in a global lookup without tenant scoping at handshake time).

### 6b. Delivery status (POST)
- HMAC-SHA256 verified against `WHATSAPP_APP_SECRET` (single global secret).
- Parses `entry[].changes[].value.statuses[]` — standard Meta Cloud API format.
- Updates `whatsapp_mensagens` by `message_id`.
- Status values accepted: `sent`, `delivered`, `read`, `failed`; anything else coerced to `'sent'`.
- **No Z-API webhook handler.** Z-API delivery status is never received.

### 6c. CORS
- Webhook returns `Access-Control-Allow-Origin: *` — acceptable for a server-to-server callback endpoint but unnecessary and mildly permissive.

---

## 7. Mode-Specific Rules Summary

| Rule | simples | cloud_api | zapi |
|------|---------|-----------|------|
| Backend send | ✗ | ✓ | ✓ |
| `whatsapp_mensagens` written | ✗ | ✓ | ✓ |
| Delivery status via webhook | ✗ | ✓ | ✗ |
| PDF sent as native attachment | ✗ | ✓ (document msg) | ✓ (document msg) |
| Caption truncated at 1024 chars | N/A | ✓ | ✓ |
| Phone prefix `55` added if missing | N/A | ✓ | ✓ |
| Orcamento support | ✓ | ✗ (bypassed) | ✗ (bypassed) |
| Shortlink in message text | ✓ | ✗ (longUrl used) | ✗ (longUrl used) |

