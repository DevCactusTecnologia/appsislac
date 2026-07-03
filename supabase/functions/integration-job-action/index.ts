// Edge: integration-job-action
// Ações manuais sobre integration_jobs:
//   - retry: reseta status para PENDING e dispara dispatch
//   - cancel: marca CANCELLED
//   - enqueue: cria novo job (kind/payload) — útil para FETCH_PDF/PENDING/TRACE

import { createClient } from "../_shared/runtime/createClient.ts";

import { corsHeaders } from "../_shared/cors.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("authorization") ?? "";
    if (!auth.toLowerCase().startsWith("bearer ")) return j(401, { error: "unauthorized" });
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return j(401, { error: "unauthorized" });

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (action === "retry" || action === "cancel") {
      const job_id = String(body?.job_id ?? "");
      if (!job_id) return j(400, { error: "job_id obrigatório" });
      // RLS check via user client
      const { data: jb, error: jbErr } = await userClient
        .from("integration_jobs").select("id, tenant_id, integration_id").eq("id", job_id).maybeSingle();
      if (jbErr || !jb) return j(403, { error: "forbidden" });

      if (action === "cancel") {
        const { error } = await admin.from("integration_jobs")
          .update({ status: "CANCELLED", completed_at: new Date().toISOString() })
          .eq("id", job_id);
        if (error) return j(500, { error: "Erro ao cancelar job" });
        return j(200, { ok: true, action });
      }
      // retry
      const { error } = await admin.from("integration_jobs").update({
        status: "PENDING", retry_count: 0, last_error: null,
        next_retry_at: null, scheduled_at: new Date().toISOString(),
        started_at: null, completed_at: null,
      }).eq("id", job_id);
      if (error) return j(500, { error: "Erro ao reiniciar job" });
      // dispara dispatch
      const dispatchUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/integration-dispatch`;
      const r = await fetch(dispatchUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": auth,
        },
        body: JSON.stringify({ job_id }),
      });
      const txt = await r.text();
      return j(200, { ok: true, action, dispatch_status: r.status, dispatch_body: safeJson(txt) });
    }

    if (action === "enqueue") {
      const integration_id = String(body?.integration_id ?? "");
      const kind = String(body?.kind ?? "");
      const payload = body?.payload ?? {};
      if (!integration_id || !kind) return j(400, { error: "integration_id e kind obrigatórios" });
      const { data: intg, error: intgErr } = await userClient
        .from("integrations").select("id, tenant_id").eq("id", integration_id).maybeSingle();
      if (intgErr || !intg) return j(403, { error: "forbidden" });
      const { data: ins, error } = await admin.from("integration_jobs").insert({
        tenant_id: intg.tenant_id, integration_id, kind, payload,
        status: "PENDING", scheduled_at: new Date().toISOString(),
      }).select("id").single();
      if (error) return j(500, { error: "Erro ao enfileirar job" });
      const dispatchUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/integration-dispatch`;
      const r = await fetch(dispatchUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": auth },
        body: JSON.stringify({ job_id: ins.id }),
      });
      const txt = await r.text();
      return j(200, { ok: true, action, job_id: ins.id, dispatch_status: r.status, dispatch_body: safeJson(txt) });
    }

    return j(400, { error: "action inválida (retry|cancel|enqueue)" });
  } catch (e) {
    console.error("[integration-job-action] fatal", e);
    return j(500, { error: "internal_error" });
  }
});

function safeJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return s; }
}
function j(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}