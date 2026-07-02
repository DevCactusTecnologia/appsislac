# 01 — Frontend Overview

**Escopo:** auditoria estática do frontend SISLAC (`src/`). Nenhum arquivo foi alterado.

## Stack (evidências)
- `package.json` / `vite.config.ts` / `tsconfig.app.json`: React 18.3, Vite 5.4 + `@vitejs/plugin-react-swc`, TypeScript 5 estrito (`strict`, `noImplicitAny`, `strictNullChecks`), Tailwind 3.4, shadcn/Radix, framer-motion 12, TanStack Query 5, React Router 6.30.
- Alias `@` → `src/`; `resolve.dedupe: ["react","react-dom"]`.
- Boot: `src/main.tsx` importa fontes `@fontsource/*`, instala favicon, faz cleanup de service workers legados (`SW_CLEANUP_RELOAD_FLAG`).

## Composição do App (`src/App.tsx`, 474 LOC)
```
HelmetProvider
  └── QueryClientProvider (src/lib/queryClient.ts)
      └── TooltipProvider
          └── AuthProvider (contexts/AuthContext)
              └── MenuLayoutProvider
                  └── BrowserRouter
                      └── SuperAdminPrefsProvider (montado dentro do super-admin bundle)
                      └── Routes (80 <Route>)
                          ├── ProtectedRoute (permissão + bloqueio ponto-coleta)
                          ├── RequireSuperAdmin
                          ├── RotinaColetaAnaliseGuard
                          └── Layout (AppLayout | SuperAdminLayout | público)
                              └── Page (React.lazy)
                                  ├── Componentes shadcn/domínio
                                  ├── Hooks (`src/hooks/*`, 20)
                                  ├── Stores (`src/data/*Store*`, 37)
                                  └── Runtime (`src/runtime/db.ts`)
                                      └── Supabase (RPC / Edge / Realtime / Storage)
```

## Camadas identificadas
| Camada | Local | Métrica |
|---|---|---|
| Pages | `src/pages/` | 114 arquivos |
| Components | `src/components/` (+ 20 subpastas) | 160 arquivos |
| Hooks | `src/hooks/` | 20 arquivos |
| Stores | `src/data/*Store*` | 37 arquivos |
| Contexts | `src/contexts/` | 3 (`Auth`, `MenuLayout`, `SuperAdminPrefs`) |
| Runtime | `src/runtime/db.ts` | 157 LOC — chokepoint `getUserTenantClient` |
| Lib utilitária | `src/lib/` | queryClient, print, pix, etc. |
| Domínios | `src/domains/{appointment,result,tenant}/services` | serviços puros |
| Integrações client | `src/integrations/providers/{hermes-pardini,dbsync}` | UI declarativa dos labs de apoio |

## Fluxo canônico
Page → Hook (`useEnsureStore`, `usePaginated*`, etc.) → Store (in-memory + subscribe) → Runtime (`getUserTenantClient`) → Supabase RPC/Edge → RLS/Postgres.

## Padrões arquiteturais observados
- **Chokepoint de dados**: `src/runtime/db.ts` resolve cliente tenant-aware; nenhum componente usa `supabase-js` diretamente para dados operacionais.
- **Store-first**: 37 stores in-memory com `subscribe/get/set` (padrão observado em `atendimentoStore/`, `pacienteStore.ts`, `financeiroStore.ts`), hidratados por `storeBoot.ts` + `lazyStores.ts` + hook `useEnsureStore`.
- **TanStack Query** presente mas **restrito** (apenas 6 arquivos consomem `useQuery`/`useMutation`), usado para invalidação por tenant (`installQueryClientTenantReset` — memory rule).
- **Code-splitting** universal: todas as pages estão `React.lazy` no `App.tsx` (verificado no arquivo).
- **Sem `react-hook-form`** (0 imports): formulários usam `useState` + validação inline.
