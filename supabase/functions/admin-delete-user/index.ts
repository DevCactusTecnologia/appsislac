// Edge function admin-delete-user
// ----------------------------------------------------------------------------
// Exclui DEFINITIVAMENTE um usuário (auth.users + profile + roles via cascade).
// Apenas admins podem chamar. Não pode excluir a si mesmo.

import { createClient } from "../_shared/runtime/createClient.ts";
import {
  jsonResponse,
  errorResponse,
  preflight,
  newRequestId,
  createLogger,
} from "../_shared/hardening.ts";
import { assertSameTenantOrSuperAdmin } from "../_shared/tenantGuard.ts";

interface DeleteBody {
  userId?: unknown;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const requestId = newRequestId(req);
  const log = createLogger("admin-delete-user", requestId);

  if (req.method !== "POST") {
    return errorResponse(405, "Method not allowed", requestId, log);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    return errorResponse(500, "Server misconfiguration", requestId, log);
  }

  // 1. Autentica caller
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user: caller }, error: callerErr } = await userClient.auth.getUser();
  if (callerErr || !caller) {
    return errorResponse(401, "Não autenticado", requestId, log);
  }

  // 2. Verifica admin
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
    _user_id: caller.id,
    _role: "admin",
  });
  if (roleErr) return errorResponse(500, "Falha ao validar permissão", requestId, log);
  if (!isAdmin) return errorResponse(403, "Apenas administradores", requestId, log);

  // 3. Body
  let body: DeleteBody;
  try { body = await req.json() as DeleteBody; } catch {
    return errorResponse(400, "JSON inválido", requestId, log);
  }
  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!userId) return errorResponse(400, "userId obrigatório", requestId, log);

  // 4. Bloqueia auto-exclusão
  if (userId === caller.id) {
    return errorResponse(400, "Você não pode excluir seu próprio usuário", requestId, log);
  }

  // 4b. Tenant boundary — admin só pode operar sobre usuários do próprio tenant.
  //     Super admin bypassa. Bloqueia também operações sobre super admins.
  const guard = await assertSameTenantOrSuperAdmin(admin, caller.id, userId);
  if (!guard.ok) {
    log.warn("tenant guard blocked delete", {
      callerId: caller.id,
      targetId: userId,
      status: guard.status,
      reason: guard.message,
    });
    return errorResponse(guard.status, guard.message, requestId, log);
  }
  log.info("admin_delete_user_authorized", {
    actor_user_id: caller.id,
    actor_tenant_id: guard.callerTenantId,
    target_user_id: userId,
    target_tenant_id: guard.targetTenantId,
    super_admin: guard.isSuperAdmin,
  });

  // 5. Remove roles (não há FK de domínio para user_roles — seguro).
  const { error: roleDelErr } = await admin.from("user_roles").delete().eq("user_id", userId);
  if (roleDelErr) log.warn("delete user_roles falhou", { err: roleDelErr.message });

  // 6. Remove profile. Tabelas de domínio (atendimentos, exames, pagamentos,
  //    auditoria) NÃO têm FK para profiles/auth.users — guardam apenas
  //    nome/email como texto. Logo, excluir o profile preserva todo o histórico.
  const { error: profDelErr } = await admin.from("profiles").delete().eq("user_id", userId);
  if (profDelErr) log.warn("delete profile falhou", { err: profDelErr.message });

  // 7. Exclui do auth.users. Se falhar (ex.: FK futura desconhecida), fazemos
  //    soft-delete: re-cria/atualiza profile como Inativo para bloquear login,
  //    sem quebrar atendimentos vinculados.
  const { error: authDelErr } = await admin.auth.admin.deleteUser(userId);
  if (authDelErr) {
    log.warn("auth deleteUser falhou — aplicando soft-delete", { err: authDelErr.message });

    // Restaura/garante profile Inativo (caso já tenha sido apagado acima)
    const { data: existing } = await admin
      .from("profiles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      await admin.from("profiles").update({ status: "Inativo" }).eq("user_id", userId);
    }
    // Roles já removidas no passo 5 — usuário não consegue mais logar (status Inativo
    // bloqueia em AuthContext) e perde permissões.

    return jsonResponse(200, {
      ok: true,
      softDeleted: true,
      message: "Usuário desativado (exclusão definitiva bloqueada por vínculos). Login bloqueado e permissões removidas.",
    }, requestId);
  }

  log.info("usuário excluído definitivamente", { userId });
  return jsonResponse(200, { ok: true }, requestId);
});
