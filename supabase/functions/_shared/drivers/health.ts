// Health metrics helper — UPSERT em provider_health_metrics via RPC.
// Ignora falhas para nunca quebrar o hot-path do pipeline.

import type { AdminClient } from "../integrationLog.ts";

export type HealthOutcome = "success" | "failure" | "timeout" | "transport" | "dead";

export async function healthRecord(
  admin: AdminClient,
  tenantId: string,
  provider: string,
  latencyMs: number,
  outcome: HealthOutcome,
  wasRetry = false,
): Promise<void> {
  try {
    await admin.rpc("health_record_sample", {
      p_tenant: tenantId,
      p_provider: provider,
      p_latency_ms: Math.max(0, Math.round(latencyMs)),
      p_outcome: outcome,
      p_was_retry: wasRetry,
    });
  } catch (e) {
    console.warn("[health] record rpc failed", e);
  }
}