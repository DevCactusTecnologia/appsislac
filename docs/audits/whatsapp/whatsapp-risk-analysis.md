# WhatsApp / Z-API — Risk Analysis
> Audit date: 2025-07  |  Severity: 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low

---

## R-01 — Credential Storage in Plaintext 🔴 Critical

**Evidence:** `tenant_whatsapp_config` columns `access_token`, `zapi_token`, `zapi_client_token` are `TEXT` with no application-layer encryption (`migration 20260430182600`, `WhatsappCloudConfig.tsx:195-200`).

**Impact:** Any SQL injection, Supabase service-role key leak, or compromised super-admin account exposes every tenant's WhatsApp credentials simultaneously. A Meta System User token grants full send/read access to that Business Account.

**Mitigation:** Encrypt at application layer (e.g., pgcrypto `encrypt()` with a KMS-managed key) before insert; decrypt inside edge function using a secret env var. Alternatively, use Supabase Vault.

---

## R-02 — No Message Deduplication 🔴 Critical (at scale)

**Evidence:** `whatsapp-send/index.ts:209` — unconditional `INSERT` with no idempotency key. No unique constraint on `(tenant_id, atendimento_protocolo, tipo_documento, telefone_destino)`.

**Impact:** Double-clicking "Enviar WhatsApp", network retries, or re-rendering the dialog can send duplicate messages to the patient. At 1M messages/month this becomes significant noise and may trigger Meta's spam-detection rate limits (ban risk on the Business Account).

**Mitigation:** Add a unique index on `(tenant_id, atendimento_protocolo, tipo_documento)` with a short TTL window, or enforce an idempotency key passed from the frontend.

---

## R-03 — Single Global HMAC Secret for All Tenants 🟠 High

**Evidence:** `whatsapp-webhook/index.ts:98` — `Deno.env.get("WHATSAPP_APP_SECRET")` is a single process-level secret.

**Impact:** All tenants must share the same Meta App (same App Secret). A tenant cannot use a separate Meta App with its own App Secret. If the shared secret is rotated incorrectly, all webhook validation breaks simultaneously.

**Mitigation:** Store `app_secret` per-tenant in `tenant_whatsapp_config` (encrypted), look it up by correlating `phone_number_id` in the incoming webhook payload before HMAC verification.

---

## R-04 — Webhook Verify Token Global Lookup (Cross-Tenant) 🟠 High

**Evidence:** `whatsapp-webhook/index.ts:78-85` — `SELECT id FROM tenant_whatsapp_config WHERE webhook_verify_token = ?` with no tenant scoping.

**Impact:** Any tenant's verify_token completes the Meta handshake. If Token A belongs to Tenant 1, Tenant 2 could register Meta to send webhooks to the same URL using Tenant 1's token, and the handshake would succeed. Delivery status updates would then be misrouted (wrong `message_id` lookup — but confusion risk is real).

**Mitigation:** Encode the `tenant_id` in the verify token (e.g., `<tenantId>.<random>`) and verify both parts.

---

## R-05 — No Rate Limiting on `whatsapp-send` 🟠 High

**Evidence:** `whatsapp-send/index.ts` — no rate-limit middleware, no request counter.

**Impact:** A compromised JWT or a rogue frontend loop can exhaust the tenant's Meta messaging tier or Z-API quota in seconds. Meta imposes per-phone sending limits; exceeding them triggers quality-score penalties.

**Scalability (1M msgs/month):** At ~33K msgs/day, even a brief loop could saturate limits. No per-tenant or per-phone throttle exists.

**Mitigation:** Use Supabase's `pg_rate_limit` extension or a Redis-backed counter in the edge function; enforce per-tenant `(tenant_id, telefone_destino)` rate limits.

---

## R-06 — Z-API No Delivery Confirmation 🟡 Medium

**Evidence:** No Z-API webhook handler exists. `whatsapp_mensagens.status` stays `'sent'` permanently for Z-API mode.

**Impact:** The lab has no way to know if the patient received the PDF. For RDC 978/2025 compliance (critical value communication), absence of read-confirmation is an audit gap.

**Mitigation:** Implement a Z-API webhook endpoint (Z-API supports delivery callbacks) or periodically poll Z-API's message-status endpoint.

---

## R-07 — `comprovante_links` Anon Read Policy 🟡 Medium

**Evidence:** `migration 20260430182600` — `CREATE POLICY "Leitura publica por codigo" ON public.comprovante_links FOR SELECT TO anon USING (true)`.

**Impact:** Any anonymous user who guesses or discovers a 6-character code from a 32-char alphabet (32^6 ≈ 1.07B combinations) can download the patient's PDF. The PDF URL is a signed Storage URL, but the mapping is public.

**Mitigation:** Scope the anon policy to non-expired links (`WHERE expira_em > now()`); this is already the TTL intent but not enforced at RLS layer.

---

## R-08 — Multi-Tenant Credential Isolation 🟡 Medium

**Evidence:** `WhatsappCloudConfig.tsx:202-204` — `upsert` with `onConflict: "tenant_id"` from the frontend. RLS policy requires `admin` permission (`has_permission(auth.uid(), 'admin')`).

**Impact:** Correctly isolated at RLS level. However, the edge fn (`whatsapp-send`) uses service-role key to read `tenant_whatsapp_config` — if a bug passes the wrong `tenantId`, it could read another tenant's credentials. The tenant resolution chain (JWT → profiles → tenant_id) is the single point of failure.

**Mitigation:** Add assertion in edge fn that `tenantId` from profiles matches any tenant-scoped claim in JWT if available.

---

## R-09 — Scalability: Synchronous PDF Generation at 1M msgs/month 🟡 Medium

**Evidence:** `comprovantes.ts:852-883` — `html2pdf.js` runs `html2canvas` (scale=2) entirely on the client main thread.

**Impact:** PDF generation can take 3–8 seconds per document in the browser. At high concurrency (many lab staff sending simultaneously), UI freezes are likely. This is not a backend bottleneck but a UX/reliability one.

**Mitigation:** Move PDF generation server-side (Puppeteer/Chrome in a Deno worker) or use a pre-rendered PDF stored at laudo-release time.

---

## R-10 — `access_token` Visible in Browser Network Tab 🟢 Low

**Evidence:** `WhatsappCloudConfig.tsx:127-148` — reads `access_token` from `tenant_whatsapp_config` and populates a frontend state field.

**Impact:** The token is returned to the browser (though masked in the input). An attacker with DevTools access on an admin session sees the raw token in the network response.

**Mitigation:** Never return sensitive credential columns to the frontend. Store them write-only (INSERT/UPDATE accepted, SELECT returns masked value or null).

