// Edge function admin-invite-user
// ----------------------------------------------------------------------------
// Cria um novo usuário no Supabase Auth via inviteUserByEmail (envia email de
// convite com link mágico) e popula seu profile com perfil/unidades/permissões
// escolhidos pelo admin. Opcionalmente atribui role 'admin' em user_roles.
//
// Regras de segurança:
//   - O caller DEVE estar autenticado (JWT válido).
//   - O caller DEVE ter role 'admin' (validado via has_role no banco).
//   - Usa SUPABASE_SERVICE_ROLE_KEY apenas internamente.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  corsHeaders,
  jsonResponse,
  errorResponse,
  preflight,
  newRequestId,
  createLogger,
} from "../_shared/hardening.ts";

const ALLOWED_PERFIS = ["admin", "analista", "recepcionista", "financeiro"] as const;
type Perfil = typeof ALLOWED_PERFIS[number];

interface InviteBody {
  email?: unknown;
  nome?: unknown;
  perfil?: unknown;
  unidadeIds?: unknown;
  permissoesExtras?: unknown;
  permissoesRevogadas?: unknown;
  isAdmin?: unknown;
  /**
   * Senha opcional. Quando fornecida (>= 8 chars), o usuário é criado já
   * ativo via admin.createUser (sem envio de email). Quando ausente, segue
   * o fluxo padrão de convite por magic link.
   */
  password?: unknown;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const requestId = newRequestId(req);
  const log = createLogger("admin-invite-user", requestId);

  if (req.method !== "POST") {
    return errorResponse(405, "Method not allowed", requestId, log);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    return errorResponse(500, "Server misconfiguration", requestId, log);
  }

