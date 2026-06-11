# Portal Paciente — Business Rules

**Scope:** Result access, history, PDF downloads, sharing, authentication, tokens, protocols, security.  
**Evidence:** file:line citations throughout.

---

## 1. Result Access (`/consultar-resultados`)

### 1.1 Auth Gate
- Page is inside the authenticated shell; `useAuth()` must return a valid `user` (`src/pages/ConsultarResultados.tsx:113`).
- No explicit role check inside the page — any authenticated user of the tenant can view all patient results listed in the store.

### 1.2 Data Source
- **Legacy path** (`USE_LEGACY_STORE=ON` or `paginated_atendimentos=OFF`): reads from `atendimentoStore` (in-memory global cache populated elsewhere). No DB isolation per page load.
- **Server path** (`paginated_atendimentos=ON` and `!USE_LEGACY_STORE`): calls `useResultadosPage` hook with optional `status` / `q` params that map to a DB RPC.
- Flag branching: `ConsultarResultados.tsx:130-132`.

### 1.3 Status Mapping
| UI Label | Canonical DB value | Notes |
|---|---|---|
| Finalizado | "Resultado Liberado" | `ConsultarResultados.tsx:138` |
| Cancelado | "Pedido Cancelado" | `ConsultarResultados.tsx:139` |
| Pendente | (multiple — no server filter) | client-side only `ConsultarResultados.tsx:139` |

### 1.4 Read-only Enforcement
- UI intention is read-only (no edit/save/release buttons). Enforced purely by UI absence; no backend RLS role dedicated to "consulta" vs "operação".

---

## 2. Document Verification (`/verificar/:codigo`)

### 2.1 Algorithm
- Verification is **entirely client-side** with no DB lookup (`VerificarComprovante.tsx:38-45`).
- Hash: FNV-1a 32-bit over the concatenation `tipo|protocolo|paciente.nome|data|totais.total` → 8 hex chars split as `XXXX-XXXX` (`comprovantes.ts:160-168`).
- Input to the page: URL param `:codigo` pre-filled from QR code printed on document.

### 2.2 Verification Inputs Required by Type
| Document Type | Fields verified |
|---|---|
| pagamento | tipo + protocolo + nome + data + total |
| atendimento | tipo + protocolo + nome + data |
| comparecimento | tipo + protocolo + nome + data |

### 2.3 QR Code Destination
- QR encodes `{origin}/verificar/{codigo}` (`comprovantes.ts:403`).
- vCard NOTE also embeds `URL:{origin}/verificar/{codigo}` (`comprovantes.ts:276`).

---

## 3. PDF Shortlink & Redirect (`/p/:codigo`)

### 3.1 Creation (`comprovante-shortlink`)
- Requires valid JWT Bearer; tenant resolved server-side via `profiles.tenant_id` (never trusted from body) — `comprovante-shortlink/index.ts:93-101`.
- Code: 6 chars from 32-char alphabet (no ambiguous chars), CSPRNG — `comprovante-shortlink/index.ts:28-35`.
- TTL: 1–168 hours, default 24h — `comprovante-shortlink/index.ts:87`.
- Up to 5 insert retries on code collision — `comprovante-shortlink/index.ts:113`.
- **`url_assinada` stored raw** in `comprovante_links` — this is the pre-signed storage URL, not regenerated on each access (`comprovante-shortlink/index.ts:115`).

### 3.2 Resolution (`comprovante-resolve`)
- **No auth** required — public GET endpoint (`comprovante-resolve/index.ts:3`).
- Code validated against regex `^[A-Z0-9]{4,12}$` — `comprovante-resolve/index.ts:25`.
- Expiry checked in application code: `new Date(link.expira_em).getTime() < Date.now()` — `comprovante-resolve/index.ts:47`.
- Returns stored `url_assinada` directly; 410 if expired; 404 if not found.
- Access counter incremented best-effort (fire-and-forget void) — `comprovante-resolve/index.ts:52-60`.
- **No tenant isolation** on resolve — any code resolves regardless of caller tenant.

---

## 4. PDF Upload & Signed URL Lifecycle

