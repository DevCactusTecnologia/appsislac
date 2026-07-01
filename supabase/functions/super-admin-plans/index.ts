// Edge function super-admin-plans
// ----------------------------------------------------------------------------
// CRUD do catálogo de planos de assinatura (subscription_plans).
// Ações: list | upsert | delete | setDefault | toggleActive
// Caller DEVE ser super_admin.

import { createClient } from "../_shared/runtime/createClient.ts";
import {
  jsonResponse, errorResponse, preflight, newRequestId, createLogger,
} from "../_shared/hardening.ts";

interface Body {
  action?: unknown;
  plan?: Record<string, unknown>;
  code?: unknown;
  value?: unknown;
}

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const requestId = newRequestId(req);
  const log = createLogger("super-admin-plans", requestId);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    return errorResponse(500, "Server misconfiguration", requestId, log);
  }

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
    const { data, error } = await admin
      .from("subscription_plans")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("preco_mensal_cents", { ascending: true });
    if (error) return errorResponse(500, "Falha ao listar planos", requestId, log, error);
    return jsonResponse(200, { plans: data ?? [] }, requestId);
  }

  if (action === "upsert") {
    const p = body.plan ?? {};
    const nome = typeof p.nome === "string" ? p.nome.trim() : "";
    if (!nome) return errorResponse(400, "Nome obrigatório", requestId, log);
    const code = (typeof p.code === "string" && p.code.trim())
      ? slugify(p.code as string) : slugify(nome);
    if (!code) return errorResponse(400, "Código inválido", requestId, log);
    const payload = {
      code,
      nome,
      descricao: typeof p.descricao === "string" ? p.descricao : null,
      preco_mensal_cents: Number.isFinite(Number(p.preco_mensal_cents)) ? Number(p.preco_mensal_cents) : 0,
      preco_anual_cents: p.preco_anual_cents == null ? null : Number(p.preco_anual_cents),
      moeda: typeof p.moeda === "string" ? p.moeda : "BRL",
      limite_atendimentos_mes: p.limite_atendimentos_mes == null ? null : Number(p.limite_atendimentos_mes),
      limite_usuarios: p.limite_usuarios == null ? null : Number(p.limite_usuarios),
      limite_unidades: p.limite_unidades == null ? null : Number(p.limite_unidades),
      features: Array.isArray(p.features) ? p.features : [],
      is_active: p.is_active !== false,
      is_public: p.is_public !== false,
      is_default: p.is_default === true,
      sort_order: Number.isFinite(Number(p.sort_order)) ? Number(p.sort_order) : 0,
    };
    // Se for default, limpa o flag dos outros antes (índice único garante)
    if (payload.is_default) {
      await admin.from("subscription_plans").update({ is_default: false }).neq("code", code);
    }
    const { data, error } = await admin
      .from("subscription_plans")
      .upsert(payload, { onConflict: "code" })
      .select()
      .single();
    if (error) return errorResponse(400, error.message, requestId, log, error);
    return jsonResponse(200, { plan: data }, requestId);
  }

  if (action === "delete") {
    const code = typeof body.code === "string" ? body.code : "";
    if (!code) return errorResponse(400, "code obrigatório", requestId, log);
    // Bloqueia delete se há tenants usando o plano
    const { count } = await admin
      .from("tenant_subscriptions_billing")
      .select("tenant_id", { count: "exact", head: true })
      .eq("plan_code", code);
    if ((count ?? 0) > 0) {
      return errorResponse(409, `Plano em uso por ${count} laboratório(s). Migre-os antes de excluir.`, requestId, log);
    }
    const { error } = await admin.from("subscription_plans").delete().eq("code", code);
    if (error) return errorResponse(400, error.message, requestId, log, error);
    return jsonResponse(200, { ok: true }, requestId);
  }

  if (action === "setDefault") {
    const code = typeof body.code === "string" ? body.code : "";
    if (!code) return errorResponse(400, "code obrigatório", requestId, log);
    await admin.from("subscription_plans").update({ is_default: false }).neq("code", code);
    const { error } = await admin.from("subscription_plans").update({ is_default: true }).eq("code", code);
    if (error) return errorResponse(400, error.message, requestId, log, error);
    return jsonResponse(200, { ok: true }, requestId);
  }

  if (action === "toggleActive") {
    const code = typeof body.code === "string" ? body.code : "";
    const value = body.value === true;
    if (!code) return errorResponse(400, "code obrigatório", requestId, log);
    const { error } = await admin.from("subscription_plans").update({ is_active: value }).eq("code", code);
    if (error) return errorResponse(400, error.message, requestId, log, error);
    return jsonResponse(200, { ok: true }, requestId);
  }

  return errorResponse(400, "Ação inválida", requestId, log);
});