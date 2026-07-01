// Edge function: super-admin-tenant-snapshot
// Retorna métricas reais de um tenant + dados do admin + billing.
import { createClient } from "../_shared/runtime/createClient.ts";
import { jsonResponse, errorResponse, preflight, newRequestId, createLogger } from "../_shared/hardening.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const requestId = newRequestId(req);
  const log = createLogger("super-admin-tenant-snapshot", requestId);

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

  const url = new URL(req.url);
  const tenantId = url.searchParams.get("tenantId") ?? "";
  if (!tenantId) return errorResponse(400, "tenantId obrigatório", requestId, log);

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  const [usersRes, usersTotalRes, atendRes, atendTotalRes, payRes, pacRes, adminRes, unidadesRes, examesRes, profilesByRoleRes, billingRes, planLookupRes, registryRes] = await Promise.all([
    admin.from("profiles").select("user_id", { count: "exact", head: true }).eq("tenant_id", tenantId).neq("status", "Inativo"),
    admin.from("profiles").select("user_id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    admin.from("atendimentos").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("created_at", start).lt("created_at", end),
    admin.from("atendimentos").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    admin.from("atendimento_pagamentos").select("valor,tipo").eq("tenant_id", tenantId).gte("data", start.slice(0,10)).lt("data", end.slice(0,10)),
    admin.from("pacientes").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    admin.from("profiles").select("user_id,email,nome,perfil,status,telefone,created_at").eq("tenant_id", tenantId).eq("perfil", "admin").order("created_at", { ascending: true }).limit(1).maybeSingle(),
    admin.from("unidades").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    admin.from("exames_catalogo").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    admin.from("profiles").select("perfil").eq("tenant_id", tenantId),
    admin.from("tenant_subscriptions_billing").select("*").eq("tenant_id", tenantId).maybeSingle(),
    admin.from("subscription_plans").select("*"),
    admin.from("tenant_registry").select("runtime_mode, database_strategy, db_provider, db_region, db_host, db_port, db_name, db_user, db_secret_ref, db_project_url, db_anon_key_secret_ref, schema_provisioned_at, schema_version, last_health_check, last_health_result, runtime_dedicated_enabled").eq("tenant_id", tenantId).maybeSingle(),
  ]);

  let receita = 0;
  for (const r of (payRes.data ?? []) as Array<{ valor: number | string; tipo: string }>) {
    const v = typeof r.valor === "string" ? Number(r.valor) : (r.valor ?? 0);
    if (!r.tipo || r.tipo === "entrada" || r.tipo === "pagamento") receita += v;
  }

  // Distribuição por perfil
  const porPerfil: Record<string, number> = {};
  for (const p of (profilesByRoleRes.data ?? []) as Array<{ perfil: string }>) {
    porPerfil[p.perfil] = (porPerfil[p.perfil] ?? 0) + 1;
  }

  // Last sign-in do admin (via auth.admin.getUserById)
  let adminLastSignIn: string | null = null;
  let adminCreatedInAuth: string | null = null;
  if (adminRes.data?.user_id) {
    try {
      const { data: au } = await admin.auth.admin.getUserById(adminRes.data.user_id);
      adminLastSignIn = au?.user?.last_sign_in_at ?? null;
      adminCreatedInAuth = au?.user?.created_at ?? null;
    } catch (e) { log.warn("getUserById falhou", { err: e instanceof Error ? e.message : String(e) }); }
  }

  // Plano vigente
  let billing: Record<string, unknown> | null = null;
  if (billingRes.data) {
    const plan = ((planLookupRes.data ?? []) as Array<Record<string, unknown>>).find(p => p.code === billingRes.data!.plan_code) ?? null;
    billing = { ...billingRes.data, plan };
  }

  return jsonResponse(200, {
    ok: true,
    usuarios_ativos: usersRes.count ?? 0,
    usuarios_total: usersTotalRes.count ?? 0,
    usuarios_por_perfil: porPerfil,
    atendimentos_mes: atendRes.count ?? 0,
    atendimentos_total: atendTotalRes.count ?? 0,
    pacientes_total: pacRes.count ?? 0,
    unidades_total: unidadesRes.count ?? 0,
    exames_total: examesRes.count ?? 0,
    receita_mes_cents: Math.round(receita * 100),
    admin_user: adminRes.data
      ? { ...adminRes.data, last_sign_in_at: adminLastSignIn, auth_created_at: adminCreatedInAuth }
      : null,
    billing,
    registry: registryRes.data ?? null,
  }, requestId);
});
