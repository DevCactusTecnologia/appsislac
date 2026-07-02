# 10 — Special Files

Arquivos com papel infra estrutural ou singular no projeto.

## Entrypoints

| Arquivo | Papel |
| ------- | ----- |
| `index.html` | HTML raiz do Vite |
| `src/main.tsx` | Entry React |
| `src/App.tsx` | Root component (routes + providers) |

## Bootstrap

| Arquivo | Papel |
| ------- | ----- |
| `src/main.tsx` | Instala fontes, favicon, listeners globais, chunk-reload, limpa SW legado |
| `src/data/storeBoot.ts` | Coordena hidratação dos stores após auth |
| `src/data/lazyStores.ts` | Carregamento sob demanda de stores |
| `src/integrations/providers/registry.ts` | Boot do registro de UIs de providers |
| `supabase/functions/_shared/edgeBoot.ts` | Setup de logging/env para functions |

## Configuração

| Arquivo | Papel |
| ------- | ----- |
| `vite.config.ts` | Build/dev server (com `resolve.dedupe` para React) |
| `tailwind.config.ts` | Tokens Tailwind |
| `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` | TypeScript |
| `eslint.config.js` | Lint |
| `postcss.config.js` | Postcss/Tailwind |
| `playwright.config.ts` + `playwright-fixture.ts` | E2E |
| `vitest.config.ts` + `src/test/setup.ts` | Testes unitários |
| `vercel.json` | Deploy Vercel |
| `next.config.js` | Presente na raiz (sem evidência de uso ativo — stack é Vite) |
| `components.json` | shadcn config |
| `supabase/config.toml` | Supabase local/CLI |
| `src/index.css` | Design tokens Tailwind + globals |
| `.env` | Vars públicas Supabase (auto-gerenciado) |
| `.github/workflows/ci.yml` | Pipeline CI |

## Singletons

| Arquivo | Papel |
| ------- | ----- |
| `src/integrations/supabase/client.ts` | Cliente Supabase (auto) |
| `src/runtime/db.ts` | Facade + cache de tenant |
| `src/lib/queryClient.ts` | React Query client global |
| `supabase/functions/_shared/runtime/createClient.ts` | Único ponto autorizado de `createClient` no server |
| `src/lib/logger.ts` | Logger estruturado global |
| `src/lib/ttlCache.ts` | Cache TTL usado por stores |
| `src/lib/favicon.ts` | Instalação de favicon versionado |

## Providers React (nesta base)

| Arquivo | Papel |
| ------- | ----- |
| `contexts/AuthContext.tsx` | Sessão + perfil + role |
| `contexts/MenuLayoutContext.tsx` | Estado da sidebar |
| `contexts/SuperAdminPrefsContext.tsx` | Preferências super admin |
| `pages/Financeiro/FinanceiroContext.tsx` | Contexto local do módulo financeiro |
| `App.tsx` | QueryClientProvider + ThemeProvider + Router + Auth |

## Stores (top-level orquestradores)

- `src/data/storeBoot.ts` — hidrata stores após login.
- `src/data/atendimentoStore/index.ts` — facade do hub central.
- `src/data/selectOptionsStore.ts` — dicionários globais.
- `src/data/geoStore.ts` — cidades/UFs.
- `src/data/reguasEtariasStore.ts` — réguas etárias.

## Routers

- `src/App.tsx` — declara todas as rotas (frontend público + tenant + super admin).

## Layouts globais

- `src/components/AppLayout.tsx` — layout tenant.
- `src/components/AppSidebar.tsx`, `AppTopbar.tsx`.
- `src/components/SuperAdminLayout.tsx` — layout super admin.

## Hooks globais

- `useAuth` (dentro de `AuthContext.tsx`) — sessão.
- `useEnsureStore` — bootstrap por página.
- `useRealtimeChannel` — canal Supabase Realtime.
- `use-toast`, `use-mobile`, `use-body-scroll-lock`, `use-debounced-value`, `use-scroll-fade` — utilitários pervasivos.

## Runtime

- `src/runtime/db.ts` (frontend).
- `supabase/functions/_shared/runtime/db.ts` (server).
- `supabase/functions/_shared/runtime/createClient.ts` (server).
- `supabase/functions/_shared/drivers/{registry.ts,pipeline.ts,circuit.ts,dlq.ts,credentials.ts}` (engine de integrações).

## Guards / boundary

- `src/components/RequireSuperAdmin.tsx`.
- `src/components/RotinaColetaAnaliseGuard.tsx`.
- `src/components/PermissionDenied.tsx`.
- `src/components/ChunkErrorBoundary.tsx`, `PageErrorBoundary.tsx`.
