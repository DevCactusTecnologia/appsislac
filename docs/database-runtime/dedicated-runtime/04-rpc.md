# 04 — RPC

## Status: PLANEJADO — execução no Slice 4

## Diagnóstico

Todas as RPCs `public.*` hoje residem apenas no Shared. Tenant marcado como `dedicated` chama RPC via `sharedClient.rpc(...)`, que executa no banco errado (control-plane) — dados operacionais retornados são do Shared.

## Ação planejada

1. **Registrar escopo**: nova tabela `rpc_registry(function_name text pk, scope text check in ('platform','tenant'))`. Popular via SQL a partir de `pg_proc`.
2. **Recriar tenant RPCs no Dedicated**: incluir em `SCHEMA_MINIMO_V2` (migração dedicada):
   - `current_tenant_id()`, `is_super_admin()`, `has_permission()`, `has_role()`
   - Sequences: `guia_sequence`, `protocolo_sequence`, `amostra_sequence`, `friendly_id_counters`
   - Transações: `update_atendimento_tx`, `finalizar_atendimento_tx`, etc.
3. **Frontend router**: `db.rpc(name, args)` passa a consultar `rpc_registry` cache local + rotear via `getDedicatedClient()` quando `scope='tenant'`.
4. **Server**: idem em `getTenantClient(tenant_id).rpc(...)` já resolve nativamente.

## Compatibilidade

- Control-plane RPCs (`super_admin_*`, `tenant_registry_*`) permanecem no Shared.
- Tenants Shared continuam funcionando exatamente igual (sem allowlist dedicated).

## Bloqueadores

- Classificação manual das ~120 RPCs existentes.
- SCHEMA_MINIMO_V2 (migração idempotente para provisionamento).

## Status

| Item | Estado |
|---|---|
| Inventário RPCs | ✗ pendente |
| rpc_registry | ✗ pendente |
| SCHEMA_MINIMO_V2 | ✗ pendente |
| Router front | ✗ pendente |
