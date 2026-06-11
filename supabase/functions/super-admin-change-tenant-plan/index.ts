// Edge function: super-admin-change-tenant-plan
// Troca o plano vigente (upgrade/downgrade) de um tenant.
// Atualiza tenant_subscriptions_billing e registra mudança em subscription_changes_log.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { jsonResponse, errorResponse, preflight, newRequestId, createLogger } from "../_shared/hardening.ts";

interface Body {
  tenantId?: unknown;
  planCode?: unknown;
  billingCycle?: unknown; // "monthly" | "annual" | "free"
  motivo?: unknown;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const requestId = newRequestId(req);
  const log = createLogger("super-admin-change-tenant-plan", requestId);
  if (req.method !== "POST") return errorResponse(405, "Method not allowed", requestId, log);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) return errorResponse(500, "Server misconfiguration", requestId, log);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user: caller }, error: cErr } = await userClient.auth.getUser();
  if (cErr || !caller) return errorResponse(401, "Não autenticado", requestId, log);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: isSuper } = await admin.rpc("is_super_admin", { _user_id: caller.id });
  if (!isSuper) return errorResponse(403, "Apenas super admins", requestId, log);

  let body: Body;
  try { body = await req.json() as Body; } catch {
    return errorResponse(400, "JSON inválido", requestId, log);
  }
  const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
  const planCode = typeof body.planCode === "string" ? body.planCode : "";
  const cycle = typeof body.billingCycle === "string" ? body.billingCycle : "monthly";
  const motivo = typeof body.motivo === "string" ? body.motivo : null;
  if (!tenantId || !planCode) return errorResponse(400, "tenantId e planCode obrigatórios", requestId, log);
  if (!["monthly", "annual", "free"].includes(cycle)) return errorResponse(400, "billingCycle inválido", requestId, log);

  const { data: plan, error: pErr } = await admin
    .from("subscription_plans")
    .select("*")
    .eq("code", planCode)
    .maybeSingle();
  if (pErr || !plan) return errorResponse(404, "Plano não encontrado", requestId, log);
  if (!plan.is_active) return errorResponse(400, "Plano inativo", requestId, log);

  const { data: existing } = await admin
    .from("tenant_subscriptions_billing")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const mrr = cycle === "annual"
    ? Math.round((plan.preco_anual_cents ?? plan.preco_mensal_cents * 12) / 12)
    : (cycle === "free" ? 0 : plan.preco_mensal_cents);

  const now = new Date();
  const periodEnd = new Date(now);
  if (cycle === "annual") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  else if (cycle === "monthly") periodEnd.setMonth(periodEnd.getMonth() + 1);

  const payload = {
    tenant_id: tenantId,
    plan_code: planCode,
    status: "active",
    billing_cycle: cycle,
    mrr_cents: mrr,
    current_period_start: now.toISOString(),
    current_period_end: cycle === "free" ? null : periodEnd.toISOString(),
    canceled_at: null,
    updated_at: now.toISOString(),
  };

  const op = existing
    ? admin.from("tenant_subscriptions_billing").update(payload).eq("tenant_id", tenantId)
    : admin.from("tenant_subscriptions_billing").insert(payload);
  const { error: upErr } = await op;
  if (upErr) return errorResponse(500, "Falha ao atualizar plano: " + upErr.message, requestId, log, upErr);

  // Best-effort log
  try {
    await admin.from("subscription_changes_log").insert({
      tenant_id: tenantId,
      from_plan_code: existing?.plan_code ?? null,
      to_plan_code: planCode,
      from_status: existing?.status ?? null,
      to_status: "active",
      action: existing ? "change_plan" : "create_subscription",
      changed_by: caller.id,
      notes: motivo,
    });
  } catch (e) {
    log.warn("subscription_changes_log skip", { err: e instanceof Error ? e.message : String(e) });
  }

  log.info("plano alterado", { tenantId, from: existing?.plan_code, to: planCode, cycle });
  return jsonResponse(200, { ok: true }, requestId);
});
