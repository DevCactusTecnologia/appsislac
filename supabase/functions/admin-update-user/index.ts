// Edge function admin-update-user
// ----------------------------------------------------------------------------
// Atualiza profile + role admin de um usuário existente. Apenas admins.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  jsonResponse,
  errorResponse,
  preflight,
  newRequestId,
  createLogger,
} from "../_shared/hardening.ts";
import { assertSameTenantOrSuperAdmin } from "../_shared/tenantGuard.ts";

const ALLOWED_PERFIS = ["admin", "analista", "recepcionista", "financeiro"] as const;
type Perfil = typeof ALLOWED_PERFIS[number];

interface UpdateBody {
  userId?: unknown;
  nome?: unknown;
  perfil?: unknown;
  status?: unknown;
  unidadeIds?: unknown;
  permissoesExtras?: unknown;
  permissoesRevogadas?: unknown;
  isAdmin?: unknown;
  /** Nova senha opcional (>= 8 chars). Atualiza diretamente no Supabase Auth. */
  password?: unknown;
  /** Tipo de assinatura no laudo: "carimbo" (texto) ou "imagem" (scaneada). */
  assinaturaTipo?: unknown;
  /** Texto livre do conselho profissional (ex.: "CRBM/MG 12345"). */
  assinaturaConselho?: unknown;
  telefone?: unknown;
  tipoProfissional?: unknown;
  cbo?: unknown;
  cpf?: unknown;
  cns?: unknown;
  conselhoClasse?: unknown;
  conselhoUf?: unknown;
  conselhoNumero?: unknown;
}

