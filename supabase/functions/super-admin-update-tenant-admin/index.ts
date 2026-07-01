// Edge function: super-admin-update-tenant-admin
// Atualiza dados do usuário admin/responsável de um tenant.
// - profiles.nome / profiles.telefone (sempre via service-role)
// - auth.users.email (via admin.updateUserById) e espelha em profiles.email
// Acesso: apenas super_admin.

import { createClient } from "../_shared/runtime/createClient.ts";
import { jsonResponse, errorResponse, preflight, newRequestId, createLogger } from "../_shared/hardening.ts";

interface Body {
  tenantId?: unknown;
  userId?: unknown;
  nome?: unknown;
  email?: unknown;
  telefone?: unknown;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const requestId = newRequestId(req);
  const log = createLogger("super-admin-update-tenant-admin", requestId);
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
  try { body = await req.json() as Body; } catch {
    return errorResponse(400, "JSON inválido", requestId, log);
  }
  const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!tenantId || !userId) return errorResponse(400, "tenantId e userId obrigatórios", requestId, log);

  // Confirma que o profile pertence ao tenant.
  const { data: prof, error: pErr } = await admin
    .from("profiles")
    .select("user_id, tenant_id, email")
    .eq("user_id", userId)
    .maybeSingle();
  if (pErr || !prof) return errorResponse(404, "Perfil não encontrado", requestId, log);
  if (prof.tenant_id !== tenantId) return errorResponse(403, "Perfil não pertence ao tenant informado", requestId, log);

  const patch: Record<string, unknown> = {};
  if (typeof body.nome === "string") {
    const v = body.nome.trim();
    if (v.length < 2) return errorResponse(400, "Nome muito curto", requestId, log);
    patch.nome = v;
  }
  if (typeof body.telefone === "string") {
    patch.telefone = body.telefone.trim() || null;
  }

  let newEmail: string | null = null;
  if (typeof body.email === "string") {
    const v = body.email.trim().toLowerCase();
    if (v && v !== prof.email) {
      if (!EMAIL_RE.test(v)) return errorResponse(400, "E-mail inválido", requestId, log);
      newEmail = v;
    }
  }

  if (Object.keys(patch).length === 0 && !newEmail) {
    return errorResponse(400, "Nada para atualizar", requestId, log);
  }

  if (newEmail) {
    const { error: emErr } = await admin.auth.admin.updateUserById(userId, {
      email: newEmail,
      email_confirm: true,
    });
    if (emErr) {
      log.error("update auth email failed", { err: emErr.message });
      return errorResponse(500, "Falha ao atualizar e-mail no Auth: " + emErr.message, requestId, log);
    }
    patch.email = newEmail;
  }

  if (Object.keys(patch).length > 0) {
    const { error: upErr } = await admin.from("profiles").update(patch).eq("user_id", userId);
    if (upErr) {
      log.error("update profile failed", { err: upErr.message });
      return errorResponse(500, "Falha ao atualizar perfil", requestId, log, upErr);
    }
  }

  log.info("admin do tenant atualizado", { tenantId, userId, fields: Object.keys(patch) });
  return jsonResponse(200, { ok: true }, requestId);
});