### 4.1 upload-pdf
- Auth: JWT; tenant resolved server-side — `upload-pdf/index.ts:90-105`.
- Validates: filename (alphanumeric + `.` `-` + `.pdf`), size ≤ 6 MB, PDF magic bytes `%PDF` — `upload-pdf/index.ts:126-151`.
- Storage path: `buildObjectKey({tenantId, cnpj, ...})` — cross-tenant isolation via folder prefix.
- Returns a 1-hour signed URL for the uploaded object — `upload-pdf/index.ts:165`.

### 4.2 Signed URL TTL vs. Shortlink TTL Mismatch
- `upload-pdf` returns a signed URL valid for **1 hour** (3600 s).
- `comprovante-shortlink` default TTL is **24 hours**.
- **Critical**: the storage signed URL is stored verbatim as `url_assinada`. After ~1 hour the stored URL expires but the shortlink record remains valid for up to 24h, causing a broken PDF download for the patient.

---

## 5. Lead / Public Solicitation (`/site/:slug` → form → `solicitacoes_publicas`)

### 5.1 Submission Rules
- Anonymous insert into `solicitacoes_publicas` — `vitrineStore.ts:115`.
- Client-side sanitisation: nome trimmed to 120 chars, telefone digits-only up to 15, CPF digits-only up to 11, observacao up to 1000 chars.
- DB trigger (not visible in front-end code) is stated as the authoritative validation point — `vitrineStore.ts:102`.

### 5.2 Lead Lifecycle (CRM-like states)
| Status | Meaning |
|---|---|
| NOVO | Just received, unread |
| EM_CONTATO | Staff marked as contacted |
| CONVERTIDO | Linked to a new `atendimento` |
| DESCARTADO | Rejected |

- Conversion navigates to `/novo-atendimento` with state pre-filled — `SolicitacoesSite.tsx:180-196`.
- `marcarConvertido` sets `convertido_atendimento_id = solicitacao.id` (not the actual atendimento UUID created later) — `vitrineStore.ts:294-304`. **This is a data-integrity gap**: the field records the source solicitation ID, not the destination atendimento ID.

### 6. Integration PDF Access (`integration-pdf-resolve`, `integration-pdf-url`)

- Auth: JWT required on both.
- Tenant isolation via RLS on `atendimento_exames` (userClient query) — `integration-pdf-resolve/index.ts:45-51`.
- Resolution order: manual override → provider PDF → null — `integration-pdf-resolve/index.ts:55-123`.
- Signed URL TTL: 5 minutes (300 s) — `integration-pdf-resolve/index.ts:21`.
- `integration-pdf-url` supports both S3 and Supabase Storage backends with audit trail.

---

## 7. Public Exam Catalog (`exames_publicos_view`)

- Mode flags per exam: `COMPRAR | AGENDAR | INFORMAR` — `vitrineStore.ts:61-62`.
- Tenant-level flags mirror these: `permitir_compra_online`, `permitir_agendamento`, `exigir_aprovacao_manual`, `auto_criar_atendimento` — `vitrineStore.ts:43-46`.
- Source of truth stated as `tenant_settings_public` table, not duplicated — comment in `vitrineStore.ts:33-46`.

---

## 8. Sitemap

- Public; uses anon key; reads `tenant_public` view — `sitemap/index.ts:28-41`.
- Exposes slugs of all tenants with public pages. No pagination — can grow unbounded.
- Cache-Control: `public, max-age=3600` — `sitemap/index.ts:70`.

---

## 9. SaaS Lead Capture (`leads-manager`)

- Public (no JWT) — `leads-manager/index.ts:31`.
- Verification code: `Math.floor(100000 + Math.random() * 900000)` — **uses `Math.random()`, not CSPRNG** — `leads-manager/index.ts:44`.
- Code stored in plain column `codigo_validacao` in `inscricoes` table — `leads-manager/index.ts:59`.
- TTL: 10 minutes — `leads-manager/index.ts:47`.
- On `resend` action: new code replaces old — old is effectively invalidated — `leads-manager/index.ts:148`.
- No rate-limiting logic visible in function code.

