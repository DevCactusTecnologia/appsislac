# 03 — Runtime Validation

## Shared Strategy — `src/runtime/db/strategies/shared.ts`
- `createClient(ctx)` retorna `__getSharedTransport()` (o singleton).
- `dispose()` é no-op — o singleton é global.
- Não há pool próprio (o Supabase JS gerencia).
- **Fail mode**: nunca falha; sempre retorna o transport global.

## Dedicated Strategy — `src/runtime/db/strategies/dedicated.ts`
- `createClient(ctx)` exige `database_url` + `anon_key`; caso contrário lança `RuntimeError("RUNTIME_DEDICATED_MISSING_CREDENTIALS")`.
- Cache interno `Map<`url::anon.slice(-12)`, RuntimeClient>` — evita recriar cliente para o mesmo tenant.
- `auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false }` — **transport de dados puro**, sessão fica no shared.
- `dispose(ctx)` remove do cache local; não fecha WS realtime explicitamente.

## ConnectionFactory — `src/runtime/db/factory.ts`
- `cache: Map<string, CacheEntry>` chaveado por `"strategy::project_ref::tenant_id"`.
- Cada entry mantém `primary` (shared) + `dedicated` (opcional).
- `currentContext` é uma variável mutável de módulo — **um único tenant ativo por sessão do browser**.
- `resolving: Promise` deduplica chamadas concorrentes de `refreshContext()`.
- **Fail-safe**: se `buildEntry` falhar em criar o dedicated, seta `dedicated=null` e emite `runtime.failure`, seguindo apenas com shared.
- Não há TTL — cache vive até `resetRuntime()` (logout).

## Proxy `db` — `src/runtime/db/index.ts`
- `db.from(table)` roteia via `routedFrom()`:
  - Se `strategy==='dedicated'` E `table ∈ allowed_tables` E `dedicatedClient!==null` → dedicated.
  - Fallback silencioso para shared (emite `runtime.route.shared_fallback`).
- Todo o resto (`db.auth`, `db.storage`, `db.functions`, `db.rpc`, `db.channel`) → shared, sempre.

## Checklist de propriedades

| Propriedade | Estado | Evidência |
|---|---|---|
| Connection pool | N/A (delegado ao SDK) | Nenhum pool próprio |
| Retry | ✗ Ausente | Nenhum wrapper de retry em factory/strategies |
| Dispose | △ Parcial | `sharedStrategy.dispose()` é no-op; `dedicatedStrategy.dispose()` só limpa map local |
| TTL | ✗ Ausente | Cache não expira |
| Invalidação | △ Manual | Só `resetRuntime()` (logout) e `refreshContext()` (troca de tenant) |
| Telemetria | △ Dev-only | `telemetry.ts` só emite se `import.meta.env.DEV` |
| Fail-closed | △ Parcial | Server (`getTenantClient`) fail-closed; front fail-open (cai no shared) |
| Fail-open | ✓ (front) | `routedFrom` faz fallback shared quando dedicated indisponível |
| Thread safety | ✓ (single-thread JS) | Estado de módulo mutável — safe em browser |
| Reuso de client | ✓ | Factory cache + cache local em DedicatedStrategy |
| Memory leak | △ Risco baixo | Cache cresce por `strategy::project_ref::tenant_id`; em SPA típica só 1 tenant por sessão |
| Cold start | ✗ | Sem warmup — 1º acesso paga latência da edge fn `tenant-runtime-config` |
| Warm start | ✓ | Após `refreshContext`, cache hit direto |