function asStringArray(v: unknown): string[] | undefined {
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) return undefined;
  return v.filter((x): x is string => typeof x === "string");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const requestId = newRequestId(req);
  const log = createLogger("admin-update-user", requestId);

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
  let body: UpdateBody;
  try { body = await req.json() as UpdateBody; } catch {
    return errorResponse(400, "JSON inválido", requestId, log);
  }
  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!userId) return errorResponse(400, "userId obrigatório", requestId, log);

  // 3b. Tenant boundary — admin só pode operar no próprio tenant.
  const guard = await assertSameTenantOrSuperAdmin(admin, caller.id, userId);
  if (!guard.ok) {
    log.warn("tenant guard blocked update", {
      callerId: caller.id,
      targetId: userId,
      status: guard.status,
      reason: guard.message,
    });
    return errorResponse(guard.status, guard.message, requestId, log);
  }
  log.info("admin_update_user_authorized", {
    actor_user_id: caller.id,
    actor_tenant_id: guard.callerTenantId,
    target_user_id: userId,
    target_tenant_id: guard.targetTenantId,
    super_admin: guard.isSuperAdmin,
  });

  // Monta patch dinamicamente — só inclui campos enviados
  const patch: Record<string, unknown> = {};
  if (typeof body.nome === "string") patch.nome = body.nome.trim();
  if (typeof body.perfil === "string" && ALLOWED_PERFIS.includes(body.perfil as Perfil)) {
    patch.perfil = body.perfil;
  }
  if (body.status === "Ativo" || body.status === "Inativo") patch.status = body.status;
  const unidades = asStringArray(body.unidadeIds);
  if (unidades) {
    patch.unidade_ids = unidades.length ? unidades : ["und-001"];
    // Se a unidade ativa atual não está mais na lista, ajusta
    const { data: prof } = await admin.from("profiles").select("unidade_ativa").eq("user_id", userId).maybeSingle();
    const currentAtiva = (prof as { unidade_ativa?: string } | null)?.unidade_ativa;
    if (!currentAtiva || !unidades.includes(currentAtiva)) {
      patch.unidade_ativa = unidades[0] ?? "und-001";
    }
  }
  const extras = asStringArray(body.permissoesExtras);
  if (extras) patch.permissoes_extras = extras;
  const revogadas = asStringArray(body.permissoesRevogadas);
  if (revogadas) patch.permissoes_revogadas = revogadas;

  if (body.assinaturaTipo === "carimbo" || body.assinaturaTipo === "imagem") {
    patch.assinatura_tipo = body.assinaturaTipo;
  }
  if (typeof body.assinaturaConselho === "string") {
    patch.assinatura_conselho = body.assinaturaConselho.trim() || null;
  }

  // 4. Aplica update no profile
  if (Object.keys(patch).length > 0) {
    const { error: updErr } = await admin.from("profiles").update(patch).eq("user_id", userId);
    if (updErr) {
      log.error("update profile failed", { err: updErr.message });
      return errorResponse(500, "Falha ao atualizar perfil", requestId, log, updErr);
    }
  }

  // 4b. Reset de senha (opcional). Usa Supabase Auth oficial — proibido
  //     manter qualquer hash/senha paralelo.
  if (typeof body.password === "string" && body.password.length > 0) {
    if (body.password.length < 8) {
      return errorResponse(400, "Senha deve ter no mínimo 8 caracteres", requestId, log);
    }
    // Verifica se o usuário ainda existe no Supabase Auth.
    const { data: authUser } = await admin.auth.admin.getUserById(userId);
    if (authUser?.user) {
      const { error: pwErr } = await admin.auth.admin.updateUserById(userId, { password: body.password });
      if (pwErr) {
        log.error("updateUserById password failed", { err: pwErr.message });
        return errorResponse(500, "Falha ao redefinir senha", requestId, log, pwErr);
      }
      log.info("senha redefinida", { userId });
    } else {
      // Perfil órfão (auth.users deletado). Recria o usuário no Auth com o
      // mesmo email e remapeia profile/user_roles para o novo id.
      const { data: prof, error: profErr } = await admin
        .from("profiles")
        .select("email")
        .eq("user_id", userId)
        .maybeSingle();
      const email = (prof as { email?: string } | null)?.email;
      if (profErr || !email) {
        return errorResponse(404, "Perfil órfão sem email — não é possível recriar.", requestId, log);
      }
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: body.password,
        email_confirm: true,
      });
      if (createErr || !created?.user) {
        log.error("recreate auth user failed", { err: createErr?.message });
        return errorResponse(500, "Falha ao recriar usuário no Auth", requestId, log, createErr);
      }
      const newId = created.user.id;
      // Um trigger handle_new_user pode ter criado um profile/role para o novo
      // auth user. Removemos esse "shell" antes de remapear o profile original.
      await admin.from("user_roles").delete().eq("user_id", newId);
      await admin.from("profiles").delete().eq("user_id", newId);
      // Remapeia FK lógica em profiles e user_roles
      const { error: upProfErr } = await admin.from("profiles").update({ user_id: newId }).eq("user_id", userId);
      if (upProfErr) {
        log.error("remap profile failed", { err: upProfErr.message });
        return errorResponse(500, "Falha ao remapear perfil", requestId, log, upProfErr);
      }
      await admin.from("user_roles").update({ user_id: newId }).eq("user_id", userId);
      log.info("perfil órfão recriado", { oldId: userId, newId });
    }
  }

  // 5. Sincroniza role admin
  if (typeof body.isAdmin === "boolean") {
    if (body.isAdmin) {
      const { error: insErr } = await admin
        .from("user_roles")
        .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
      if (insErr) log.warn("upsert role falhou", { err: insErr.message });
    } else {
      // Não permite remover a si mesmo do admin (evita lockout)
      if (userId === caller.id) {
        return errorResponse(400, "Você não pode remover seu próprio acesso de administrador", requestId, log);
      }
      const { error: delErr } = await admin
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "admin");
      if (delErr) log.warn("delete role falhou", { err: delErr.message });
    }
  }

  log.info("usuário atualizado", { userId });
  return jsonResponse(200, { ok: true }, requestId);
});
