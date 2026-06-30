/**
 * Runtime 2.0 — ConnectionFactory.
 *
 * Única fábrica de clientes do SISLAC. Mantém um cache indexado por
 * `(tenant_id, project_ref, strategy)` e delega a criação ao
 * adapter correto. Nenhum outro módulo pode criar `SupabaseClient`.
 */

import { sharedStrategy } from "./strategies/shared";
import { dedicatedStrategy } from "./strategies/dedicated";
import { getBootstrapContext, resolveCurrentTenant } from "./resolver";
import { emit } from "./telemetry";
import type { RuntimeClient, RuntimeStrategyAdapter, TenantRuntimeContext } from "./types";

const cache = new Map<string, { ctx: TenantRuntimeContext; client: RuntimeClient }>();
let currentContext: TenantRuntimeContext = getBootstrapContext();
let resolving: Promise<TenantRuntimeContext> | null = null;

function cacheKey(ctx: TenantRuntimeContext): string {
  return `${ctx.strategy}::${ctx.project_ref}::${ctx.tenant_id}`;
}

function adapterFor(ctx: TenantRuntimeContext): RuntimeStrategyAdapter {
  return ctx.strategy === "dedicated" ? dedicatedStrategy : sharedStrategy;
}

function getOrCreate(ctx: TenantRuntimeContext): RuntimeClient {
  const key = cacheKey(ctx);
  const hit = cache.get(key);
  if (hit) {
    emit({ type: "runtime.client.cache_hit", tenant_id: ctx.tenant_id, project_ref: ctx.project_ref });
    return hit.client;
  }
  const client = adapterFor(ctx).createClient(ctx);
  cache.set(key, { ctx, client });
  emit({
    type: "runtime.client.created",
    tenant_id: ctx.tenant_id,
    project_ref: ctx.project_ref,
    strategy: ctx.strategy,
  });
  return client;
}

/**
 * Cliente síncrono para o contexto corrente.
 * Antes do primeiro resolve, devolve o cliente shared do bootstrap
 * — comportamento idêntico ao antigo singleton.
 */
export function getClient(): RuntimeClient {
  return getOrCreate(currentContext);
}

/** Força um novo resolve e atualiza o contexto corrente. */
export async function refreshContext(): Promise<TenantRuntimeContext> {
  if (!resolving) {
    resolving = resolveCurrentTenant()
      .then((ctx) => {
        currentContext = ctx;
        // Garante que o client desse contexto está cacheado.
        getOrCreate(ctx);
        return ctx;
      })
      .finally(() => {
        resolving = null;
      });
  }
  return resolving;
}

/** Limpa o cache (logout / troca de tenant). */
export async function resetRuntime(): Promise<void> {
  for (const { ctx } of cache.values()) {
    await adapterFor(ctx).dispose(ctx);
    emit({ type: "runtime.client.disposed", tenant_id: ctx.tenant_id, project_ref: ctx.project_ref });
  }
  cache.clear();
  currentContext = getBootstrapContext();
}

/** Snapshot do contexto atual (debug/telemetria). */
export function getCurrentContext(): TenantRuntimeContext {
  return currentContext;
}
