// Edge function: super-admin-delete-tenant
// Apaga permanentemente um tenant e todos os dados vinculados (cascata via FKs).
// Também remove os usuários do Supabase Auth associados ao tenant (profiles).
// Exige confirmação via campo `confirmName` que deve bater com tenants.nome.
import { createClient } from "../_shared/runtime/createClient.ts";
import { jsonResponse, errorResponse, preflight, newRequestId, createLogger } from "../_shared/hardening.ts";

interface Body { tenantId?: unknown; confirmName?: unknown; }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const requestId = newRequestId(req);
  const log = createLogger("super-admin-delete-tenant", requestId);
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
  try { body = await req.json() as Body; } catch { return errorResponse(400, "JSON inválido", requestId, log); }
  const tenantId = typeof body.tenantId === "string" ? body.tenantId.trim() : "";
  const confirmName = typeof body.confirmName === "string" ? body.confirmName.trim() : "";
  if (!tenantId) return errorResponse(400, "tenantId obrigatório", requestId, log);

  const { data: tenant, error: tErr } = await admin.from("tenants").select("id,nome").eq("id", tenantId).maybeSingle();
  if (tErr) return errorResponse(500, "Erro ao buscar tenant", requestId, log, tErr);
  if (!tenant) return errorResponse(404, "Tenant não encontrado", requestId, log);
  if ((tenant.nome ?? "").trim() !== confirmName) {
    return errorResponse(400, "Confirmação do nome do laboratório não confere", requestId, log);
  }

  // Lista todos profiles do tenant para apagar usuários do Auth (exceto super_admins)
  const { data: profiles } = await admin.from("profiles").select("user_id").eq("tenant_id", tenantId);
  const userIds = (profiles ?? []).map(p => p.user_id as string).filter(Boolean);

  for (const uid of userIds) {
    const { data: isSuperTarget } = await admin.rpc("is_super_admin", { _user_id: uid });
    if (isSuperTarget) continue;
    try { await admin.auth.admin.deleteUser(uid); } catch (e) { log.warn("auth_delete_failed", { uid, e: String(e) }); }
  }

  const { error: delErr } = await admin.from("tenants").delete().eq("id", tenantId);
  if (delErr) return errorResponse(500, "Erro ao excluir tenant. Verifique constraints/FKs no banco.", requestId, log, delErr);

  log.info("tenant_deleted", { tenant_id: tenantId, by: caller.id, users_removed: userIds.length });
  return jsonResponse(200, { ok: true }, requestId);
});
