# 02 — Server Runtime

## Objetivo

Concluir `getTenantClient(tenant_id)` server-side com Dedicated real, sem fail-closed nem fallback silencioso.

## Implementação — Slice 1

Arquivo: `supabase/functions/_shared/runtime/db.ts`

### Antes
```ts
if (ctx.strategy === "dedicated") {
  throw new Error("runtime dedicated não disponível ainda"); // fail-closed
}
return getPlatformClient();
```

### Depois
```ts
if (ctx.strategy !== "dedicated") return getPlatformClient();

// cache LRU idle-5min por tenant
// lookup registry: db_project_url + db_secret_ref
// resolve secret Deno.env.get(db_secret_ref) → service-role do projeto dedicated
// buildDedicatedClient(url, serviceKey)
// falha explícita → MigrationBlockedError (Fase 8)
```

## Componentes entregues

| Componente | Descrição |
|---|---|
| `getTenantClient(tenant_id)` | Roteia shared/dedicated real |
| `dedicatedHealth(tenant_id)` | Probe `_sislac_schema_health` com latência |
| `invalidateDedicatedCache(tenant_id?)` | Invalidação pós-flip/rollback |
| `MigrationBlockedError` (server) | 4 códigos: URL/KEY/CLIENT/SUSPENDED |
| Cache LRU (idle 5min) | Reuso de conexão por tenant |

## Connection lifecycle

- **Create**: primeira chamada resolve registry + secret + monta client.
- **Reuse**: cache por `tenant_id` até 5min de idle.
- **Prune**: `pruneDedicatedCache()` em cada `getTenantClient`.
- **Dispose**: `invalidateDedicatedCache()` para flip/rollback.
- **Retry**: delegado ao SDK Supabase (retry HTTP built-in). Futuro: retry exponencial explícito no Slice 3.

## Fail-safe (Fase 8)

Todo caminho de falha lança `MigrationBlockedError`. **Nenhum silent fallback para shared**. Consumidores capturam e devolvem 503 ao usuário; nunca 200 com dados errados.

## Status

| Item | Estado |
|---|---|
| Dedicated server real | ✓ |
| Fail-closed removido | ✓ |
| Cache + lifecycle | ✓ (idle 5min) |
| Health probe | ✓ |
| Retry exponencial explícito | △ (SDK default; refinar em Slice 3) |
| Pooling avançado | △ (não necessário na Fase 1 — HTTP/2 keep-alive suficiente) |
| Telemetria em `platform_audit` | ✗ pendente Slice 2 |

## Bloqueadores restantes

- Slice 2: instrumentar telemetria (`runtime.server.*`).
- Slice 3: retry exponencial + circuit breaker por tenant.
