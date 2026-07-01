// Edge function: super-admin-impersonate-tenant
// Gera um magic link (action_link) para o usuário admin de um tenant, permitindo
// que um super_admin entre no painel do laboratório sem conhecer a senha.
//
// Segurança:
//  - Caller deve ser super_admin (RPC is_super_admin)
//  - tenantId obrigatório
//  - Resolve o admin do tenant (profiles.perfil = 'admin' do tenant)
//  - Alvo NUNCA pode ser super_admin
//  - Tipo do link: "magiclink" (login direto, sem reset de senha)

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
  redirectTo?: unknown;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const requestId = newRequestId(req);
  const log = createLogger("super-admin-impersonate-tenant", requestId);
  if (req.method !== "POST") return errorResponse(405, "Method not allowed", requestId, log);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    return errorResponse(500, "Server misconfiguration", requestId, log);
  }

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

  const tenantId = typeof body.tenantId === "string" ? body.tenantId.trim() : "";
  const redirectTo = typeof body.redirectTo === "string" ? body.redirectTo.trim() : "";
  if (!tenantId) return errorResponse(400, "tenantId obrigatório", requestId, log);

  // Procura o admin do tenant (preferencialmente perfil='admin', senão o mais antigo)
  const { data: profiles, error: pErr } = await admin
    .from("profiles")
    .select("user_id, email, perfil, created_at, status")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });

  if (pErr) return errorResponse(500, "Erro ao localizar admin do laboratório", requestId, log, pErr);
  if (!profiles || profiles.length === 0) {
    return errorResponse(404, "Nenhum usuário encontrado neste laboratório", requestId, log);
  }

  // Defesa em profundidade: filtra super_admins ANTES de escolher o alvo,
  // já que um super_admin pode ter criado o tenant e também ser o admin local.
  const eligible: typeof profiles = [];
  for (const p of profiles) {
    if (!p.email) continue;
    const { data: isSuper } = await admin.rpc("is_super_admin", { _user_id: p.user_id });
    if (!isSuper) eligible.push(p);
  }

  if (eligible.length === 0) {
    return errorResponse(
      404,
      "Nenhum usuário não-super-admin com e-mail disponível neste laboratório",
      requestId,
      log,
    );
  }

  const target =
    eligible.find(p => p.perfil === "admin" && p.status !== "Inativo") ??
    eligible.find(p => p.status !== "Inativo") ??
    eligible[0];

  // Gera magic link (login one-shot)
  const { data: linkData, error: lErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: target.email,
    options: redirectTo ? { redirectTo } : undefined,
  });

  if (lErr || !linkData) {
    return errorResponse(500, "Erro ao gerar link de acesso", requestId, log, lErr);
  }

  const actionLink = (linkData as { properties?: { action_link?: string } }).properties?.action_link;
  if (!actionLink) {
    return errorResponse(500, "Link de acesso indisponível", requestId, log);
  }

  log.info("impersonation_link_generated", {
    tenant_id: tenantId,
    target_user_id: target.user_id,
    by_user_id: caller.id,
  });

  return jsonResponse(200, {
    ok: true,
    actionLink,
    email: target.email,
    perfil: target.perfil,
  }, requestId);
});