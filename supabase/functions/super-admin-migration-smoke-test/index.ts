// Edge function: super-admin-migration-smoke-test
// Valida se o banco dedicado do tenant recebeu os dados essenciais.
// Compara contagens críticas com o SHARED e checa presença de dicionários.

import { createClient } from "../_shared/runtime/createClient.ts";
import { connectDedicated, loadRegistry, requireSuperAdmin, beginRun, finishRun } from "../_shared/migration/connect.ts";
import { jsonResponse, errorResponse, preflight, newRequestId, createLogger } from "../_shared/hardening.ts";

const CHECKS: Array<{ key: string; table: string; label: string; requireMatch: boolean }> = [
  { key: "profiles", table: "profiles", label: "Perfis migrados", requireMatch: true },
  { key: "pacientes", table: "pacientes", label: "Pacientes", requireMatch: true },
  { key: "atendimentos", table: "atendimentos", label: "Atendimentos", requireMatch: true },
  { key: "atendimento_exames", table: "atendimento_exames", label: "Exames de atendimento", requireMatch: true },
  { key: "exames_catalogo", table: "exames_catalogo", label: "Catálogo de exames", requireMatch: true },
  { key: "select_options", table: "select_options", label: "Dicionários (select_options)", requireMatch: false },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const requestId = newRequestId(req);
  const log = createLogger("super-admin-migration-smoke-test", requestId);
  if (req.method !== "POST") return errorResponse(405, "Method not allowed", requestId, log);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const guard = await requireSuperAdmin(req, admin);
  if (!guard.ok) return errorResponse(guard.status, guard.msg, requestId, log);

  let body: { tenantId?: string } = {};
  try { body = await req.json(); } catch { return errorResponse(400, "JSON inválido", requestId, log); }
  const tenantId = body.tenantId;
  if (!tenantId) return errorResponse(400, "tenantId obrigatório", requestId, log);

  const reg = await loadRegistry(admin, tenantId);
  const runId = await beginRun(admin, tenantId, "smoke", guard.user.id);
  const t0 = Date.now();

  const results: Array<{ key: string; label: string; shared: number; dedicated: number; pass: boolean; reason?: string }> = [];
  let client;
  try {
    client = await connectDedicated(reg);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finishRun(admin, runId, "failed", { stage: "connect" }, msg);
    return errorResponse(400, msg, requestId, log);
  }

  try {
    for (const c of CHECKS) {
      const { count: sharedCount, error: sErr } = await admin
        .from(c.table).select("*", { count: "exact", head: true }).eq("tenant_id", tenantId);
      let dedCount = 0;
      let reason: string | undefined;
      try {
        const r = await client.queryObject<{ n: number }>(`SELECT COUNT(*)::int AS n FROM public.${c.table.replaceAll('"','')}`);
        dedCount = Number(r.rows[0]?.n ?? 0);
      } catch (e) {
        reason = e instanceof Error ? e.message : String(e);
      }
      const shared = sErr ? -1 : (sharedCount ?? 0);
      const pass = reason ? false : (c.requireMatch ? shared === dedCount : dedCount > 0 || shared === 0);
      results.push({ key: c.key, label: c.label, shared, dedicated: dedCount, pass, reason });
    }
  } finally {
    try { await client.end(); } catch { /* noop */ }
  }

  const allPass = results.every((r) => r.pass);
  await finishRun(admin, runId, allPass ? "ok" : "failed", { checks: results, ms: Date.now() - t0 });
  log.info("smoke done", { tenantId, allPass });
  return jsonResponse(200, { ok: allPass, runId, checks: results, latencyMs: Date.now() - t0 });
});
