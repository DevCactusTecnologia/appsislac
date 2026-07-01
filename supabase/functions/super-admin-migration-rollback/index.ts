// Edge function: super-admin-migration-rollback
// Reverte o tenant para o banco SHARED. Usado dentro da janela de quarentena.

import { createClient } from "../_shared/runtime/createClient.ts";
import { requireSuperAdmin, beginRun, finishRun } from "../_shared/migration/connect.ts";
import { jsonResponse, errorResponse, preflight, newRequestId, createLogger } from "../_shared/hardening.ts";

const ROLLBACK_WINDOW_DAYS = 30;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const requestId = newRequestId(req);
  const log = createLogger("super-admin-migration-rollback", requestId);
  if (req.method !== "POST") return errorResponse(405, "Method not allowed", requestId, log);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const guard = await requireSuperAdmin(req, admin);
  if (!guard.ok) return errorResponse(guard.status, guard.msg, requestId, log);

  let body: { tenantId?: string; confirm?: string; reason?: string } = {};
  try { body = await req.json(); } catch { return errorResponse(400, "JSON inválido", requestId, log); }
  const tenantId = body.tenantId;
  if (!tenantId) return errorResponse(400, "tenantId obrigatório", requestId, log);
  if (body.confirm !== "ROLLBACK") return errorResponse(400, "confirm deve ser 'ROLLBACK'", requestId, log);

  const { data: reg, error: rErr } = await admin
    .from("tenant_registry")
    .select("runtime_mode, frozen_at")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (rErr || !reg) return errorResponse(404, "tenant_registry não encontrado", requestId, log);
  const frozenAt = (reg as { frozen_at?: string | null }).frozen_at;
  if ((reg as { runtime_mode?: string | null }).runtime_mode !== "isolated_db" || !frozenAt) {
    return errorResponse(412, "Rollback permitido apenas para tenant dedicado em quarentena.", requestId, log);
  }
  const ageDays = (Date.now() - new Date(frozenAt).getTime()) / 86400000;
  if (ageDays > ROLLBACK_WINDOW_DAYS) {
    return errorResponse(412, `Janela de rollback expirada (${ROLLBACK_WINDOW_DAYS} dias).`, requestId, log);
  }

  const runId = await beginRun(admin, tenantId, "rollback", guard.user.id);
  const { error: upErr } = await admin.from("tenant_registry").update({
    runtime_mode: "shared_db",
    database_strategy: "shared",
    migration_state: "shared_rollback",
  }).eq("tenant_id", tenantId);
  if (upErr) {
    await finishRun(admin, runId, "failed", {}, upErr.message);
    return errorResponse(500, upErr.message, requestId, log);
  }
  await finishRun(admin, runId, "ok", { reason: body.reason ?? null });
  log.info("rollback done", { tenantId });
  return jsonResponse(200, { ok: true, runId }, requestId);
});
