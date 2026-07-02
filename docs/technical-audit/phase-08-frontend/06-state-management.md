# 06 — State Management

## Camadas de estado (evidências)

### 1. Context (3)
- `AuthContext.tsx` — sessão Supabase real, `profiles`, `user_roles`, `isSuperAdmin`, permissões. Fonte da verdade de autenticação.
- `MenuLayoutContext.tsx` — modo do menu (sidebar/topbar), colapso, prefs de layout.
- `SuperAdminPrefsContext.tsx` — prefs do console super-admin.

### 2. Stores in-memory (37 em `src/data/`)
Padrão observado: módulo com `state` privado + `subscribe/get/set` + boot assíncrono.
Ex.: `atendimentoStore/` (dividido em `queries`, `mutations`, `exames`, `terceirizados`, `realtime`, `types`, `_internal`), `pacienteStore.ts`, `financeiroStore.ts`, `unidadeStore.ts`, `convenioStore.ts`, `exameCatalogoStore.ts`, `valoresReferenciaStore.ts`, `reguasEtariasStore.ts`, etc.
Boot: `storeBoot.ts`, `lazyStores.ts` (registro), `useEnsureStore` (trigger). Cache TTL: `src/lib/ttlCache.ts` (memory).

### 3. TanStack Query
- `queryClient` em `src/lib/queryClient.ts` com `installQueryClientTenantReset` (memory: `["tenant", tenantId, ...]`).
- Uso **limitado**: apenas 6 arquivos consomem `useQuery`/`useMutation`. Predomina o padrão store in-memory.

### 4. Realtime
- Wrapper `useRealtimeChannel.ts`.
- Assinantes ativos: `AuthContext` (session), `LabApoio.tsx`, `SolicitacoesSite.tsx`, `useSolicitacoesNaoLidas`, `atendimentoStore/realtime.ts` (subscribeAtendimentos — memory).

### 5. Cache
- Query cache (TanStack) + TTL cache local (`ttlCache.ts`) + hidratação lazy dos stores.
- Invalidação por tenant é obrigatória (memory rule) via `installQueryClientTenantReset` + reset de stores no `AuthContext`.

### 6. Estado local
Componentes usam `useState`/`useReducer` para UI (open/close, filtros, wizard step). Formulários dependem inteiramente de `useState` (sem `react-hook-form` — 0 imports).

## Onde está a verdade da UI?
- **Sessão/permissão** → `AuthContext`.
- **Dados operacionais** → stores in-memory (`src/data/*Store*`), hidratados a partir do Supabase via `src/runtime/db.ts`.
- **Realtime** → propaga mudanças para stores (ex.: `atendimentoStore/realtime.ts`) que re-emitem para os subscribers.
- **Preferências de UI** → contextos (`MenuLayout`, `SuperAdminPrefs`) + `localStorage`.
- **Fonte última** = banco (RPCs `*_tx`); o frontend é replicador reativo.
