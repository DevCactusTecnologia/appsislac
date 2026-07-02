// Edge function: super-admin-purge-tenant-from-shared
// Remove definitivamente os dados do tenant do banco SHARED após 30 dias
// de quarentena. Requer confirmação dupla e state='dedicated'.

import { createClient } from "../_shared/runtime/createClient.ts";
import { requireSuperAdmin, beginRun, finishRun, createUserClientFromRequest } from "../_shared/migration/connect.ts";
import { jsonResponse, errorResponse, preflight, newRequestId, createLogger } from "../_shared/hardening.ts";

const QUARANTINE_DAYS = 30;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const requestId = newRequestId(req);
  const log = createLogger("super-admin-purge-tenant-from-shared", requestId);
  if (req.method !== "POST") return errorResponse(405, "Method not allowed", requestId, log);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const guard = await requireSuperAdmin(req, admin);
  if (!guard.ok) return errorResponse(guard.status, guard.msg, requestId, log);

  let body: { tenantId?: string; confirm?: string; typedTenantId?: string; dryRun?: boolean } = {};
  try { body = await req.json(); } catch { return errorResponse(400, "JSON inválido", requestId, log); }
  const tenantId = body.tenantId;
  if (!tenantId) return errorResponse(400, "tenantId obrigatório", requestId, log);
  if (!body.dryRun) {
    if (body.confirm !== "PURGE") return errorResponse(400, "confirm deve ser 'PURGE'", requestId, log);
    if (body.typedTenantId !== tenantId) return errorResponse(400, "Digite o tenantId para confirmar", requestId, log);
  }

  const { data: reg, error: rErr } = await admin
    .from("tenant_registry")
    .select("migration_state, frozen_at, runtime_mode")
    .eq("tenant_id", tenantId).maybeSingle();
  if (rErr || !reg) return errorResponse(404, "tenant_registry não encontrado", requestId, log);
  const r = reg as { migration_state: string | null; frozen_at: string | null; runtime_mode: string | null };
  // runtime_mode é a fonte da verdade — só ele decide se o tenant já vive no dedicado.
  // migration_state é auditoria e pode ficar defasado em rows migradas antes do flip idempotente.
  if (r.runtime_mode !== "isolated_db") {
    return errorResponse(412, "Tenant precisa estar operando no banco dedicado (runtime_mode=isolated_db) para purge.", requestId, log);
  }
  const frozenAt = r.frozen_at ? new Date(r.frozen_at).getTime() : 0;
  const ageDays = (Date.now() - frozenAt) / 86400000;
  if (!body.dryRun && ageDays < QUARANTINE_DAYS) {
    return errorResponse(412, `Aguarde a quarentena de ${QUARANTINE_DAYS} dias (${Math.floor(QUARANTINE_DAYS - ageDays)}d restantes).`, requestId, log);
  }

  const runId = await beginRun(admin, tenantId, "purge", guard.user.id);
  const userClient = createUserClientFromRequest(req);
  const { data: rawList, error: listErr } = await userClient.rpc("super_admin_list_migration_tables", { _tenant_id: tenantId });
  if (listErr || !rawList) {
    await finishRun(admin, runId, "failed", {}, listErr?.message ?? "empty list");
    return errorResponse(500, `Falha ao listar tabelas: ${listErr?.message}`, requestId, log);
  }
  type T = { table_name: string; level: number; has_tenant_id: boolean; rowcount: number };
  const tables = (rawList as T[])
    .filter((t) => t.has_tenant_id)
    .sort((a, b) => b.level - a.level); // ordem reversa de FK

  const summary: Record<string, { rows: number; deleted?: number; error?: string; dryRun?: boolean }> = {};
  for (const t of tables) {
    summary[t.table_name] = { rows: t.rowcount };
    if (body.dryRun) { summary[t.table_name].dryRun = true; continue; }
    const { error, count } = await admin.from(t.table_name).delete({ count: "exact" }).eq("tenant_id", tenantId);
    if (error) summary[t.table_name].error = error.message;
    else summary[t.table_name].deleted = count ?? 0;
  }

  const failed = Object.values(summary).some((s) => s.error);
  await finishRun(admin, runId, failed ? "failed" : "ok", { tables: summary, dryRun: !!body.dryRun });
  if (!body.dryRun && !failed) {
    await admin.from("tenant_registry").update({ migration_state: "purged" }).eq("tenant_id", tenantId);
  }
  log.info("purge done", { tenantId, dryRun: !!body.dryRun, failed });
  return jsonResponse(200, { ok: !failed, runId, tables: summary, dryRun: !!body.dryRun });
});
