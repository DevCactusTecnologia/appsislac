# 05 — Hooks

**Total:** 20 arquivos em `src/hooks/`.

| Hook | Responsabilidade | Consome | Altera estado |
|---|---|---|---|
| `use-mobile.tsx` | Media query mobile/compact | `window.matchMedia` | Local |
| `use-toast.ts` | Toast singleton (shadcn) | React state | Global (singleton) |
| `use-body-scroll-lock.ts` | Trava scroll do body em modal | DOM | DOM |
| `use-debounced-value.ts` | Debounce genérico | `setTimeout` | Local |
| `use-scroll-fade.ts` | Fade de listas ao rolar | `IntersectionObserver` | Local |
| `useEnsureStore.ts` | Hidrata stores lazy on-mount | `ensureLazyStore` | Store |
| `useRealtimeChannel.ts` | Wrapper de Supabase Realtime | `supabase.channel` | Local (callback) |
| `useDashboardKpis.ts` | KPIs derivados p/ Dashboard | stores | Local (derivado) |
| `useAReceberPacientes.ts` | Derivação de "A Receber" (pacientes) | `financeiroStore`/`atendimentoStore` | Local |
| `useConvenioFaturas.ts` | Faturas de convênio | stores + rpc | Local |
| `useDicionario.ts` | Dicionários (tipos/destinos/formas) | `selectOptionsStore` | Local |
| `useHidScanner.ts` | Captura de leitor de código HID | `keydown` global | Local |
| `useOcorrenciasPage.ts` | Estado da página de ocorrências | stores/rpc | Local |
| `usePaginatedAtendimentos.ts` | Cursor pagination de atendimentos | store + runtime | Local |
| `usePaginatedPacientes.ts` | Cursor pagination de pacientes | store + runtime | Local |
| `useResultadosPage.ts` | Estado da página de resultados | stores/derivação | Local |
| `useRotinaConfig.ts` | Config de fluxo Registro/Análise | `labConfigStore` | Local |
| `useSolicitacoesNaoLidas.ts` | Contador realtime de solicitações | Supabase Realtime | Local |
| `useCleanupUtils.ts` | Utilitário de limpeza (dev) | — | — |
| `useCompliance.tsx` | Flags/estado LGPD/compliance | stores/rpc | Local |

## Quem chama backend
- **Realtime**: `useRealtimeChannel`, `useSolicitacoesNaoLidas` (via `supabase.channel`).
- **RPC/Edge indireto** via stores: `useConvenioFaturas`, `useOcorrenciasPage`, `useAReceberPacientes`, `usePaginated*`.
- Nenhum hook em `src/hooks/` chama `supabase.rpc` diretamente — todos delegam para stores/runtime.

## Órfãos
Todos os 20 hooks são referenciados por ≥1 page ou componente (grep confirma consumo em pages listadas na Parte 03/06). Nenhum hook órfão foi identificado.

## Coordenação vs decisão
Hooks predominantemente **coordenam** (fetch, derivação, subscribe). Decisões de negócio permanecem nas RPCs `*_tx` (memories) — o hook apenas dispara.
