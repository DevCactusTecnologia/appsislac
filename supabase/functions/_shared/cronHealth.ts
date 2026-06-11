// Telemetria de cron jobs — wrapper único usado pelas 4 edge functions
// agendadas por pg_cron (lab-apoio-cron-fetch, integration-poll-results,
// integration-jobs-runner, provider-health-aggregator).
//
// Cada execução registra start/duração/status/itens em `public.cron_health`
// via RPC `cron_health_record` (SECURITY DEFINER, executável só por
// service_role). Falhas no registro NUNCA quebram o hot-path do cron.

import type { AdminClient } from "./integrationLog.ts";

export interface CronRunResult {
  items_processed?: number;
  context?: Record<string, unknown>;
}

/**
 * Executa `fn` medindo tempo e registrando em cron_health.
 * Retorna a Response produzida por `fn`. Re-lança em caso de erro
 * (após registrar o erro), mantendo o comportamento atual do handler.
 */
export async function withCronHealth(
  admin: AdminClient,
  jobName: string,
  fn: () => Promise<{ response: Response; result?: CronRunResult }>,
): Promise<Response> {
  const startedAt = new Date();
  const t0 = performance.now();
  try {
    const { response, result } = await fn();
    const dur = Math.round(performance.now() - t0);
    const ok = response.status >= 200 && response.status < 300;
    void record(admin, {
      job_name: jobName,
      started_at: startedAt.toISOString(),
      duration_ms: dur,
      status: ok ? "ok" : "error",
      items_processed: result?.items_processed ?? 0,
      error_message: ok ? null : `http_${response.status}`,
      context: result?.context ?? null,
    });
    return response;
  } catch (e) {
    const dur = Math.round(performance.now() - t0);
    const msg = e instanceof Error ? e.message : String(e);
    void record(admin, {
      job_name: jobName,
      started_at: startedAt.toISOString(),
      duration_ms: dur,
      status: "error",
      items_processed: 0,
      error_message: msg.slice(0, 500),
      context: null,
    });
    throw e;
  }
}

async function record(
  admin: AdminClient,
  row: {
    job_name: string;
    started_at: string;
    duration_ms: number;
    status: "ok" | "error";
    items_processed: number;
    error_message: string | null;
    context: Record<string, unknown> | null;
  },
): Promise<void> {
  try {
    await admin.rpc("cron_health_record", {
      p_job_name: row.job_name,
      p_started_at: row.started_at,
      p_duration_ms: row.duration_ms,
      p_status: row.status,
      p_items_processed: row.items_processed,
      p_error_message: row.error_message,
      p_context: row.context,
    });
  } catch (e) {
    console.warn(`[cron-health] failed to record ${row.job_name}:`, e);
  }
}