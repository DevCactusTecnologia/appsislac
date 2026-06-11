// Circuit Breaker helpers — chamam RPCs SECURITY DEFINER no Postgres.
// Lê feature flag em integrations.config.resilience.circuit_breaker.enabled
// (default true). Falhas semânticas (validação/contrato) NÃO devem chamar
// recordFailure — somente transporte/timeout.

import type { AdminClient } from "../integrationLog.ts";

export type CircuitFailureKind = "failure" | "timeout" | "transport";

export function circuitEnabled(integration: Record<string, unknown>): boolean {
  const cfg = (integration.config ?? {}) as Record<string, unknown>;
  const res = (cfg.resilience ?? {}) as Record<string, unknown>;
  const cb = (res.circuit_breaker ?? {}) as Record<string, unknown>;
  if (cb.enabled === false) return false;
  return true;
}

export async function circuitShouldAllow(
  admin: AdminClient,
  tenantId: string,
  provider: string,
): Promise<boolean> {
  try {
    const { data } = await admin.rpc("circuit_should_allow", {
      p_tenant: tenantId, p_provider: provider,
    });
    return data !== false;
  } catch (e) {
    console.warn("[circuit] should_allow rpc failed; allowing", e);
    return true;
  }
}

export async function circuitRecordSuccess(
  admin: AdminClient, tenantId: string, provider: string,
): Promise<void> {
  try {
    await admin.rpc("circuit_record_success", { p_tenant: tenantId, p_provider: provider });
  } catch (e) { console.warn("[circuit] record_success rpc failed", e); }
}

export async function circuitRecordFailure(
  admin: AdminClient, tenantId: string, provider: string, kind: CircuitFailureKind = "failure",
): Promise<void> {
  try {
    await admin.rpc("circuit_record_failure", {
      p_tenant: tenantId, p_provider: provider, p_kind: kind,
    });
  } catch (e) { console.warn("[circuit] record_failure rpc failed", e); }
}