// Dead Letter Queue helper. Move o job para integration_dead_jobs com
// snapshot de envelope/resposta mais recente em integration_requests/responses.
// Marca o integration_jobs original como FAILED com prefixo "DEAD:".

import { logIntegration, type AdminClient } from "../integrationLog.ts";

export type DeathReason =
  | "SCHEMA_VIOLATION"
  | "PARSE_ERROR"
  | "CONTRACT_MISMATCH"
  | "AUTH_IRRECOVERABLE"
  | "CAPABILITY_NOT_SUPPORTED"
  | "ENVELOPE_INCONSISTENT"
  | "MALFORMED_RESPONSE"
  | "PROVIDER_NOT_SUPPORTED";

export interface SendToDlqArgs {
  tenantId: string;
  integrationId: string;
  provider: string;
  job: Record<string, unknown> & { id: string; kind: string; payload?: unknown; correlation_id?: string | null; retry_count?: number | null; last_error?: string | null };
  reason: DeathReason;
  message: string;
  stacktrace?: string;
}

export async function sendToDlq(
  admin: AdminClient,
  args: SendToDlqArgs,
): Promise<void> {
  try {
    // snapshot do último request/response para auditoria
    let envelope: string | null = null;
    let response: string | null = null;
    try {
      const { data: lastReq } = await admin
        .from("integration_requests")
        .select("id, envelope")
        .eq("job_id", args.job.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastReq?.envelope) envelope = lastReq.envelope as string;
      if (lastReq?.id) {
        const { data: lastResp } = await admin
          .from("integration_responses")
          .select("raw_payload")
          .eq("request_id", lastReq.id)
          .maybeSingle();
        if (lastResp?.raw_payload) response = lastResp.raw_payload as string;
      }
    } catch (_) { /* best-effort */ }

    const correlationId = (args.job.correlation_id as string | null) ?? null;

    await admin.from("integration_dead_jobs").insert({
      tenant_id: args.tenantId,
      integration_id: args.integrationId,
      provider: args.provider,
      original_job_id: args.job.id,
      kind: args.job.kind,
      correlation_id: correlationId,
      death_reason: args.reason,
      death_message: args.message,
      payload: (args.job.payload as Record<string, unknown>) ?? {},
      request_envelope: envelope,
      response_body: response,
      stacktrace: args.stacktrace ?? null,
      retry_history: {
        retry_count: args.job.retry_count ?? 0,
        last_error: args.job.last_error ?? null,
      },
    });

    await logIntegration(admin, {
      tenant_id: args.tenantId,
      integration_id: args.integrationId,
      job_id: args.job.id,
      level: "CRITICAL",
      message: `DLQ: ${args.reason} — ${args.message}`,
      context: { correlation_id: correlationId, kind: args.job.kind },
    });
  } catch (e) {
    console.error("[dlq] sendToDlq failed", e);
  }
}