# Portal Paciente — Risk Analysis (Security, LGPD, Multi-tenant)

**Date:** 2025-07  
**Severity scale:** CRITICAL / HIGH / MEDIUM / LOW

---

## CRITICAL

### R-01 — Stored Pre-signed URL Expiry Mismatch (PDF Availability Broken)
- **Evidence:** `upload-pdf/index.ts:165` returns a 1-hour signed URL; `comprovante-shortlink/index.ts:87` default TTL is 24h; the signed URL is stored verbatim in `comprovante_links.url_assinada` (`comprovante-shortlink/index.ts:115`).
- **Impact:** After ~1 hour, patients following the shortlink receive a broken/access-denied PDF even though the shortlink is still "valid". Patient harm: inability to retrieve clinical document.
- **Fix:** On resolve, regenerate the signed URL from the stored object key rather than returning the stored signed URL. Requires storing `object_key` in `comprovante_links` instead of (or in addition to) `url_assinada`.

### R-02 — Verification Code Uses Non-Cryptographic PRNG (`leads-manager`)
- **Evidence:** `leads-manager/index.ts:44` — `Math.floor(100000 + Math.random() * 900000)`.
- **Impact:** V8's `Math.random()` is predictable. An attacker who submits multiple leads can observe the sequence and predict future OTP codes, bypassing WhatsApp phone verification for SaaS sign-up.
- **Fix:** Replace with `crypto.getRandomValues()` (available in Deno), same pattern used in `comprovante-shortlink/index.ts:31`.

---

## HIGH

### R-03 — `comprovante-resolve` Has No Rate Limiting
- **Evidence:** `comprovante-resolve/index.ts` — no IP throttle, no token bucket, no Supabase rate limit header enforcement.
- **Impact:** An attacker can brute-force the 6-char code space (32^6 ≈ 1 billion, but effective entropy is lower due to 32-char alphabet). With parallel requests, an active code could be guessed before expiry.
- **Fix:** Add rate limiting in the edge function or Supabase API gateway; return 429 after N requests/IP/minute.

### R-04 — `leads-manager` Has No Rate Limiting
- **Evidence:** `leads-manager/index.ts:24-30` — completely open endpoint.
- **Impact:** SPAM / abuse of SaaS registration; repeated WhatsApp message sends at cost; `inscricoes` table pollution.
- **Fix:** IP-based rate limit; CAPTCHA on the frontend form; idempotency check by `whatsapp` number.

### R-05 — `hostHint` Client-Supplied in `comprovante-shortlink`
- **Evidence:** `comprovante-shortlink/index.ts:133` — `const origin = body.hostHint?.replace(/\/+$/, "") ?? ""`.
- **Impact:** A malicious authenticated user can supply any `hostHint`, causing shortlinks that point patients to an attacker-controlled domain while appearing valid in the database (`/p/XXXXXX` resolves through the real edge function but the `shortUrl` returned to the UI — and potentially stored — points elsewhere).
- **Fix:** Ignore `hostHint`; derive the origin exclusively from `tenant.dominio_custom` or `tenant.slug`.

### R-06 — LGPD: CPF Stored in `solicitacoes_publicas` Without Encryption
- **Evidence:** `vitrineStore.ts:108` — `cpf: input.cpf ? input.cpf.replace(/\D/g, "").slice(0, 11) : null` inserted directly.
- **Impact:** CPF is a sensitive personal identifier under LGPD Art. 5-II. Cleartext storage in a table accessible by anonymous INSERT and multi-tenant staff increases breach exposure.
- **Fix:** Encrypt at rest (application-level or column-level); or store only a one-way hash when the full CPF is not strictly required for lookup.

### R-07 — `comprovante-resolve` Returns Raw `url_assinada` via Unauthenticated Endpoint
- **Evidence:** `comprovante-resolve/index.ts:62-70` — no auth, returns signed storage URL to any caller who guesses a valid 6-char code.
- **Impact:** Patient PDF is accessible to anyone with the code, with no audit trail linking access to a specific person. For clinical PDFs, this is a potential LGPD data-exposure event.
- **Mitigation available:** TTL expiry (410) partially mitigates; but combined with R-03 (no rate limit), the window is exploitable.

---

## MEDIUM

### R-08 — Verification Code Algorithm (FNV-1a) Is Publicly Documented
- **Evidence:** `comprovantes.ts:160-168`; `VerificarComprovante.tsx:239` — algorithm name printed in the UI ("FNV-1a").
- **Impact:** An attacker who knows the algorithm (publicly disclosed) and can observe or guess `protocolo`, `nome`, `data`, can forge a valid verification code for a fabricated document. FNV-1a provides no keyed MAC security.
- **Fix:** Replace with HMAC-SHA256 keyed with a server-side secret, computed at issuance and stored; verify by lookup or re-computation with secret.

### R-09 — `integration-pdf-resolve` CORS Wildcard `Access-Control-Allow-Origin: *`
- **Evidence:** `integration-pdf-resolve/index.ts:16`.
- **Impact:** Any origin can call this authenticated endpoint. While JWT still required, wildcard CORS allows credential leakage via CSRF in older browser scenarios.
- **Fix:** Restrict to known origins or remove CORS header (edge function called server-to-server).

### R-10 — Multi-tenant: `solicitacoes_publicas` Realtime Filters Client-Side
- **Evidence:** `SolicitacoesSite.tsx:113` — `filter: \`tenant_id=eq.${tenantId}\`` passed to Postgres CDC.
- **Impact:** Supabase Realtime row-level filtering requires RLS to be enforced server-side on the replication slot. If the channel's `private: true` was removed due to the CHANNEL_ERROR issue (`useSolicitacoesNaoLidas.ts:40-43` comment), RLS enforcement on the Realtime subscription may be relaxed, potentially leaking INSERT events from other tenants if a bug causes `tenantId` to be empty.
- **Note:** The UUID guard (`UUID_RE.test`) in `useSolicitacoesNaoLidas.ts:19` partially mitigates by aborting the subscription for non-UUID tenants.

### R-11 — `leads-manager` Logs Verification Code in Plaintext
- **Evidence:** `leads-manager/index.ts:69` — `log.info(\`Enviando código ${code} para ${whatsapp}\`)`.
- **Impact:** OTP code appears in edge function logs, accessible to any Supabase project admin.
- **Fix:** Remove code from log; log only `lead_id`.

---

## LOW

### R-12 — Sitemap Enumerates All Tenant Slugs
- **Evidence:** `sitemap/index.ts:41-63` — iterates all tenants with non-null slugs.
- **Impact:** Competitive intelligence disclosure; enables targeted scraping of all tenant landing pages.
- **Fix:** Add `robots.txt` exclusion for competitor use-cases; consider opt-in per tenant.

### R-13 — `comprovante-resolve` Counter Increment Is Fire-and-Forget
- **Evidence:** `comprovante-resolve/index.ts:52` — `void admin.from(...).update(...)`.
- **Impact:** Access audit trail is unreliable; counter can be lost under load.
- **Fix:** Await the update or use a queue.

