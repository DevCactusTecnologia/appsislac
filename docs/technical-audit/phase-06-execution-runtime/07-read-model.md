# 07 — Read Model

Como o sistema lê.

## Views
- `v_dashboard_kpis` e similares → alimentam `useDashboardKpis`.
- Views operacionais em Mapa / Produção / Financeiro / Soroteca (leitura agregada).

## Stores (TanStack Query + ttlCache)
- 40+ stores em `src/data/**`, cada um com `ensureLoaded()` idempotente.
- QueryKey padrão: `["tenant", tenantId, <domínio>, ...args]`.
- Paginação: `usePaginatedAtendimentos`, `usePaginatedPacientes` (cursor pagination).

## Hooks
- `useDashboardKpis`, `useConvenioFaturas`, `useResultadosPage`, `useOcorrenciasPage`, `useAReceberPacientes`, `useSolicitacoesNaoLidas`.
- `useRealtimeChannel` — subscription genérica.
- `useEnsureStore` — força hidratação preguiçosa.

## RPCs de leitura
- `resolve_vr_por_paciente`, `resolve_critico`, `calc_preco_atendimento_exame`, `calc_saldo_devedor`, `calc_total_fatura`.
- `super_admin_list_migration_tables`, `super_admin_dump_ddl`, `super_admin_tenants_metrics`.
- `has_role`, `has_permission`, `is_super_admin`, `current_tenant_id`.

## Realtime
- Canal `atendimentos` → `subscribeAtendimentos` → invalida cache.
- Canais por domínio: resultados, financeiro, amostras, migração.

## Cache
- TanStack Query (5min stale por padrão).
- `ttlCache.ts` — cache local em memória para dicionários frequentes.
- Invalidação em `onAuthStateChange` via `installQueryClientTenantReset` + `clearTenantContextCache`.
