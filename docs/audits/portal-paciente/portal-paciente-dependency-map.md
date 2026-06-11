# Portal Paciente — Dependency Map

**Scope:** Patient-facing public portal, receipt verification, shortlink PDF redirect, lead capture, and internal inbox.  
**Auditor:** Senior Architect / Security / QA / LGPD  
**Date:** 2025-07

---

## 1. Route → Page → Lib → Edge Function → Table

```
PUBLIC ROUTES (no auth required)
──────────────────────────────────────────────────────────────────────────────
/site/:slug             → TenantSite.tsx
                            → lib/tenantSite/store.ts → supabase.rpc(get_published_tenant_page) → tenant_pages
                            → lib/tenantSite/vitrineStore.ts
                                → supabase.from(tenant_settings_public)
                                → supabase.from(exames_publicos_view)        ← view over exames_publicos
                                → supabase.from(unidades_publicas)
                                → supabase.rpc(lookup_paciente_publico)       ← CPF lookup
                            → lib/tenantSite/seoHelpers.ts                    ← canonical URL helpers
                            → lib/tenantSite/themePresets.ts

/site/:slug/sobre       → TenantSiteSobre.tsx
                            → lib/tenantSite/store.ts (getTenantBySlug)      → tenant_public (view)
                            → lib/tenantSite/vitrineStore.ts (getVitrineSettings) → tenant_settings_public

/site/:slug/contato     → TenantSiteContato.tsx
                            → (same as /sobre)

/p/:codigo              → RedirectShortlink.tsx
                            → fetch() directly → Edge: comprovante-resolve
                                → comprovante_links (admin client, service role)
                                → returns url_assinada (pre-signed or raw URL stored at creation)

/verificar/:codigo      → VerificarComprovante.tsx
                            → lib/comprovantes.ts (codigoVerificacaoDeComprovante)  ← pure FNV-1a, NO DB call
                            → data/labConfigStore.ts (getLabConfig)               ← local config

AUTHENTICATED INTERNAL ROUTES
──────────────────────────────────────────────────────────────────────────────
/consultar-resultados   → ConsultarResultados.tsx
                            → data/atendimentoStore (legacy in-memory cache)  [flag USE_LEGACY_STORE=ON]
                            → hooks/useResultadosPage.ts → supabase.rpc(?)    [flag paginated_atendimentos=ON]

/solicitacoes-site      → SolicitacoesSite.tsx
                            → lib/tenantSite/vitrineStore.ts
                                → listSolicitacoesFull()     → solicitacoes_publicas
                                → updateSolicitacaoStatus()  → solicitacoes_publicas
                                → markSolicitacaoLida()      → solicitacoes_publicas
                                → updateSolicitacaoContato() → solicitacoes_publicas
                                → marcarConvertido()         → solicitacoes_publicas
                            → hooks/useSolicitacoesNaoLidas.ts
                                → countSolicitacoesNaoLidas() → solicitacoes_publicas
                                → Realtime subscription: solicitacoes_publicas (tenant_id=eq.)
```

---

## 2. Edge Functions

| Function | Auth | Tables Touched | Storage |
|---|---|---|---|
| `comprovante-resolve` | None (public GET) | `comprovante_links` (R+W acessos) | — |
| `comprovante-shortlink` | JWT Bearer | `profiles`, `tenants`, `comprovante_links` | — |
| `upload-pdf` | JWT Bearer | `profiles`, `tenants` | `comprovantes` bucket (S3 or Supabase) |
| `upload-image` | JWT Bearer | `profiles`, `tenants`, `tenant_lab_config` | S3 only |
| `image-url` | JWT Bearer | `profiles`, `tenants` | S3 (presign) |
| `assinatura-url` | JWT Bearer | `profiles` | S3 (presign) |
| `integration-pdf-resolve` | JWT Bearer | `atendimento_exames`, `integration_pdfs`, `integration_results` | `integration-pdfs`, `integration-assets` |
| `integration-pdf-url` | JWT Bearer | `integration_pdfs` | `integration-assets` (S3 or Supabase) |
| `leads-manager` | None (public) | `inscricoes`, `app_settings` | — |
| `sitemap` | None (public) | `tenant_public` (view) | — |

---

## 3. Tables & Views (Patient Portal context)

| Table / View | Public? | Notes |
|---|---|---|
| `tenant_public` | Yes (RLS/view) | Read-only lookup by slug or dominio_custom |
| `tenant_settings_public` | Yes (anon) | Vitrine config, flags, SEO fields |
| `tenant_pages` | RLS-admin; RPC for public | Content blocks for home/sobre/contato |
| `exames_publicos` | Admin only | Source; view `exames_publicos_view` for public |
| `solicitacoes_publicas` | Insert: anon; Select/Update: tenant auth | Lead inbox; CPF, phone stored in cleartext |
| `comprovante_links` | Service-role only (via edge fns) | Shortlink registry, stores raw `url_assinada` |
| `identidade_confirmacoes` | Not directly referenced in scoped files | Identity confirmation flow (partially out-of-scope) |
| `resultados_entregas` | Not referenced in scoped files | — |
| `orientacoes_entregues` | Not referenced in scoped files | — |
| `inscricoes` | Service-role via leads-manager | SaaS signup leads; verification codes stored in column |

---

## 4. Cross-cutting Concerns

| Concern | Files |
|---|---|
| Auth context | `src/contexts/AuthContext.tsx` → `useAuth()` used in SolicitacoesSite, useSolicitacoesNaoLidas |
| Feature flags | `src/lib/featureFlags.ts` → controls legacy vs. server-side path in ConsultarResultados |
| Realtime | Supabase channels in SolicitacoesSite.tsx:109, useSolicitacoesNaoLidas.ts:43 |
| Shared hardening utils | `supabase/functions/_shared/hardening.ts` — used by all edge functions except integration-pdf-* |
| S3 helpers | `supabase/functions/_shared/s3.ts` — presign, put, audit trail |
| FNV-1a hash | `src/lib/comprovantes.ts:160` — sole location; also re-used in VerificarComprovante.tsx via import |

