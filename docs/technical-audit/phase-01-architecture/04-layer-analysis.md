# 04 — Layer Analysis

Descrição técnica de cada camada, com evidências no repositório.

## Frontend
- **Stack**: React 18.3.1, React Router 6.30, TanStack Query 5.83, Tailwind 3.4, shadcn/Radix, framer-motion 12, `class-variance-authority`, `clsx`, `tailwind-merge`.
- **Bundler**: Vite 5.4 + `@vitejs/plugin-react-swc`. Alias `@` → `src/`; `dedupe: ["react","react-dom"]` (memory: correção de hooks).
- **Boot**: `src/main.tsx` importa fontes `@fontsource/*` (Inter global + Sora/Manrope/Space Grotesk/DM Sans em superfícies específicas), instala favicon, faz cleanup de service workers legados (`SW_CLEANUP_RELOAD_FLAG`).
- **Composição em `App.tsx`**: `HelmetProvider → QueryClientProvider → TooltipProvider → AuthProvider → MenuLayoutProvider → BrowserRouter`. Boot pós-autenticação para stores (comentário explícito no arquivo).
- **Code splitting**: todas as pages via `React.lazy`. `ChunkErrorBoundary`, `PageErrorBoundary` presentes.

## Estado de UI e domínio
- **Contextos** (`src/contexts/`): `AuthContext` (sessão + roles), `MenuLayoutContext` (colapso sidebar, prefs), `SuperAdminPrefsContext`.
- **Stores** (`src/data/*Store.ts` — 39 unidades) — padrão in-memory + hidratação assíncrona a partir do Supabase, com utilitários `storeBoot.ts`, `lazyStores.ts`, `useEnsureStore`. Serve como fonte da verdade compartilhada por várias telas.
- **Data-fetching**: `TanStack Query` com `queryClient` em `src/lib/queryClient.ts` (implementa `installQueryClientTenantReset` — memory: `queryKey ["tenant", tenantId, ...]`).

## Runtime
- **Arquivo único**: `src/runtime/db.ts`. Provê `getUserTenantClient` (memory: Identity Layer). Direciona chamadas para banco compartilhado ou banco dedicado por tenant, conforme `tenant_registry.runtime_mode` (`shared` vs `isolated_db`).
- **Contraparte server-side**: `supabase/functions/_shared/tenantGuard.ts`, `_shared/registry.ts`, `_shared/runtime/*`, `_shared/neonProvider.ts`, `_shared/canonical/*`, `_shared/drivers/*`, `_shared/migration/*`.

## Backend gerenciado (Lovable Cloud / Supabase)
- **Auth**: Supabase Auth real (memory: sem mock). `AuthContext` hidrata `profiles` + `user_roles`.
- **PostgreSQL**: 355 migrations em `supabase/migrations/`. RLS obrigatória por convenção do projeto (memory: `current_tenant_id()`, `is_super_admin()`, `has_permission()`).
- **Edge Functions**: 74 functions em `supabase/functions/`, 16.298 LOC totais.
  - `_shared/` centraliza `aiAuth`, `edgeBoot`, `hardening`, `rateLimit`, `crypto`, `s3`, `integrationLog`, `cronHealth`, `protocols`, `resolveExamIntegration`.
- **Realtime**: consumido via `src/hooks/useRealtimeChannel.ts` (memory: `subscribeAtendimentos`).
- **Storage**: buckets para assinaturas, laudos de apoio, comprovantes, requisições — acessados por functions `assinatura-url`, `image-url`, `lab-apoio-upload-pdf`, `integration-pdf-*`, `sign-resultado`.

## Integrações
- **Providers de labs de apoio**: `src/integrations/providers/dbsync/*` (dto, mocks, parsers, transports, ui, xml), `src/integrations/providers/hermes-pardini/*` (capabilities, labels, parser, status, transport, ui, wsdl), `providers/registry.ts`.
- **Contracts**: `src/integrations/contracts/capabilities.ts`, `providers.ts`, `providerUI.ts`, `transport.ts` — normalizam capacidades comuns.
- **Adapters server-side**: `supabase/functions/lab-apoio-adapter`, `lab-apoio-cron-fetch`, `lab-apoio-upload-pdf`, `integration-*`, `provider-catalog-import`, `provider-health-aggregator`, `super-admin-test-integration`.
- **PIX**: `src/lib/pixBrCode.ts` (geração BRCode); recebimento via webhook consumido em `PagamentoDialog`.
- **IA**: Edge functions `ai-chat`, `ai-speak`, `ai-suggest-exames`, `ai-transcribe`, `extract-requisicao-exames` — usam Lovable AI Gateway (memory: Gemini-2.0-flash).
- **QR / etiquetas / impressão**: `qrcode`, `html2canvas`, `html2pdf.js`, `jspdf` no client.

## Auth
- **Frontend**: `src/contexts/AuthContext.tsx` + Supabase JS session listener; `ProtectedRoute` com props `permissao` e `bloqueadoPontoColeta`; `RequireSuperAdmin` para console.
- **Backend**: `user_roles` (app_role enum) + funções SECURITY DEFINER `has_role`/`is_super_admin`/`current_tenant_id` (padrão de projeto documentado nas memories).
- **Impersonação de tenant** via `super-admin-impersonate-tenant` + `components/ImpersonationBanner.tsx`.

## SuperAdmin
- Bundle sob `/super-admin/*`, layout próprio (`SuperAdminLayout`), guard `RequireSuperAdmin`, contextos e prefs próprios.
- Executa operações CORE (criar/excluir/impersonar tenants, provisionamento de schema, migração runtime, planos, billing) via 24 edge functions dedicadas com service-role.

## IA
- Superfície client: `components/assistente/AssistenteSISLAC.tsx`.
- Superfície server: 5 edge functions (`ai-*`, `extract-requisicao-exames`) + helper `_shared/aiAuth.ts`.

## Impressão
- Motor híbrido no client: composição de HTML (`printHtml`, `printShell`, `laudoTemplate`, `mapaTemplates`) + conversão via Paged.js (memory), `html2pdf.js`, `jspdf`, `html2canvas`.
- Lote paralelo: `laudoBatchPdf.ts` (memory: Document Engine 3.0).
- Etiquetas: `etiquetaAmostra.ts`, `imprimirEtiquetaPorAtendimentoExame.ts`.