  // 1. Autentica caller via Authorization header
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user: caller }, error: callerErr } = await userClient.auth.getUser();
  if (callerErr || !caller) {
    return errorResponse(401, "Não autenticado", requestId, log);
  }

  // 2. Verifica se caller é admin
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
    _user_id: caller.id,
    _role: "admin",
  });
  if (roleErr) {
    log.error("has_role failed", { err: roleErr.message });
    return errorResponse(500, "Falha ao validar permissão", requestId, log);
  }
  if (!isAdmin) {
    return errorResponse(403, "Apenas administradores podem convidar usuários", requestId, log);
  }

  // 2b. Resolve o tenant do caller. Novo usuário SEMPRE será criado dentro
  //     desse tenant — nunca aceitamos tenant_id vindo do client.
  const { data: callerProfile } = await admin
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", caller.id)
    .maybeSingle();
  const callerTenantId = (callerProfile as { tenant_id?: string | null } | null)?.tenant_id ?? null;
  const { data: callerIsSuper } = await admin.rpc("is_super_admin", { _user_id: caller.id });
  if (!callerIsSuper && !callerTenantId) {
    return errorResponse(403, "Caller sem tenant associado", requestId, log);
  }

  // 3. Valida body
  let body: InviteBody;
  try { body = await req.json() as InviteBody; } catch {
    return errorResponse(400, "JSON inválido", requestId, log);
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const nome = typeof body.nome === "string" ? body.nome.trim() : "";
  const perfilRaw = typeof body.perfil === "string" ? body.perfil : "";
  if (!email || !email.includes("@")) return errorResponse(400, "Email inválido", requestId, log);
  if (!nome) return errorResponse(400, "Nome obrigatório", requestId, log);
  if (!ALLOWED_PERFIS.includes(perfilRaw as Perfil)) {
    return errorResponse(400, "Perfil inválido", requestId, log);
  }
  const perfil = perfilRaw as Perfil;
  const unidadeIds = asStringArray(body.unidadeIds);
  const permissoesExtras = asStringArray(body.permissoesExtras);
  const permissoesRevogadas = asStringArray(body.permissoesRevogadas);
  const isAdminFlag = body.isAdmin === true;
  const passwordRaw = typeof body.password === "string" ? body.password : "";
  const usePassword = passwordRaw.length > 0;

  // 3b. Tenant boundary em unidades — Equipe 2.1 Fase 2.3.
  //     Garante que TODA unidade enviada pertence ao tenant do caller.
  //     Super admin pode atribuir qualquer unidade (uso operacional).
  if (unidadeIds.length > 0 && !callerIsSuper) {
    const { data: validUnidades, error: unidadesErr } = await admin
      .from("unidades")
      .select("id")
      .eq("tenant_id", callerTenantId)
      .in("id", unidadeIds);
    if (unidadesErr) {
      log.error("validar unidades falhou", { err: unidadesErr.message });
      return errorResponse(500, "Falha ao validar unidades", requestId, log);
    }
    const validSet = new Set((validUnidades ?? []).map((u: { id: string }) => u.id));
    const invalid = unidadeIds.filter((id) => !validSet.has(id));
    if (invalid.length > 0) {
      log.warn("tentativa de vincular unidades fora do tenant", {
        callerId: caller.id, callerTenantId, invalid,
      });
      return errorResponse(400, `Unidades inválidas (não pertencem ao seu laboratório): ${invalid.join(", ")}`, requestId, log);
    }
  }
  if (usePassword && passwordRaw.length < 8) {
    return errorResponse(400, "Senha deve ter no mínimo 8 caracteres", requestId, log);
  }

  // 4. Cria o usuário no Supabase Auth (com senha) ou envia convite por email.
  //    Em ambos os casos, a tabela `profiles` é populada pelo trigger
  //    handle_new_user, que será atualizado com os campos do admin no passo 5.
  let newUserId: string;
  if (usePassword) {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: passwordRaw,
      email_confirm: true,
      user_metadata: { full_name: nome },
    });
    if (createErr || !created?.user) {
      log.warn("createUser falhou", { err: createErr?.message });
      return errorResponse(400, createErr?.message ?? "Falha ao criar usuário", requestId, log);
    }
    newUserId = created.user.id;
  } else {
    const redirectTo = `${new URL(req.url).origin.replace(/\/functions.*/, "")}/reset-password`;
    const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: nome },
      redirectTo,
    });
    if (inviteErr || !inviteData?.user) {
      log.warn("inviteUserByEmail falhou", { err: inviteErr?.message });
      return errorResponse(400, inviteErr?.message ?? "Falha ao enviar convite", requestId, log);
    }
    newUserId = inviteData.user.id;
  }

  // 5. Atualiza profile (já criado pelo trigger handle_new_user) com os
  //    valores escolhidos pelo admin. Usar update ao invés de insert evita
  //    conflito com o trigger.
  //    Fallback de unidade: se nenhuma foi enviada, usa a primeira unidade
  //    ativa do tenant do caller (NUNCA um id fictício hardcoded).
  let finalUnidadeIds = unidadeIds;
  if (finalUnidadeIds.length === 0 && callerTenantId) {
    const { data: fallbackUnidades } = await admin
      .from("unidades")
      .select("id")
      .eq("tenant_id", callerTenantId)
      .eq("ativo", true)
      .order("created_at", { ascending: true })
      .limit(1);
    if (fallbackUnidades && fallbackUnidades.length > 0) {
      finalUnidadeIds = [fallbackUnidades[0].id as string];
    }
  }
  if (finalUnidadeIds.length === 0) {
    return errorResponse(400, "Nenhuma unidade disponível para vincular ao usuário. Cadastre uma unidade antes.", requestId, log);
  }

  const { error: profErr } = await admin
    .from("profiles")
    .update({
      nome,
      perfil,
      unidade_ids: finalUnidadeIds,
      unidade_ativa: finalUnidadeIds[0],
      permissoes_extras: permissoesExtras,
      permissoes_revogadas: permissoesRevogadas,
      status: "Ativo",
      // Força o tenant do novo usuário ao tenant do caller — defesa em
      // profundidade caso o trigger handle_new_user não preencha corretamente.
      ...(callerTenantId ? { tenant_id: callerTenantId } : {}),
    })
    .eq("user_id", newUserId);
  if (profErr) {
    log.warn("update profile falhou", { err: profErr.message });
    return errorResponse(500, "Convite enviado, mas falha ao salvar perfil: " + profErr.message, requestId, log);
  }

  log.info("admin_invite_user_authorized", {
    actor_user_id: caller.id,
    actor_tenant_id: callerTenantId,
    target_user_id: newUserId,
    target_tenant_id: callerTenantId,
    super_admin: callerIsSuper === true,
  });

  // 6. Se admin, garante role 'admin' em user_roles
  if (isAdminFlag) {
    const { error: roleInsertErr } = await admin
      .from("user_roles")
      .upsert({ user_id: newUserId, role: "admin" }, { onConflict: "user_id,role" });
    if (roleInsertErr) {
      log.warn("upsert role admin falhou", { err: roleInsertErr.message });
    }
  }

  log.info("usuário criado", { newUserId, email, mode: usePassword ? "password" : "invite" });
  return jsonResponse(200, { ok: true, userId: newUserId, mode: usePassword ? "password" : "invite" }, requestId);
});
