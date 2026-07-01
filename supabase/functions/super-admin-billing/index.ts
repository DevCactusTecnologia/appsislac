// Edge function super-admin-billing
// ----------------------------------------------------------------------------
// Gerencia o estado de assinatura (tenant_subscriptions_billing) de cada tenant.
// Ações:
//   list                                    → lista todas as assinaturas + planos
//   get { tenantId }                        → assinatura de 1 tenant + histórico
//   assignPlan { tenantId, planCode, billingCycle?, notes? }
//   cancel { tenantId, notes? }
//   reactivate { tenantId, notes? }
//   startTrial { tenantId, planCode, days }
//
// Caller DEVE ser super_admin.

import { createClient } from "../_shared/runtime/createClient.ts";
import {
  jsonResponse, errorResponse, preflight, newRequestId, createLogger,
} from "../_shared/hardening.ts";

interface Body {
  action?: unknown;
  tenantId?: unknown;
  planCode?: unknown;
  billingCycle?: unknown;
  notes?: unknown;
  days?: unknown;
}

const monthsForCycle = (cycle: string) => cycle === "yearly" ? 12 : (cycle === "monthly" ? 1 : 0);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const requestId = newRequestId(req);
  const log = createLogger("super-admin-billing", requestId);

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

  let body: Body = {};
  if (req.method === "POST") {
    try { body = await req.json() as Body; } catch { /* ignore */ }
  }
  const action = typeof body.action === "string" ? body.action : "list";

  if (action === "list") {
    const [{ data: billings, error: bErr }, { data: plans }] = await Promise.all([
      admin.from("tenant_subscriptions_billing").select("*"),
      admin.from("subscription_plans").select("*").order("sort_order"),
    ]);
    if (bErr) return errorResponse(500, "Falha ao listar billing", requestId, log, bErr);
    return jsonResponse(200, { billings: billings ?? [], plans: plans ?? [] }, requestId);
  }

  if (action === "get") {
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    if (!tenantId) return errorResponse(400, "tenantId obrigatório", requestId, log);
    const [{ data: billing }, { data: history }, { data: plans }] = await Promise.all([
      admin.from("tenant_subscriptions_billing").select("*").eq("tenant_id", tenantId).maybeSingle(),
      admin.from("subscription_changes_log").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(50),
      admin.from("subscription_plans").select("*").order("sort_order"),
    ]);
    return jsonResponse(200, { billing, history: history ?? [], plans: plans ?? [] }, requestId);
  }

  if (action === "assignPlan") {
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const planCode = typeof body.planCode === "string" ? body.planCode : "";
    const billingCycleIn = typeof body.billingCycle === "string" ? body.billingCycle : "";
    const notes = typeof body.notes === "string" ? body.notes : null;
    if (!tenantId || !planCode) return errorResponse(400, "tenantId e planCode obrigatórios", requestId, log);

    const { data: plan } = await admin.from("subscription_plans").select("*").eq("code", planCode).maybeSingle();
    if (!plan) return errorResponse(404, "Plano não encontrado", requestId, log);

    const billingCycle = billingCycleIn || (plan.preco_mensal_cents === 0 ? "free" : "monthly");
    const mrr = billingCycle === "yearly"
      ? Math.round((plan.preco_anual_cents ?? plan.preco_mensal_cents * 12) / 12)
      : billingCycle === "monthly" ? plan.preco_mensal_cents : 0;
    const now = new Date();
    const months = monthsForCycle(billingCycle);
    const periodEnd = months > 0
      ? new Date(now.getFullYear(), now.getMonth() + months, now.getDate()).toISOString()
      : null;

    const { data: prev } = await admin.from("tenant_subscriptions_billing").select("*").eq("tenant_id", tenantId).maybeSingle();

    const { data: updated, error } = await admin
      .from("tenant_subscriptions_billing")
      .upsert({
        tenant_id: tenantId,
        plan_code: planCode,
        status: "active",
        billing_cycle: billingCycle,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd,
        mrr_cents: mrr,
        canceled_at: null,
        notes,
      }, { onConflict: "tenant_id" })
      .select()
      .single();
    if (error) return errorResponse(400, error.message, requestId, log, error);

    await admin.from("subscription_changes_log").insert({
      tenant_id: tenantId,
      from_plan_code: prev?.plan_code ?? null,
      to_plan_code: planCode,
      from_status: prev?.status ?? null,
      to_status: "active",
      action: prev ? "change_plan" : "assign_plan",
      changed_by: caller.id,
      notes,
    });
    return jsonResponse(200, { billing: updated }, requestId);
  }

  if (action === "cancel") {
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const notes = typeof body.notes === "string" ? body.notes : null;
    if (!tenantId) return errorResponse(400, "tenantId obrigatório", requestId, log);
    const { data: prev } = await admin.from("tenant_subscriptions_billing").select("*").eq("tenant_id", tenantId).maybeSingle();
    const { data: updated, error } = await admin
      .from("tenant_subscriptions_billing")
      .update({ status: "canceled", canceled_at: new Date().toISOString(), mrr_cents: 0, notes })
      .eq("tenant_id", tenantId)
      .select()
      .single();
    if (error) return errorResponse(400, error.message, requestId, log, error);
    await admin.from("subscription_changes_log").insert({
      tenant_id: tenantId,
      from_plan_code: prev?.plan_code ?? null,
      to_plan_code: prev?.plan_code ?? null,
      from_status: prev?.status ?? null,
      to_status: "canceled",
      action: "cancel",
      changed_by: caller.id,
      notes,
    });
    return jsonResponse(200, { billing: updated }, requestId);
  }

  if (action === "reactivate") {
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    if (!tenantId) return errorResponse(400, "tenantId obrigatório", requestId, log);
    const { data: prev } = await admin.from("tenant_subscriptions_billing").select("*").eq("tenant_id", tenantId).maybeSingle();
    const { data: updated, error } = await admin
      .from("tenant_subscriptions_billing")
      .update({ status: "active", canceled_at: null })
      .eq("tenant_id", tenantId)
      .select()
      .single();
    if (error) return errorResponse(400, error.message, requestId, log, error);
    await admin.from("subscription_changes_log").insert({
      tenant_id: tenantId,
      from_plan_code: prev?.plan_code ?? null,
      to_plan_code: prev?.plan_code ?? null,
      from_status: prev?.status ?? null,
      to_status: "active",
      action: "reactivate",
      changed_by: caller.id,
    });
    return jsonResponse(200, { billing: updated }, requestId);
  }

  if (action === "startTrial") {
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const planCode = typeof body.planCode === "string" ? body.planCode : "";
    const days = Math.max(1, Math.min(90, Number(body.days) || 14));
    if (!tenantId || !planCode) return errorResponse(400, "tenantId e planCode obrigatórios", requestId, log);
    const trialEnds = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const { data: prev } = await admin.from("tenant_subscriptions_billing").select("*").eq("tenant_id", tenantId).maybeSingle();
    const { data: updated, error } = await admin
      .from("tenant_subscriptions_billing")
      .upsert({
        tenant_id: tenantId,
        plan_code: planCode,
        status: "trial",
        billing_cycle: "monthly",
        trial_ends_at: trialEnds,
        mrr_cents: 0,
      }, { onConflict: "tenant_id" })
      .select()
      .single();
    if (error) return errorResponse(400, error.message, requestId, log, error);
    await admin.from("subscription_changes_log").insert({
      tenant_id: tenantId,
      from_plan_code: prev?.plan_code ?? null,
      to_plan_code: planCode,
      from_status: prev?.status ?? null,
      to_status: "trial",
      action: "start_trial",
      changed_by: caller.id,
      notes: `${days} dias`,
    });
    return jsonResponse(200, { billing: updated }, requestId);
  }

  return errorResponse(400, "Ação inválida", requestId, log);
});