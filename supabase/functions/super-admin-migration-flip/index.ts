// Edge function: super-admin-migration-flip
// Vira o runtime do tenant para o banco dedicado. Só executa se o último smoke passou.
// Marca o SHARED como frozen (somente-leitura lógico) via `frozen_at`.

import { createClient } from "../_shared/runtime/createClient.ts";
import { requireSuperAdmin, beginRun, finishRun } from "../_shared/migration/connect.ts";
import { jsonResponse, errorResponse, preflight, newRequestId, createLogger } from "../_shared/hardening.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const requestId = newRequestId(req);
  const log = createLogger("super-admin-migration-flip", requestId);
  if (req.method !== "POST") return errorResponse(405, "Method not allowed", requestId, log);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const guard = await requireSuperAdmin(req, admin);
  if (!guard.ok) return errorResponse(guard.status, guard.msg, requestId, log);

  let body: { tenantId?: string; confirm?: string } = {};
  try { body = await req.json(); } catch { return errorResponse(400, "JSON inválido", requestId, log); }
  const tenantId = body.tenantId;
  if (!tenantId) return errorResponse(400, "tenantId obrigatório", requestId, log);
  if (body.confirm !== "FLIP") return errorResponse(400, "confirm deve ser 'FLIP'", requestId, log);

  // Última execução de smoke deve ter status ok e ser recente.
  const minSmokeAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: lastSmoke, error: sErr } = await admin
    .from("tenant_migration_runs")
    .select("id, status, finished_at")
    .eq("tenant_id", tenantId).eq("phase", "smoke")
    .gte("finished_at", minSmokeAt)
    .order("finished_at", { ascending: false }).limit(1).maybeSingle();
  if (sErr) return errorResponse(500, sErr.message, requestId, log);
  if (!lastSmoke || (lastSmoke as { status: string }).status !== "ok") {
    return errorResponse(412, "Execute um smoke test com sucesso nos últimos 60 minutos antes do flip.", requestId, log);
  }

  const runId = await beginRun(admin, tenantId, "flip", guard.user.id);
  const now = new Date().toISOString();
  const { data: flipped, error: upErr } = await admin.from("tenant_registry").update({
    runtime_mode: "isolated_db",
    database_strategy: "dedicated",
    migration_state: "dedicated",
    frozen_at: now,
  }).eq("tenant_id", tenantId).neq("runtime_mode", "isolated_db").select("tenant_id").maybeSingle();
  if (upErr) {
    await finishRun(admin, runId, "failed", {}, upErr.message);
    return errorResponse(500, upErr.message, requestId, log);
  }
  if (!flipped) {
    const msg = "Flip não executado: tenant já está dedicado ou estado foi alterado por outra operação.";
    await finishRun(admin, runId, "failed", {}, msg);
    return errorResponse(409, msg, requestId, log);
  }
  await finishRun(admin, runId, "ok", { frozen_at: now });
  log.info("flip done", { tenantId });
  return jsonResponse(200, { ok: true, runId, frozen_at: now }, requestId);
});
