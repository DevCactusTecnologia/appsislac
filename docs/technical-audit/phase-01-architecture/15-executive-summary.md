# 15 — Executive Summary

## Como o SISLAC realmente foi construído

- **SPA** em React 18 + Vite 5 + TypeScript 5, com roteamento `react-router-dom@6` centralizado em `src/App.tsx` (~120 rotas, code-splitting por página).
- **Multi-tenant real**: isolamento por `tenant_id` + RLS no PostgreSQL, com camada de runtime (`src/runtime/db.ts` + `supabase/functions/_shared/{registry,tenantGuard,runtime,neonProvider,drivers,migration,canonical}`) capaz de rotear cada tenant entre banco compartilhado e banco dedicado (Neon).
- **Backend gerenciado** (Lovable Cloud/Supabase): **74 edge functions Deno**, **355 migrations SQL**, Storage, Realtime, Auth. Operações privilegiadas isoladas em **24 functions `super-admin-*`** com service-role e revalidação.
- **Estado de domínio** distribuído em **39 stores** (`src/data/*Store.ts`), padrão facade in-memory + hidratação Supabase + eventos Realtime + invalidações do TanStack Query. `atendimentoStore` é o hub operacional.
- **Serviços transversais** em `src/lib` (impressão via Paged.js/html2pdf/jspdf, motor de laudo com tokens, pipeline de PDFs em lote, PIX BRCode, sanitização, máscaras, feature flags).
- **Integrações**: 2 providers de laboratório de apoio (`dbsync`, `hermes-pardini`) atrás de `contracts/*`; Lovable AI Gateway (Gemini) para chat/OCR/TTS/transcrição; PIX; WhatsApp por deep-link; S3-compat opcional.
- **Console Super Admin** vive no mesmo bundle mas em rotas isoladas por `RequireSuperAdmin`, com layout, prefs e edge functions próprias, incluindo pipeline de **migração runtime** (shared → dedicated) auditado em `tenant_migration_runs`.
- **UI**: shadcn/Radix + Tailwind v3 + tokens HSL semânticos + framer-motion; convenções fortes documentadas nas memories (Diálogos flat, animações layoutId, ausência de PWA, layout de impressão travado, etc.).

## Fatos comprovados relevantes

- Bundler é **Vite** (`scripts.build = "vite build"`); `next.config.js` existe na raiz mas **não** é executado pelo build.
- Coexistem **`bun.lock`** e **`package-lock.json`**.
- **Sem PWA** (memory `technical/pwa-removido`), com `main.tsx` fazendo cleanup ativo de service workers legados.
- Auth 100% Supabase Auth real; **não há mais** fallback mock/demo.
- Financeiro "Entradas" é **read-only** por convenção; edição é feita no atendimento.
- Padrões arquiteturais efetivamente aplicados: Provider, Custom Hooks, Facade (stores), Adapter (providers), Registry, Strategy (pricing), Service Layer, Observer (Realtime + query invalidation), Singleton (client/queryClient/stores), Lazy loading + Error Boundaries, Guards de rota, Template Method (laudo tokens), Pipeline (batch PDF), Feature Flag.
- Cerca de **469 arquivos** TS/TSX em `src/` (124.915 LOC) e **16.298 LOC** em edge functions.

## Veredito

**A arquitetura atual é: Complexa.**

Justificativa baseada exclusivamente em evidências:
1. **Superfície ampla**: 20 módulos funcionais, 74 edges, 355 migrations, 39 stores, ~120 rotas.
2. **Runtime híbrido** (shared + dedicated per-tenant) com espelho front/back e pipeline próprio de migração — capacidade avançada com custo cognitivo real.
3. **Concentrações claras** (`atendimentoStore`, `AppSidebar`, `src/lib` misturando utilitários e serviços pesados de impressão/laudo, `src/App.tsx` com todas as rotas).
4. **Boa modularidade e separação em camadas** (Frontend / Runtime / Backend / Integrações / SuperAdmin), com convenções fortes documentadas (RLS, queryKey por tenant, dialogs flat, layout de impressão travado).
5. **Dependências externas múltiplas** (Supabase, Lovable AI, PIX, Neon, dois providers de apoio, S3, WhatsApp) todas com pontos de entrada bem localizados.

Não é "Muito Complexa" — o grafo é unidirecional, sem ciclos entre camadas, com boundaries reconhecíveis; nem "Regular" — as capacidades (multi-tenant real, migração runtime, motor de laudo, batch PDF, super admin, integrações IA e labs) são substanciais e interligadas.
