// Edge function: provider-health-aggregator (cron, 1 min)
// -------------------------------------------------------
// 1) Para cada (tenant_id, provider) com bucket nos últimos 5 min:
//    - calcula success_rate, failure_rate, p_avg, deriva health_status.
// 2) Self-healing: se HEALTHY há >=5 buckets e circuito ainda OPEN,
//    força next_probe_at = now() para liberar HALF_OPEN imediatamente.
// Auth: cron secret obrigatório.

import { createClient } from "../_shared/runtime/createClient.ts";
import { safeEq } from "../_shared/integrationLog.ts";
import { withCronHealth } from "../_shared/cronHealth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Bucket = {
  tenant_id: string;
  provider: string;
  window_start: string;
  total_latency_ms: number;
  success_count: number;
  failure_count: number;
  timeout_count: number;
  transport_error_count: number;
  retry_count: number;
  dead_count: number;
  health_status: string;
};

function deriveStatus(rows: Bucket[]): "HEALTHY" | "DEGRADED" | "UNSTABLE" | "DOWN" {
  const total = rows.reduce((a, r) => a + r.success_count + r.failure_count + r.timeout_count + r.transport_error_count, 0);
  const failures = rows.reduce((a, r) => a + r.failure_count + r.timeout_count + r.transport_error_count + r.dead_count, 0);
  const success = rows.reduce((a, r) => a + r.success_count, 0);
  const retries = rows.reduce((a, r) => a + r.retry_count, 0);
  const totalLat = rows.reduce((a, r) => a + r.total_latency_ms, 0);
  const avgLat = total > 0 ? totalLat / total : 0;
  if (total === 0) return "HEALTHY";
  if (success === 0 && total >= 5) return "DOWN";
  const fr = failures / total;
  const rr = total > 0 ? retries / total : 0;
  if (fr >= 0.5 || avgLat > 15000) return "UNSTABLE";
  if (fr >= 0.2 || rr >= 0.3 || avgLat > 8000) return "DEGRADED";
  return "HEALTHY";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  const provided = req.headers.get("x-cron-secret") ?? "";
  if (!cronSecret || !safeEq(provided, cronSecret)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  return withCronHealth(admin, "provider-health-aggregator", async () => {
  // Carrega últimos 5 min de buckets agrupados.
  const since = new Date(Date.now() - 5 * 60_000).toISOString();
  const { data: rows } = await admin
    .from("provider_health_metrics")
    .select("tenant_id, provider, window_start, total_latency_ms, success_count, failure_count, timeout_count, transport_error_count, retry_count, dead_count, health_status")
    .gte("window_start", since);

  if (!rows || rows.length === 0) {
    return {
      response: new Response(JSON.stringify({ ok: true, processed: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } }),
      result: { items_processed: 0 },
    };
  }

  // Agrupa por (tenant, provider)
  const groups = new Map<string, Bucket[]>();
  for (const r of rows as Bucket[]) {
    const k = `${r.tenant_id}::${r.provider}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }

  let processed = 0;
  for (const [, list] of groups) {
    const status = deriveStatus(list);
    const sample = list[0];
    // Atualiza health_status no bucket mais recente
    list.sort((a, b) => b.window_start.localeCompare(a.window_start));
    await admin.from("provider_health_metrics")
      .update({ health_status: status })
      .eq("tenant_id", sample.tenant_id)
      .eq("provider", sample.provider)
      .eq("window_start", list[0].window_start);

    // Self-healing: HEALTHY nos últimos 5 buckets e circuito OPEN → libera probe imediato.
    if (status === "HEALTHY" && list.length >= 5 && list.every((b) => b.success_count > 0 && b.failure_count + b.timeout_count + b.transport_error_count === 0)) {
      const { data: cs } = await admin
        .from("provider_circuit_state")
        .select("id, state")
        .eq("tenant_id", sample.tenant_id)
        .eq("provider", sample.provider)
        .maybeSingle();
      if (cs?.state === "OPEN") {
        await admin.from("provider_circuit_state")
          .update({ next_probe_at: new Date().toISOString() })
          .eq("id", cs.id);
      }
    }
    processed++;
  }

  return {
    response: new Response(JSON.stringify({ ok: true, processed }), { headers: { ...corsHeaders, "Content-Type": "application/json" } }),
    result: { items_processed: processed, context: { groups: groups.size } },
  };
  });
});