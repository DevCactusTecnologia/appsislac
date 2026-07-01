// Edge function super-admin-list-tenants
// Retorna a lista de todos os tenants com métricas básicas.

import { createClient } from "../_shared/runtime/createClient.ts";
import { jsonResponse, errorResponse, preflight, newRequestId, createLogger } from "../_shared/hardening.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const requestId = newRequestId(req);
  const log = createLogger("super-admin-list-tenants", requestId);

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

  const { data: tenantsRaw, error } = await admin
    .from("tenants")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return errorResponse(500, "Erro ao listar tenants", requestId, log, error);

  // Oculta o tenant de plataforma (container do Super Admin) da listagem
  // de laboratórios operacionais. Ele não é um laboratório real.
  const PLATFORM_TENANT_ID = "00000000-0000-0000-0000-000000000000";
  const tenants = (tenantsRaw ?? []).filter(
    (t) => t.id !== PLATFORM_TENANT_ID && t.slug !== "plataforma" && t.lab_code !== "0000",
  );

  // Onda A — enriquece com runtime do control-plane (tenant_registry).
  // Inclui runtime_mode (shared_db|isolated_db), database_strategy,
  // runtime_status e provisioning_status para o frontend exibir badges
  // sem precisar de uma segunda query.
  const ids = (tenants ?? []).map((t) => t.id as string);
  let registryMap = new Map<string, Record<string, unknown>>();
  let billingMap = new Map<string, Record<string, unknown>>();
  let planMap = new Map<string, { nome: string; preco_mensal_cents: number }>();
  let adminMap = new Map<string, { nome: string; email: string; telefone: string | null }>();
  let countsMap = new Map<string, { usuarios: number; atendimentos: number; pacientes: number }>();

  if (ids.length > 0) {
    const [{ data: regs }, { data: bills }, { data: plans }, { data: adminProfiles }] = await Promise.all([
      admin
        .from("tenant_registry")
        .select("tenant_id, lab_code, runtime_mode, database_strategy, runtime_status, provisioning_status, db_provider, db_region, schema_version")
        .in("tenant_id", ids),
      admin
        .from("tenant_subscriptions_billing")
        .select("tenant_id, plan_code, status, billing_cycle, mrr_cents, current_period_end, trial_ends_at")
        .in("tenant_id", ids),
      admin.from("subscription_plans").select("code, nome, preco_mensal_cents"),
      admin
        .from("profiles")
        .select("tenant_id, nome, email, telefone, created_at")
        .in("tenant_id", ids)
        .eq("perfil", "admin")
        .order("created_at", { ascending: true }),
    ]);

    registryMap = new Map((regs ?? []).map((r) => [r.tenant_id as string, r as Record<string, unknown>]));
    billingMap = new Map((bills ?? []).map((b) => [b.tenant_id as string, b as Record<string, unknown>]));
    planMap = new Map(((plans ?? []) as Array<{ code: string; nome: string; preco_mensal_cents: number }>).map(p => [p.code, { nome: p.nome, preco_mensal_cents: p.preco_mensal_cents }]));

    for (const p of adminProfiles ?? []) {
      const tid = p.tenant_id as string;
      if (tid && !adminMap.has(tid)) {
        adminMap.set(tid, {
          nome: (p.nome as string) ?? "",
          email: (p.email as string) ?? "",
          telefone: (p.telefone as string) ?? null,
        });
      }
    }

    const [usersCounts, atendCounts, pacCounts] = await Promise.all([
      Promise.all(ids.map((tid) => admin.from("profiles").select("id", { count: "exact", head: true }).eq("tenant_id", tid).neq("status", "Inativo"))),
      Promise.all(ids.map((tid) => admin.from("atendimentos").select("id", { count: "exact", head: true }).eq("tenant_id", tid))),
      Promise.all(ids.map((tid) => admin.from("pacientes").select("id", { count: "exact", head: true }).eq("tenant_id", tid))),
    ]);
    ids.forEach((tid, i) => {
      countsMap.set(tid, {
        usuarios: usersCounts[i].count ?? 0,
        atendimentos: atendCounts[i].count ?? 0,
        pacientes: pacCounts[i].count ?? 0,
      });
    });
  }

  const enriched = (tenants ?? []).map((t) => {
    const r = registryMap.get(t.id as string) ?? {};
    const b = billingMap.get(t.id as string) ?? {};
    const ad = adminMap.get(t.id as string) ?? null;
    const counts = countsMap.get(t.id as string) ?? { usuarios: 0, atendimentos: 0, pacientes: 0 };
    const planCode = (b.plan_code as string) ?? null;
    const plan = planCode ? planMap.get(planCode) : null;
    return {
      ...t,
      metrics: counts,
      lab_code: t.lab_code ?? null,
      lab_code_registry: r.lab_code ?? null,
      runtime_mode: r.runtime_mode ?? "shared_db",
      database_strategy: r.database_strategy ?? "shared",
      runtime_status: r.runtime_status ?? "active",
      provisioning_status: r.provisioning_status ?? "active",
      db_provider: r.db_provider ?? null,
      db_region: r.db_region ?? null,
      schema_version: r.schema_version ?? "v0",
      cidade: (t as any).cidade ?? null,
      estado: (t as any).estado ?? null,
      admin: ad,
      billing: {
        plan_code: planCode,
        plan_name: plan?.nome ?? null,
        status: (b.status as string) ?? null,
        billing_cycle: (b.billing_cycle as string) ?? null,
        mrr_cents: (b.mrr_cents as number) ?? 0,
        current_period_end: (b.current_period_end as string) ?? null,
        trial_ends_at: (b.trial_ends_at as string) ?? null,
      },
    };
  });

  return jsonResponse(200, { tenants: enriched }, requestId);
});
