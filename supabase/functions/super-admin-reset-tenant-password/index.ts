// Edge function: super-admin-reset-tenant-password
// Permite que um super_admin defina uma nova senha (e opcionalmente um novo
// e-mail) para o usuário admin de um tenant específico. Validação rigorosa:
//  - Caller deve ser super_admin (RPC is_super_admin)
//  - tenantId obrigatório e existente
//  - userId (alvo) deve pertencer ao tenant informado (profiles.tenant_id)
//  - Alvo NUNCA pode ser super_admin (defesa em profundidade)
//  - Senha: mínimo de 6 caracteres (limite de segurança técnica do Supabase Auth).
//    A força da senha é apenas avisada no UI; não bloqueamos senhas fracas
//    a pedido do operador (super admin tem responsabilidade total).
//  - E-mail (se enviado) precisa ser válido e único

import { createClient } from "../_shared/runtime/createClient.ts";
import {
  jsonResponse,
  errorResponse,
  preflight,
  newRequestId,
  createLogger,
} from "../_shared/hardening.ts";

interface Body {
  tenantId?: unknown;
  userId?: unknown;
  newPassword?: unknown;
  newEmail?: unknown;
}

function checkPasswordAcceptable(pw: string): { ok: boolean; reason?: string } {
  if (typeof pw !== "string" || pw.length < 6) {
    return { ok: false, reason: "Senha deve ter no mínimo 6 caracteres" };
  }
  if (pw.length > 72) {
    return { ok: false, reason: "Senha deve ter no máximo 72 caracteres" };
  }
  return { ok: true };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(e: string): boolean {
  return EMAIL_RE.test(e) && e.length <= 254;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const requestId = newRequestId(req);
  const log = createLogger("super-admin-reset-tenant-password", requestId);
  if (req.method !== "POST") return errorResponse(405, "Method not allowed", requestId, log);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    return errorResponse(500, "Server misconfiguration", requestId, log);
  }

  // Autenticação do chamador
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user: caller }, error: cErr } = await userClient.auth.getUser();
  if (cErr || !caller) return errorResponse(401, "Não autenticado", requestId, log);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: isSuper } = await admin.rpc("is_super_admin", { _user_id: caller.id });
  if (!isSuper) return errorResponse(403, "Apenas super admins", requestId, log);

  // Body
  let body: Body;
  try { body = await req.json() as Body; } catch {
    return errorResponse(400, "JSON inválido", requestId, log);
  }

  const tenantId = typeof body.tenantId === "string" ? body.tenantId.trim() : "";
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  const newEmailRaw = typeof body.newEmail === "string" ? body.newEmail.trim().toLowerCase() : "";

  if (!tenantId) return errorResponse(400, "tenantId obrigatório", requestId, log);
  if (!userId) return errorResponse(400, "userId obrigatório", requestId, log);

  const pwOk = checkPasswordAcceptable(newPassword);
  if (!pwOk.ok) return errorResponse(400, pwOk.reason ?? "Senha inválida", requestId, log);

  if (newEmailRaw && !isValidEmail(newEmailRaw)) {
    return errorResponse(400, "E-mail inválido", requestId, log);
  }

  // Verifica que o user pertence ao tenant
  const { data: profile, error: pErr } = await admin
    .from("profiles")
    .select("user_id, email, tenant_id, perfil")
    .eq("user_id", userId)
    .maybeSingle();

  if (pErr) return errorResponse(500, "Erro ao validar perfil", requestId, log, pErr);
  if (!profile) return errorResponse(404, "Usuário não encontrado", requestId, log);
  if (profile.tenant_id !== tenantId) {
    return errorResponse(403, "Usuário não pertence a este laboratório", requestId, log);
  }

  // Defesa em profundidade: alvo nunca pode ser super_admin
  const { data: targetIsSuper } = await admin.rpc("is_super_admin", { _user_id: userId });
  if (targetIsSuper) {
    return errorResponse(403, "Operação não permitida sobre super administradores", requestId, log);
  }

  // Se há mudança de e-mail, verifica unicidade
  const emailChanged = newEmailRaw && newEmailRaw !== (profile.email ?? "").toLowerCase();
  if (emailChanged) {
    const { data: dup } = await admin
      .from("profiles")
      .select("user_id")
      .ilike("email", newEmailRaw)
      .neq("user_id", userId)
      .maybeSingle();
    if (dup) return errorResponse(409, "E-mail já está em uso", requestId, log);
  }

  // Atualiza a senha via Auth Admin API
  const updatePayload: { password: string; email?: string; email_confirm?: boolean } = {
    password: newPassword,
  };
  if (emailChanged) {
    updatePayload.email = newEmailRaw;
    updatePayload.email_confirm = true; // mantém confirmado para login imediato
  }

  const { error: uErr } = await admin.auth.admin.updateUserById(userId, updatePayload);
  if (uErr) {
    const msg = (uErr as { message?: string }).message ?? "";
    const name = (uErr as { name?: string }).name ?? "";
    // Política do produto: super admin pode definir qualquer senha, inclusive
    // fracas/vazadas. Se o Auth bloquear por HIBP, devolvemos 400 amigável.
    if (name === "AuthWeakPasswordError" || /weak|pwned|known to be/i.test(msg)) {
      log.warn("weak_password_blocked_by_hibp", { target_user_id: userId });
      return errorResponse(
        400,
        "Esta senha foi bloqueada pela proteção de senhas vazadas (HIBP). Use uma senha mais forte ou desative HIBP em Auth → Providers → Email.",
        requestId,
        log,
      );
    }
    return errorResponse(500, "Erro ao atualizar senha", requestId, log, uErr);
  }

  // Sincroniza profiles.email se mudou
  if (emailChanged) {
    const { error: prErr } = await admin
      .from("profiles")
      .update({ email: newEmailRaw })
      .eq("user_id", userId);
    if (prErr) {
      log.warn("profile_email_sync_failed", { user_id: userId });
    }
  }

  log.info("password_reset_by_super_admin", {
    tenant_id: tenantId,
    target_user_id: userId,
    by_user_id: caller.id,
    email_changed: emailChanged,
  });

  return jsonResponse(200, {
    ok: true,
    email: emailChanged ? newEmailRaw : profile.email,
    message: "Senha atualizada com sucesso",
  }, requestId);
});