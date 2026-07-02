# 05 — Frontend Performance

## Bundle & Splitting

- Vite 5 + React 18. `React.lazy` / `lazy(` — **83 ocorrências** em `src/`.
- `Suspense` — **69 ocorrências**.
- Code splitting por rota: evidenciado (`src/App.tsx` + `LandingPageResponsive`, `producao/ProducaoChartsLazy`, `lazyStores.ts`).

## Cache

- **TanStack Query** — apenas **8 arquivos** usam `useQuery/useMutation/QueryClient` (Fase 08 confirma).
- Predomínio de **37 stores in-memory** custom (`src/data/*Store.ts`) — com `ttlCache.ts` (memory).
- Query cache tenant-scoped por convenção (`queryKey ["tenant", tenantId, ...]`).

## Re-render / memoização

- 141 arquivos usam `useEffect/useMemo/useCallback`.
- Sem varredura profiler; densidade indica uso ativo mas não garante ausência de renders redundantes.
- Constraint documentada: layout raiz **sem** `key={location.pathname}` (evita remounts).

## Virtualização

- Grep `react-virtual|react-window|virtualiz`: **não encontrado** neste turno.
- Listas grandes (pacientes 2k, audit_logs 13k) — servidas por cursor pagination, não virtualização.

## Suspense / streaming

- Suspense usado com lazy routes; SSR não aplicável (SPA).

## Realtime → re-render

- 7 arquivos consomem `useRealtimeChannel` / `postgres_changes` — cada evento invalida store e dispara re-render de páginas assinadas.

## Arquivos densos

- `ResultadoDetalhe.tsx` — 160KB (Fase 08).
- Vários dialogs de configuração > 40KB.

## Achados

| # | Item | Severidade |
|---|---|---|
| F01 | Virtualização ausente em listas potencialmente longas | MÉDIO |
| F02 | Dualidade Query Cache vs Store in-memory dificulta invalidação uniforme | MÉDIO |
| F03 | Arquivos > 100KB (ResultadoDetalhe) impactam parse/tempo de rota | MÉDIO |
| F04 | Sem métrica LCP/INP colhida | INCONCLUSIVO |
