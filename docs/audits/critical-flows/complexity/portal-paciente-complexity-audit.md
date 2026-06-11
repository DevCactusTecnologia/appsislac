# Portal Paciente — Complexity Audit

**Date:** 2025-07

---

## 1. High-Complexity Hotspots

| File | Lines | Key Complexity Driver |
|---|---|---|
| `src/lib/comprovantes.ts` | 1121 | PDF HTML generation, FNV-1a hash, QR SVG, vCard, legal text, template fallback, valor-por-extenso — all in one file |
| `src/pages/ConsultarResultados.tsx` | 611 | Dual data-source branching (legacy store vs. server RPC), dual pagination logic, tab/status mapping discrepancies |
| `src/pages/SolicitacoesSite.tsx` | 541 | Real-time subscription with manual exponential back-off, inline CRM state machine, optimistic updates |
| `supabase/functions/upload-pdf/index.ts` | 238 | S3+Supabase dual-backend, magic-byte validation, retry loop, audit trail |
| `supabase/functions/integration-pdf-resolve/index.ts` | 135 | 3-source resolution waterfall, cross-join of integration_pdfs → integration_results |

---

## 2. Dual-Mode Data Path (ConsultarResultados)

```
flagPaginated && !flagLegacy && !isFeatureEnabled("USE_LEGACY_STORE")
     └─ true  → useResultadosPage (server RPC, real pagination)
     └─ false → atendimentoStore (global in-memory, client filter)
```
- Three boolean conditions (`ConsultarResultados.tsx:130-132`) create 8 possible states; only 2 are intended.
- KPI counts (`finalizadosCount` etc.) are inaccurate in server mode: they count only the current page subset (`ConsultarResultados.tsx:195-197`, comment acknowledges this).
- Tab filter for "Pendente" falls back to client-side even in server mode, mixing paradigms (`ConsultarResultados.tsx:179-181`).

---

## 3. Comprovantes.ts God-File

`src/lib/comprovantes.ts` contains:
1. FNV-1a hash function (SSOT ✓)
2. `valorPorExtenso` (number-to-words, 50+ lines)
3. CNPJ validation
4. QR SVG generator
5. vCard 3.0 builder
6. Legal declaration text per document type
7. Template dispatcher (`renderDocumentoTemplate`)
8. `html2pdf.js` dynamic import + caching
9. WhatsApp upload integration
10. `validarLaboratorioParaComprovante` legal gate

Coupling: any change to document layout, legal text, or hash logic requires touching this single 1121-line file.

---

## 4. Realtime Channel Lifecycle

Both `SolicitacoesSite.tsx:99-135` and `useSolicitacoesNaoLidas.ts:30-88` implement **identical** manual reconnect loops with exponential back-off. This duplicated pattern (≈50 lines each) increases maintenance surface. No shared abstraction exists.

---

## 5. comprovante-shortlink URL Assembly

`comprovante-shortlink/index.ts:131-143` — four-branch host resolution:
1. `tenant.dominio_custom`
2. `body.hostHint` (client-supplied — not validated against tenant)
3. `tenant.slug`
4. Hardcoded fallback `sislac.lovable.app`

Branch 2 trusts the client for the base URL, which can produce shortlinks pointing to unrelated hosts.

---

## 6. Integration PDF Resolution N+1 Risk

`integration-pdf-resolve/index.ts:82-105`:
1. Query `integration_pdfs` (top 20)
2. Query `integration_results` by `atendimento_exame_id`
3. Query `integration_pdfs` again (top 50) for linked records

Three sequential DB round-trips per request; no JOIN. Deduplication is done in JS. Under load this will be a latency bottleneck.

---

## 7. Summary Table

| Area | Complexity Score (1–5) | Primary Concern |
|---|---|---|
| comprovantes.ts | 5 | God-file, 10 responsibilities |
| ConsultarResultados dual-mode | 4 | 3-flag branching, KPI inaccuracy |
| SolicitacoesSite realtime | 3 | Duplicated reconnect pattern |
| comprovante-shortlink host resolution | 3 | Client-trusted hostHint |
| integration-pdf-resolve N+1 | 3 | 3 sequential queries |
| RedirectShortlink | 1 | Simple; well-contained |
| VerificarComprovante | 1 | Stateless hash check |

