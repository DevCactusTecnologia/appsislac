// Edge function super-admin-metrics
// Métricas globais do SaaS: total de tenants, usuários, atendimentos.
// MRR/ARR e distribuição por plano vêm de tenant_subscriptions_billing
// + subscription_plans (catálogo real).

import { createClient } from "../_shared/runtime/createClient.ts";
import { jsonResponse, errorResponse, preflight, newRequestId, createLogger } from "../_shared/hardening.ts";
import { resolveTenantConnection } from "../_shared/tenantConnection.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const requestId = newRequestId(req);
  const log = createLogger("super-admin-metrics", requestId);

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

  // Tenant da plataforma (container do Super Admin) NÃO é laboratório operacional.
  const PLATFORM_TENANT_ID = "00000000-0000-0000-0000-000000000000";

  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const startCurrentMonth = startMonth;
  const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [tenantsRes, profilesRes, atendsRes, pacRes, atendsMonthRes, atendsPrevMonthRes, tenantsMonthRes, tenantsPrevMonthRes] = await Promise.all([
    admin.from("tenants").select("status, plano, created_at").neq("id", PLATFORM_TENANT_ID),
    admin.from("profiles").select("id", { count: "exact", head: true }).neq("tenant_id", PLATFORM_TENANT_ID),
    admin.from("atendimentos").select("id", { count: "exact", head: true }).neq("tenant_id", PLATFORM_TENANT_ID),
    admin.from("pacientes").select("id", { count: "exact", head: true }).neq("tenant_id", PLATFORM_TENANT_ID),
    admin.from("atendimentos").select("id", { count: "exact", head: true }).neq("tenant_id", PLATFORM_TENANT_ID).gte("created_at", startCurrentMonth),
    admin.from("atendimentos").select("id", { count: "exact", head: true }).neq("tenant_id", PLATFORM_TENANT_ID).gte("created_at", startPrevMonth).lt("created_at", startCurrentMonth),
    admin.from("tenants").select("id", { count: "exact", head: true }).neq("id", PLATFORM_TENANT_ID).gte("created_at", startCurrentMonth),
    admin.from("tenants").select("id", { count: "exact", head: true }).neq("id", PLATFORM_TENANT_ID).gte("created_at", startPrevMonth).lt("created_at", startCurrentMonth),
  ]);


  const tenantsList = (tenantsRes.data ?? []) as { status: string; plano: string; created_at: string }[];
  const tenantsAtivos = tenantsList.filter(t => t.status === "ativo").length;
  const tenantsSuspensos = tenantsList.filter(t => t.status === "suspenso").length;

  // Billing real (MRR/ARR/distribuição) vem de tenant_subscriptions_billing.
  // Exclui o tenant da plataforma para não inflar contagens.
  const [{ data: billingRows }, { data: planRows }] = await Promise.all([
    admin.from("tenant_subscriptions_billing").select("plan_code, status, mrr_cents").neq("tenant_id", PLATFORM_TENANT_ID),
    admin.from("subscription_plans").select("code, nome"),
  ]);

  const billings = (billingRows ?? []) as Array<{ plan_code: string; status: string; mrr_cents: number }>;
  const planNameByCode = new Map<string, string>(
    ((planRows ?? []) as Array<{ code: string; nome: string }>).map(p => [p.code, p.nome]),
  );

  const tenantsTrial = billings.filter(b => b.status === "trial").length;

  // MRR em CENTAVOS no banco → converte para REAIS para o front (KPIs em BRL).
  const mrrCents = billings
    .filter(b => b.status === "active")
    .reduce((acc, b) => acc + (b.mrr_cents ?? 0), 0);
  const mrr = Math.round(mrrCents / 100);
  const arr = mrr * 12;
  const activeSubs = billings.filter(b => b.status === "active").length;
  const arpu = activeSubs > 0 ? mrr / activeSubs : 0;

  // Distribuição por plano: usa nome do catálogo quando disponível.
  const planosDist: Record<string, number> = {};
  for (const b of billings) {
    const label = planNameByCode.get(b.plan_code) ?? b.plan_code;
    planosDist[label] = (planosDist[label] ?? 0) + 1;
  }

  // Crescimento de tenants no mês vs anterior
  const novosMes = tenantsMonthRes.count ?? 0;
  const novosMesAnt = tenantsPrevMonthRes.count ?? 0;
  const crescimentoTenantsPct = novosMesAnt > 0
    ? ((novosMes - novosMesAnt) / novosMesAnt) * 100
    : (novosMes > 0 ? 100 : 0);

  // Crescimento de atendimentos no mês
  const atendsMes = atendsMonthRes.count ?? 0;
  const atendsPrev = atendsPrevMonthRes.count ?? 0;
  const crescimentoAtendsPct = atendsPrev > 0
    ? ((atendsMes - atendsPrev) / atendsPrev) * 100
    : (atendsMes > 0 ? 100 : 0);

  // Churn aproximado: suspensos / total
  const total = tenantsList.length;
  const churnPct = total > 0 ? (tenantsSuspensos / total) * 100 : 0;

  // ── Onda D: Control-Plane widgets — runtime + provisioning health ──
  // Exclui registry do tenant da plataforma para não inflar a infraestrutura.
  const { data: registryRows } = await admin
    .from("tenant_registry")
    .select("runtime_mode, provisioning_status, runtime_status")
    .neq("tenant_id", PLATFORM_TENANT_ID);

  const registry = (registryRows ?? []) as {
    runtime_mode: string | null;
    provisioning_status: string | null;
    runtime_status: string | null;
  }[];
  const runtimeDist = { shared_db: 0, isolated_db: 0 };
  const provisioningDist: Record<string, number> = {};
  const runtimeStatusDist: Record<string, number> = {};
  for (const r of registry) {
    const mode = r.runtime_mode === "isolated_db" ? "isolated_db" : "shared_db";
    runtimeDist[mode] += 1;
    const ps = r.provisioning_status ?? "unknown";
    provisioningDist[ps] = (provisioningDist[ps] ?? 0) + 1;
    const rs = r.runtime_status ?? "unknown";
    runtimeStatusDist[rs] = (runtimeStatusDist[rs] ?? 0) + 1;
  }
  const controlPlane = {
    registryTotal: registry.length,
    runtimeDist,
    provisioningDist,
    runtimeStatusDist,
    pendingProvision:
      (provisioningDist.pending ?? 0) +
      (provisioningDist.provisioning ?? 0) +
      (provisioningDist.validating ?? 0),
    failedProvision: provisioningDist.failed ?? 0,
    suspendedRuntime: runtimeStatusDist.suspended ?? 0,
  };

  // ── Onda E: Federated fan-out + health summary ──
  // Itera tenants ativos via `resolveTenantConnection`. Hoje todos são
  // shared_db (mesmo client). Isolated_db ainda lança em dry-run — é
  // contabilizado como erro federado e não bloqueia o agregado.
  const { data: regFull } = await admin
    .from("tenant_registry")
    .select("tenant_id, slug, runtime_mode, last_health_result, last_health_check, last_health_duration_ms")
    .neq("tenant_id", PLATFORM_TENANT_ID);

  const regList = (regFull ?? []) as Array<{
    tenant_id: string; slug: string | null;
    runtime_mode: string | null;
    last_health_result: string | null;
    last_health_check: string | null;
    last_health_duration_ms: number | null;
  }>;

  const STALE_MS = 15 * 60 * 1000; // 15 min sem healthcheck = stale
  const nowMs = Date.now();
  let healthy = 0, failed = 0, stale = 0, never = 0;
  for (const r of regList) {
    if (!r.last_health_check) { never++; continue; }
    const age = nowMs - new Date(r.last_health_check).getTime();
    if (r.last_health_result === "ok") {
      if (age > STALE_MS) stale++;
      else healthy++;
    } else {
      failed++;
    }
  }
  const durations = regList
    .map(r => r.last_health_duration_ms)
    .filter((n): n is number => typeof n === "number" && n > 0)
    .sort((a, b) => a - b);
  const p95 = durations.length
    ? durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.95))]
    : 0;

  // Fan-out leve: tenta resolver a conexão de cada tenant (limit 50)
  // para validar que o roteamento está saudável. Em shared_db é O(1) no
  // client; em isolated_db lança em dry-run (contado como erro).
  const sample = regList.slice(0, 50);
  let fanoutOk = 0, fanoutErr = 0;
  await Promise.all(sample.map(async (r) => {
    try {
      await resolveTenantConnection(r.tenant_id);
      fanoutOk++;
    } catch {
      fanoutErr++;
    }
  }));

  const federated = {
    healthy, failed, stale, never,
    healthCheckP95Ms: p95,
    fanoutSample: sample.length,
    fanoutOk,
    fanoutErr,
  };

  // Série diária dos últimos 30 dias (novos tenants e atendimentos)
  const { data: tenants30 } = await admin
    .from("tenants")
    .select("created_at")
    .neq("id", PLATFORM_TENANT_ID)
    .gte("created_at", last30);
  const { data: atends30 } = await admin
    .from("atendimentos")
    .select("created_at")
    .neq("tenant_id", PLATFORM_TENANT_ID)
    .gte("created_at", last30);


  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    days.push(d.toISOString().slice(0, 10));
  }
  const serieTenants = days.map(d => ({
    dia: d,
    valor: (tenants30 ?? []).filter(r => (r.created_at as string).slice(0, 10) === d).length,
  }));
  const serieAtends = days.map(d => ({
    dia: d,
    valor: (atends30 ?? []).filter(r => (r.created_at as string).slice(0, 10) === d).length,
  }));

  return jsonResponse(200, {
    metrics: {
      tenantsTotal: total,
      tenantsAtivos,
      tenantsSuspensos,
      tenantsTrial,
      novosMes,
      crescimentoTenantsPct,
      usuariosTotal: profilesRes.count ?? 0,
      atendimentosTotal: atendsRes.count ?? 0,
      atendimentosMes: atendsMes,
      crescimentoAtendsPct,
      pacientesTotal: pacRes.count ?? 0,
      mrr,
      arr,
      arpu,
      churnPct,
      planosDist,
      serieTenants,
      serieAtends,
      controlPlane,
      federated,
    },
  }, requestId);
});
