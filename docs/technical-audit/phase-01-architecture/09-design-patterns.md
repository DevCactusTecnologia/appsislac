# 09 — Design Patterns (observados no código)

Somente padrões efetivamente aplicados. Sem sugestões.

| Padrão | Onde | Como está implementado | Realmente usado? |
|---|---|---|---|
| **Provider (Context API)** | `src/contexts/AuthContext.tsx`, `MenuLayoutContext.tsx`, `SuperAdminPrefsContext.tsx`; providers de bibliotecas em `App.tsx` (`HelmetProvider`, `QueryClientProvider`, `TooltipProvider`) | Contextos React expostos por `useX()` hooks | Sim, em toda a árvore |
| **Custom Hooks** | `src/hooks/**` (20 hooks) + hooks internos em `pages/Financeiro/hooks/*`, `pages/ResultadoDetalhe/services/*` | Encapsulam lógica reativa (paginação, dashboard, compliance, HID scanner, realtime) | Sim |
| **Facade** | `src/data/*Store.ts` | Cada store expõe API simples (`load()`, `create()`, `update()`, listeners) escondendo detalhes de Supabase, cache e Realtime | Sim, padrão dominante |
| **Adapter** | `src/integrations/providers/dbsync/*` e `hermes-pardini/*` implementam `contracts/{transport,capabilities,providers}.ts` | Cada provider adapta sua interface externa (XML, WSDL, DTO) para o contrato interno | Sim |
| **Registry** | `src/integrations/providers/registry.ts`, `supabase/functions/_shared/registry.ts` | Lookup por chave para providers e runtime | Sim |
| **Strategy** | Precificação em `src/lib/pricing/*` + `src/domains/appointment/services/pricing.ts` (fallbacks CBHPM/TUSS/Própria — memory) | Estratégia selecionada em runtime conforme convênio | Sim |
| **Repository (aproximado)** | Stores em `src/data` + `src/domains/tenant/services/*Reader.ts` | Atuam como repositórios in-memory + I/O Supabase | Sim (com desvios: alguns stores fazem mais que persistência) |
| **Service layer** | `src/domains/**/services/*`, `pages/*/services/*`, `supabase/functions/_shared/*` | Serviços puros isolados da UI e do transporte | Sim |
| **Observer / Pub-Sub** | `useRealtimeChannel`, `subscribeAtendimentos` (memory), listeners internos nos stores, `queryClient.invalidateQueries` | Distribuição de eventos a subscribers | Sim |
| **Singleton (módulo)** | `src/integrations/supabase/client.ts`, `src/lib/queryClient.ts`, stores em `src/data/*Store.ts` | Instâncias únicas via export de módulo | Sim |
| **Command / Job** | `supabase/functions/integration-jobs-runner`, `integration-dispatch`, `integration-job-action`, `lab-apoio-cron-fetch` | Jobs enfileirados e drivers executando comandos | Sim |
| **Guard / Route Guard** | `ProtectedRoute` (`permissao`, `bloqueadoPontoColeta`), `RequireSuperAdmin`, `RotinaColetaAnaliseGuard` | HOCs que interceptam rotas | Sim |
| **Error Boundary** | `ChunkErrorBoundary`, `PageErrorBoundary` | Boundaries React para chunk lazy + páginas | Sim |
| **Lazy loading / Code splitting** | `React.lazy` em todas as pages de `App.tsx`; `data/lazyStores.ts`; `routePreload.ts` | Reduz payload inicial | Sim |
| **Template Method** | `src/lib/laudoTemplate.ts` + tokens (`##REF_X##`, `##GRAFICOHIST##`) resolvidos por `laudoResolver.ts` | Template com hooks de substituição | Sim |
| **Pipeline** | `laudoBatchPdf.ts` (paralelo via `runWithConcurrency.ts`); `mapaPrint.ts` | Estágios encadeados | Sim |
| **Feature Flag** | `src/lib/featureFlags.ts` | Habilita/desabilita superfícies em runtime | Sim |
| **Dependency Injection (leve)** | Contextos + parâmetros explícitos (ex.: `getUserTenantClient(userId)`); providers via props | Não há container DI dedicado | Parcial |
| **Test Fixtures** | `playwright-fixture.ts`, `src/test/*`, `src/lib/__tests__/*`, `supabase/tests/` | Setup mínimo | Sim, cobertura seletiva |

### Padrões declarados na memória do projeto (evidência)
- Padrão **query key com prefixo tenant** — `["tenant", tenantId, ...]` reforçado por `installQueryClientTenantReset`.
- Padrão **RLS + policies obrigatórias** (`current_tenant_id()`, `has_role()`, `has_permission()`, `is_super_admin()`) em toda tabela de domínio.
- Padrão **Diálogos flat** e **animações layoutId** (framer-motion) — regras de UI aplicadas de forma sistemática.
