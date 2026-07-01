/**
 * Runtime 2.0 — Porta única de entrada.
 *
 * Toda a aplicação importa daqui:
 *     import { db } from "@/runtime/db";
 *     db.from("pacientes").select("*");
 *
 * Fase 2: quando o tenant está em modo dedicated E a tabela está no
 * allowlist, `db.from(table)` roteia para o cliente do banco dedicado.
 * Todo o resto (`db.auth`, `db.storage`, `db.functions`, `db.rpc`,
 * `db.channel`, tabelas fora do allowlist) permanece no shared.
 */

import type { RuntimeClient } from "./types";
import {
  getClient,
  getDedicatedClient,
  getAllowedDedicatedTables,
  getCurrentContext,
  refreshContext,
  resetRuntime,
} from "./factory";
import { emit } from "./telemetry";

export type { RuntimeClient, TenantRuntimeContext, RuntimeStrategy } from "./types";
export { RuntimeError } from "./types";
export { refreshContext, resetRuntime, getCurrentContext };

export {
  getTenantContext,
  getCurrentTenantId,
  getCurrentTenantNome,
  getCachedTenantNome,
  clearTenantContextCache,
  installTenantAuthInvalidation,
} from "./tenantContext";
export type { TenantContext, TenantDBStrategy } from "./tenantContext";

/**
 * Wrapper de `db.from(table)` — decide entre dedicated e shared por tabela.
 * Ficou isolado aqui para não vazar a lógica para o resto do app.
 */
function routedFrom(table: string) {
  const ctx = getCurrentContext();
  const allowed = getAllowedDedicatedTables();
  if (ctx.strategy === "dedicated" && allowed.has(table)) {
    const dedicated = getDedicatedClient();
    if (dedicated) {
      emit({ type: "runtime.route.dedicated", tenant_id: ctx.tenant_id, table });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (dedicated as any).from(table);
    }
    emit({
      type: "runtime.route.shared_fallback",
      tenant_id: ctx.tenant_id,
      table,
      reason: "dedicated_client_unavailable",
    });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getClient() as any).from(table);
}

export const db: RuntimeClient = new Proxy({} as RuntimeClient, {
  get(_target, prop, receiver) {
    if (prop === "from") {
      return (table: string) => routedFrom(table);
    }
    const client = getClient() as unknown as Record<PropertyKey, unknown>;
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(client) : value;
  },
});
