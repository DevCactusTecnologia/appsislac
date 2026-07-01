/**
 * Runtime 2.0 — Resolver.
 *
 * Única autoridade para transformar `tenant_id` em `TenantRuntimeContext`.
 * Delega a descoberta de metadados ao `tenantContext`.
 */

import { supabase as sharedClient } from "@/integrations/supabase/client";
import { getTenantContext } from "./tenantContext";
import type { TenantRuntimeContext } from "./types";
import { emit } from "./telemetry";

const SHARED_PROJECT_REF =
  (import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined) ?? "shared";

export async function resolveCurrentTenant(): Promise<TenantRuntimeContext> {
  const started = performance.now();
  const legacy = await getTenantContext();
  emit({ type: "runtime.resolve.start", tenant_id: legacy.tenant_id });

  const dedicated = legacy.database_strategy === "dedicated"
    && !!legacy.database_url
    && !!legacy.anon_key;

  const ctx: TenantRuntimeContext = {
    tenant_id: legacy.tenant_id,
    strategy: dedicated ? "dedicated" : "shared",
    project_ref: dedicated ? (legacy.database_url as string) : SHARED_PROJECT_REF,
    database_url: legacy.database_url ?? null,
    anon_key: legacy.anon_key ?? null,
    allowed_tables: legacy.allowed_tables ?? [],
  };

  emit({
    type: "runtime.resolve.end",
    tenant_id: ctx.tenant_id,
    strategy: ctx.strategy,
    ms: Math.round(performance.now() - started),
  });
  return ctx;
}

export function getBootstrapContext(): TenantRuntimeContext {
  return {
    tenant_id: "00000000-0000-0000-0000-000000000001",
    strategy: "shared",
    project_ref: SHARED_PROJECT_REF,
    database_url: null,
    anon_key: null,
    allowed_tables: [],
  };
}

export function __getSharedTransport() {
  return sharedClient;
}
