# Portal Paciente — Single Source of Truth Audit

**Scope:** Tokens, protocols, verification codes, status enums, feature flags, URL assembly.  
**Date:** 2025-07

---

## 1. Verification Code (FNV-1a Hash)

| Item | SSOT Location | Status |
|---|---|---|
| Hash implementation | `src/lib/comprovantes.ts:160-168` (`codigoVerificacao`) | ✅ Single implementation |
| Re-computation for verification page | `src/lib/comprovantes.ts:175-185` (`codigoVerificacaoDeComprovante`) | ✅ Wraps the same `codigoVerificacao` |
| Input format `tipo\|protocolo\|nome\|data\|total` | Defined inline at `comprovantes.ts:183` and again at `comprovantes.ts:438` | ⚠️ **Duplicated string template** — both must be kept in sync manually |
| Algorithm disclosed to users | `VerificarComprovante.tsx:239` | ⚠️ Leaks algorithm; breaks security-by-obscurity; not a SSOT issue but a risk |

**Recommendation:** Extract the input-format template into a named constant exported from `comprovantes.ts` so both callers reference the same literal.

---

## 2. Shortlink Code Generation

| Item | SSOT Location | Status |
|---|---|---|
| Alphabet for codes | `comprovante-shortlink/index.ts:28` | ✅ Single location |
| Code length (6) | `comprovante-shortlink/index.ts:30`, and implicitly the regex `^[A-Z0-9]{4,12}$` in `comprovante-resolve/index.ts:25` | ⚠️ Length not shared as a constant between the two functions |
| Expiry enforcement | App-level in `comprovante-resolve/index.ts:47` | ✅ Single place; DB has `expira_em` column as persistent record |

---

## 3. Atendimento Status Mapping

Three parallel mappings exist for the same status concept:

| Location | Mapping |
|---|---|
| `ConsultarResultados.tsx:65-70` (`mapStatus`) | label string → `"Finalizado" \| "Pendente" \| "Cancelado"` |
| `ConsultarResultados.tsx:106-111` (`statusFromRPC`) | canonical DB string → same UI enum |
| `ConsultarResultados.tsx:135-141` (`tabStatusCanonical`) | UI enum → canonical DB string for RPC |

These three functions form a round-trip but are **not co-located** and can drift. If the DB canonical value changes, all three must be updated.

**Recommendation:** Create a shared `statusMappers.ts` with a single bidirectional map.

---

## 4. Solicitation Status Enum

| Item | SSOT Location | Status |
|---|---|---|
| `SolicitacaoStatus` type | `src/lib/tenantSite/vitrineStore.ts:225` | ✅ Single type definition |
| `STATUS_META` display config | `src/pages/SolicitacoesSite.tsx:33-38` | ✅ Derived from the type |
| `FILTROS` array | `src/pages/SolicitacoesSite.tsx:57-63` | ✅ References same keys |

---

## 5. Protocol Number

Protocol (`protocolo`) is used as the primary patient-facing reference across:
- `comprovante_links.atendimento_protocolo` — stored on shortlink creation
- `comprovantes.ts:438` — included in hash input
- `VerificarComprovante.tsx:172-179` — user input field
- `ConsultarResultados.tsx:182` — search filter key

No shared type or format validator for protocol strings. Format appears to be `"YYYY-NNNN"` (e.g., `"2026-0001"` from placeholder in `VerificarComprovante.tsx:175`) but this is not enforced by a shared constant or regex.

**Recommendation:** Define `PROTOCOLO_REGEX` in a shared lib and use it across all input validators and hash inputs.

---

## 6. Feature Flags (ConsultarResultados Branch)

| Flag | Definition location | Usage |
|---|---|---|
| `paginated_atendimentos` | `src/lib/featureFlags.ts` (not scoped) | `ConsultarResultados.tsx:130` |
| `USE_LEGACY_STORE` | `src/lib/featureFlags.ts` | `ConsultarResultados.tsx:131-132` |

Both flags checked with two different APIs (`useFeatureFlag` hook + `isFeatureEnabled` function) for the same flag in the same component (`ConsultarResultados.tsx:131-132`). This is inconsistent and error-prone.

---

## 7. Tenant Public URL Assembly

Four independent URL-building paths exist:

| Location | Method |
|---|---|
| `src/lib/tenantSite/seoHelpers.ts` (`tenantSiteUrl`) | Frontend canonical URLs |
| `comprovante-shortlink/index.ts:131-143` | Shortlink `shortUrl` assembly (4-branch) |
| `sitemap/index.ts:58` | Sitemap URL: `${origin}/site/${slug}${sub}` |
| `comprovantes.ts:403` | QR code / vCard URL: `${origin}/verificar/${codigo}` |

No shared utility; the `/site/:slug` path segment is hardcoded in three separate places.

**Recommendation:** Define URL patterns in a shared config constant.

---

## 8. TTL Values

| TTL | Location | Value |
|---|---|---|
| Shortlink default | `comprovante-shortlink/index.ts:87` | 24h |
| Shortlink max | `comprovante-shortlink/index.ts:87` | 168h |
| Upload-pdf signed URL | `upload-pdf/index.ts:165` | 1h (**mismatch with shortlink**) |
| integration-pdf signed URL | `integration-pdf-resolve/index.ts:21` | 5 min |
| assinatura-url signed URL | `assinatura-url/index.ts:73` | 1h |
| image-url signed URL | `image-url/index.ts:71` | 1h |
| Leads OTP | `leads-manager/index.ts:47` | 10 min |

No shared constants file for TTLs. The critical mismatch (upload 1h vs. shortlink 24h) is invisible without cross-referencing two separate files.

