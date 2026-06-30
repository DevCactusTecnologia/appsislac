/**
 * Runtime 2.0 — Porta única de entrada.
 *
 * Toda a aplicação (hooks, stores, services, pages, components)
 * deve importar daqui:
 *
 *     import { db } from "@/runtime/db";
 *     db.from("pacientes").select("*");
 *     db.auth.getUser();
 *     db.storage.from("tenant-assets");
 *
 * Nenhum outro módulo pode importar `@/integrations/supabase/client`.
 * A ESLint rule `no-restricted-imports` garante isso em build-time.
 *
 * `db` é um Proxy fino sobre `getClient()` para preservar a API
 * síncrona do antigo singleton sem sacrificar o roteamento via Factory.
 */

import type { RuntimeClient } from "./types";
import { getClient, refreshContext, resetRuntime, getCurrentContext } from "./factory";

export type { RuntimeClient, TenantRuntimeContext, RuntimeStrategy } from "./types";
export { RuntimeError } from "./types";
export { refreshContext, resetRuntime, getCurrentContext };

/**
 * Proxy que delega cada acesso ao client resolvido no momento.
 * Mantém compatibilidade 1:1 com `SupabaseClient` — qualquer chamada
 * antes-suportada por `supabase.*` funciona em `db.*`.
 */
export const db: RuntimeClient = new Proxy({} as RuntimeClient, {
  get(_target, prop, receiver) {
    const client = getClient() as unknown as Record<PropertyKey, unknown>;
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
