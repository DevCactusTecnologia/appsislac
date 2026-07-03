// Edge Function: integration-jobs-runner
// --------------------------------------
// Worker chamado por pg_cron. Pega N jobs PENDING/scheduled, chama
// integration-dispatch para cada um. Sem locks distribuídos: o lock é
// otimista no próprio dispatch (PENDING -> PROCESSING).

import { getAdminClient, logIntegration, safeEq } from "../_shared/integrationLog.ts";
import { withCronHealth } from "../_shared/cronHealth.ts";

import { corsHeaders } from "../_shared/cors.ts";
const BATCH = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const expected = Deno.env.get("CRON_SECRET");
  if (!expected) return json(503, { ok: false, error: "service unavailable" });
  if (!safeEq(req.headers.get("x-cron-secret") ?? "", expected)) {
    return json(401, { ok: false, error: "unauthorized" });
  }

  const admin = getAdminClient();

  return withCronHealth(admin, "integration-jobs-runner", async () => {
   try {
    const now = new Date().toISOString();

    // Preferência: claim atômico via RPC com SELECT FOR UPDATE SKIP LOCKED.
    // Fallback: select + lock otimista no dispatch (compat com deploys parciais).
    let jobs: Array<{ id: string; tenant_id: string; integration_id: string }> = [];
    const { data: claimed, error: claimErr } = await admin
      .rpc("claim_integration_jobs", { p_batch: BATCH });
    if (!claimErr && Array.isArray(claimed)) {
      jobs = (claimed as any[]).map((j) => ({
        id: j.id, tenant_id: j.tenant_id, integration_id: j.integration_id,
      }));
    } else {
      const { data, error } = await admin
        .from("integration_jobs")
        .select("id, tenant_id, integration_id")
        .eq("status", "PENDING")
        .lte("scheduled_at", now)
        .order("priority", { ascending: true })
        .order("scheduled_at", { ascending: true })
        .limit(BATCH);
      if (error) throw error;
      jobs = (data ?? []) as typeof jobs;
    }

    const baseUrl = Deno.env.get("SUPABASE_URL")!;
    const dispatchUrl = `${baseUrl}/functions/v1/integration-dispatch`;

    let ok = 0;
    let fail = 0;
    for (const j of jobs ?? []) {
      try {
        const r = await fetch(dispatchUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-cron-secret": expected,
          },
          body: JSON.stringify({ job_id: j.id }),
        });
        await r.text();
        if (r.ok) ok++;
        else fail++;
      } catch (e) {
        fail++;
        await logIntegration(admin, {
          tenant_id: j.tenant_id,
          integration_id: j.integration_id,
          job_id: j.id,
          level: "ERROR",
          message: "Falha ao chamar dispatch",
          context: { error: e instanceof Error ? e.message : String(e) },
        });
      }
    }

    const picked = jobs?.length ?? 0;
    return {
      response: json(200, { ok: true, picked, dispatched_ok: ok, dispatched_fail: fail }),
      result: { items_processed: picked, context: { dispatched_ok: ok, dispatched_fail: fail } },
    };
   } catch (e) {
     console.error("[integration-jobs-runner] fatal", e);
     return { response: json(500, { ok: false, error: "internal_error" }) };
   }
  });
});

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}