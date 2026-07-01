/**
 * Runtime 2.0 — Resolver.
 *
 * Única autoridade para transformar `tenant_id` em `TenantRuntimeContext`.
 * Encapsula a leitura de `tenant_registry` / `tenants` e expõe um
 * resultado normalizado para a Factory.
 *
 * Mantemos compatibilidade com `src/lib/db/tenantResolver.ts` (legado),
 * delegando a ele a descoberta do tenant_id atual via Supabase Auth.
 */

import { supabase as sharedClient } from "@/integrations/supabase/client";
import { getTenantContext } from "./tenantContext";
import type { TenantRuntimeContext } from "./types";
import { emit } from "./telemetry";

const SHARED_PROJECT_REF =
  (import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined) ?? "shared";

/** Resolve o contexto runtime do tenant atualmente autenticado. */
export async function resolveCurrentTenant(): Promise<TenantRuntimeContext> {
  const started = performance.now();
  const legacy = await getTenantContext();
  emit({ type: "runtime.resolve.start", tenant_id: legacy.tenant_id });

  const ctx: TenantRuntimeContext = {
    tenant_id: legacy.tenant_id,
    strategy: legacy.database_strategy === "dedicated" ? "dedicated" : "shared",
    project_ref:
      legacy.database_strategy === "dedicated" && legacy.database_url
        ? legacy.database_url
        : SHARED_PROJECT_REF,
    database_url: legacy.database_url ?? null,
  };

  emit({
    type: "runtime.resolve.end",
    tenant_id: ctx.tenant_id,
    strategy: ctx.strategy,
    ms: Math.round(performance.now() - started),
  });
  return ctx;
}

/**
 * Contexto sincrono fallback usado antes do primeiro resolve.
 * Aponta para o projeto shared do `.env` — mesma semântica do
 * antigo singleton `supabase`.
 */
export function getBootstrapContext(): TenantRuntimeContext {
  return {
    tenant_id: "00000000-0000-0000-0000-000000000001",
    strategy: "shared",
    project_ref: SHARED_PROJECT_REF,
    database_url: null,
  };
}

/** Acesso interno ao cliente shared (usado apenas pela SharedStrategy). */
export function __getSharedTransport() {
  return sharedClient;
}
