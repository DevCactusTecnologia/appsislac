// Pipeline genérico: executa um driver, aplica retry/backoff uniforme,
// converte DriverOutcome em resposta HTTP padronizada, garante log.

import { logIntegration, nextRetryDelayMs, type AdminClient } from "../integrationLog.ts";
import type { DriverContext, DriverOutcome, ProviderDriver } from "./types.ts";
import { circuitEnabled, circuitRecordFailure, circuitRecordSuccess, circuitShouldAllow } from "./circuit.ts";
import { healthRecord } from "./health.ts";
import { sendToDlq } from "./dlq.ts";

export interface PipelineResponse {
  status: number;
  body: Record<string, unknown>;
}

export async function runPipeline(
  driver: ProviderDriver,
  ctx: DriverContext,
): Promise<PipelineResponse> {
  const provider = String(driver.provider);
  const tenant = ctx.tenant_id;
  const cbOn = circuitEnabled(ctx.integration);

  // Gate: Circuit Breaker
  if (cbOn) {
    const allowed = await circuitShouldAllow(ctx.admin, tenant, provider);
    if (!allowed) {
      await logIntegration(ctx.admin, {
        tenant_id: tenant, integration_id: ctx.integration_id, job_id: ctx.job.id,
        level: "WARN", message: "Circuit OPEN — job reagendado",
        context: { provider, correlation_id: ctx.correlationId },
      });
      return await rescheduleJob(ctx.admin, ctx.job, "circuit_open");
    }
  }

  const startedAt = Date.now();
  const wasRetry = (ctx.job.retry_count as number | null ?? 0) > 0;
  let outcome: DriverOutcome;
  try {
    outcome = await driver.dispatch(ctx);
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    await logIntegration(ctx.admin, {
      tenant_id: ctx.tenant_id,
      integration_id: ctx.integration_id,
      job_id: ctx.job.id,
      level: "ERROR",
      message: `Exceção no driver ${driver.provider}`,
      context: { error: reason, correlation_id: ctx.correlationId },
    });
    const kind: "timeout" | "transport" | "failure" =
      /timeout/i.test(reason) ? "timeout"
      : /(network|fetch|econn|socket|tls|dns)/i.test(reason) ? "transport"
      : "failure";
    if (cbOn) await circuitRecordFailure(ctx.admin, tenant, provider, kind);
    await healthRecord(ctx.admin, tenant, provider, Date.now() - startedAt, kind, wasRetry);
    return await rescheduleJob(ctx.admin, ctx.job, reason);
  }

  const latency = Date.now() - startedAt;
  switch (outcome.kind) {
    case "completed":
      await ctx.admin.from("integration_jobs").update({
        status: "COMPLETED",
        completed_at: new Date().toISOString(),
        last_error: null,
        result: outcome.result,
      }).eq("id", ctx.job.id);
      if (cbOn) await circuitRecordSuccess(ctx.admin, tenant, provider);
      await healthRecord(ctx.admin, tenant, provider, latency, "success", wasRetry);
      return { status: outcome.httpStatus ?? 200, body: { ok: true, completed: true, ...outcome.result } };
    case "reschedule":
      // reschedule por motivos de transporte conta como falha leve para o circuit
      if (cbOn) await circuitRecordFailure(ctx.admin, tenant, provider, "failure");
      await healthRecord(ctx.admin, tenant, provider, latency, "failure", wasRetry);
      return await rescheduleJob(ctx.admin, ctx.job, outcome.reason);
    case "fail":
      await healthRecord(ctx.admin, tenant, provider, latency, "failure", wasRetry);
      return await failJob(ctx.admin, ctx.job, outcome.reason);
    case "dead":
      await sendToDlq(ctx.admin, {
        tenantId: tenant, integrationId: ctx.integration_id, provider,
        job: ctx.job as { id: string; kind: string; payload?: unknown; correlation_id?: string | null; retry_count?: number | null; last_error?: string | null },
        reason: outcome.reason, message: outcome.message,
      });
      await healthRecord(ctx.admin, tenant, provider, latency, "dead", wasRetry);
      return await failJob(ctx.admin, ctx.job, `DEAD: ${outcome.reason}`);
  }
}

export async function failJob(
  admin: AdminClient,
  job: any,
  reason: string,
): Promise<PipelineResponse> {
  await admin
    .from("integration_jobs")
    .update({ status: "FAILED", last_error: reason, completed_at: new Date().toISOString() })
    .eq("id", job.id);
  return { status: 200, body: { ok: false, failed: true, reason } };
}

export async function rescheduleJob(
  admin: AdminClient,
  job: any,
  reason: string,
): Promise<PipelineResponse> {
  const retry = (job.retry_count ?? 0) + 1;
  if (retry > (job.max_retries ?? 5)) {
    return await failJob(admin, job, `max_retries: ${reason}`);
  }
  const next = new Date(Date.now() + nextRetryDelayMs(retry)).toISOString();
  await admin.from("integration_jobs").update({
    status: "PENDING",
    retry_count: retry,
    next_retry_at: next,
    scheduled_at: next,
    last_error: reason,
  }).eq("id", job.id);
  return { status: 200, body: { ok: true, rescheduled: true, retry, next } };
}
