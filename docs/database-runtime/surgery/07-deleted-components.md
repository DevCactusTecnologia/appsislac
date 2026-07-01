# 07 — Deleted Components

## Abstrações
- Proxy fachada `db` (client) → substituído pelo singleton direto.
- `RuntimeStrategyAdapter` + shared/dedicated strategies.
- `Factory` de clientes por contexto + cache `refreshContext`/`resetRuntime` (mantidos como shim no-op).
- `Resolver` de contexto legado → TenantRuntimeContext.
- `Telemetry` cliente (`emit`).
- `IdentityIssuer` registry (client) + `supabaseSharedIssuer`.
- `ServerIdentityValidator` (server).
- `TenantContextProvider` + `SupabaseRegistryProvider` (server).
- `dedicatedHealth`, `invalidateDedicatedCache` (server).
- Roteamento cliente por allowlist de tabelas.

## Consumidores após remoção
- `main.tsx`: removida chamada `registerIdentityIssuer(supabaseSharedIssuer)`.
- Guardrail atualizado para nova doc.
- 150+ arquivos que importam `@/runtime/db` continuam funcionando via novo módulo consolidado.
