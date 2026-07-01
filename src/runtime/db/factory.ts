/**
 * Runtime 2.0 — ConnectionFactory (Fase 2).
 *
 * Mantém DOIS clientes por contexto quando o tenant está em modo
 * dedicated: o `sharedClient` continua servindo auth/storage/realtime
 * e tabelas fora do allowlist; o `dedicatedClient` serve apenas as
 * tabelas do allowlist (Fase 2 — allowlist mínima).
 */

import { sharedStrategy } from "./strategies/shared";
import { dedicatedStrategy } from "./strategies/dedicated";
import { getBootstrapContext, resolveCurrentTenant, __getSharedTransport } from "./resolver";
import { emit } from "./telemetry";
import type { RuntimeClient, TenantRuntimeContext } from "./types";

interface CacheEntry {
  ctx: TenantRuntimeContext;
  primary: RuntimeClient;        // shared (auth/storage/tabelas fora do allowlist)
  dedicated: RuntimeClient | null; // dedicated (só quando strategy === "dedicated")
}

const cache = new Map<string, CacheEntry>();
let currentContext: TenantRuntimeContext = getBootstrapContext();
let resolving: Promise<TenantRuntimeContext> | null = null;

function cacheKey(ctx: TenantRuntimeContext): string {
  return `${ctx.strategy}::${ctx.project_ref}::${ctx.tenant_id}`;
}

function buildEntry(ctx: TenantRuntimeContext): CacheEntry {
  const primary = sharedStrategy.createClient(ctx);
  let dedicated: RuntimeClient | null = null;
  if (ctx.strategy === "dedicated") {
    try {
      dedicated = dedicatedStrategy.createClient(ctx);
      emit({
        type: "runtime.client.created",
        tenant_id: ctx.tenant_id,
        project_ref: ctx.project_ref,
        strategy: "dedicated",
      });
    } catch (e) {
      // Fail-safe: se falhar em criar o dedicated, seguimos só com shared.
      emit({
        type: "runtime.failure",
        tenant_id: ctx.tenant_id,
        code: "DEDICATED_CLIENT_CREATE_FAILED",
        message: e instanceof Error ? e.message : String(e),
      });
      dedicated = null;
    }
  }
  return { ctx, primary, dedicated };
}

function getOrCreate(ctx: TenantRuntimeContext): CacheEntry {
  const key = cacheKey(ctx);
  const hit = cache.get(key);
  if (hit) {
    emit({ type: "runtime.client.cache_hit", tenant_id: ctx.tenant_id, project_ref: ctx.project_ref });
    return hit;
  }
  const entry = buildEntry(ctx);
  cache.set(key, entry);
  return entry;
}

/** Cliente shared (default) do contexto corrente — usado por auth/storage/etc. */
export function getClient(): RuntimeClient {
  // Antes do primeiro resolve, o bootstrap context aponta para shared —
  // aqui retornamos o transport shared direto para evitar depender do cache.
  if (currentContext.strategy === "shared") {
    return __getSharedTransport();
  }
  return getOrCreate(currentContext).primary;
}

/** Client dedicated do contexto corrente (ou null se não aplicável). */
export function getDedicatedClient(): RuntimeClient | null {
  if (currentContext.strategy !== "dedicated") return null;
  return getOrCreate(currentContext).dedicated;
}

/** Allowlist de tabelas que devem rotear para o dedicated. */
export function getAllowedDedicatedTables(): ReadonlySet<string> {
  return new Set(currentContext.allowed_tables ?? []);
}

/** Snapshot do contexto atual. */
export function getCurrentContext(): TenantRuntimeContext {
  return currentContext;
}

export async function refreshContext(): Promise<TenantRuntimeContext> {
  if (!resolving) {
    resolving = resolveCurrentTenant()
      .then((ctx) => {
        currentContext = ctx;
        getOrCreate(ctx);
        return ctx;
      })
      .finally(() => { resolving = null; });
  }
  return resolving;
}

export async function resetRuntime(): Promise<void> {
  for (const entry of cache.values()) {
    await sharedStrategy.dispose(entry.ctx);
    if (entry.dedicated) {
      try { await dedicatedStrategy.dispose(entry.ctx); } catch { /* noop */ }
    }
    emit({ type: "runtime.client.disposed", tenant_id: entry.ctx.tenant_id, project_ref: entry.ctx.project_ref });
  }
  cache.clear();
  currentContext = getBootstrapContext();
}
