// Edge function: super-admin-import-tenant-admin
// Importa (ou cria) o usuário admin de um tenant a partir de dados de backup:
// cria o usuário no Auth via service role e insere/atualiza a linha em profiles
// com perfil 'admin'. Restrito a super admins.
import { createClient } from "../_shared/runtime/createClient.ts";
import { jsonResponse, errorResponse, preflight, newRequestId, createLogger } from "../_shared/hardening.ts";

interface Body {
  tenantId?: string;
  email?: string;
  nome?: string;
  telefone?: string;
  password?: string;
  unidadeIds?: string[];
  unidadeAtiva?: string;
  friendlyId?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const requestId = newRequestId(req);
  const log = createLogger("super-admin-import-tenant-admin", requestId);
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

  const tenantId = body.tenantId?.trim();
  const email = body.email?.trim().toLowerCase();
  const nome = body.nome?.trim();
  if (!tenantId || !email || !nome) return errorResponse(400, "tenantId, email, nome obrigatórios", requestId, log);

  // 1. Garante o usuário no Auth
  let userId: string | null = null;
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = list?.users.find(u => (u.email ?? "").toLowerCase() === email);
  if (existing) {
    userId = existing.id;
  } else {
    const password = body.password && body.password.length >= 8 ? body.password : crypto.randomUUID() + "Aa1!";
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: nome },
    });
    if (createErr || !created.user) return errorResponse(500, createErr?.message ?? "Falha ao criar usuário", requestId, log);
    userId = created.user.id;
  }

  // 2. Insere/atualiza profile
  const unidadeIds = (body.unidadeIds && body.unidadeIds.length > 0) ? body.unidadeIds : ["und-001"];
  const unidadeAtiva = body.unidadeAtiva || unidadeIds[0];
  const { data: existingProfile } = await admin.from("profiles").select("id").eq("user_id", userId!).maybeSingle();

  if (existingProfile) {
    const { error: upErr } = await admin.from("profiles").update({
      nome, email, perfil: "admin", tenant_id: tenantId,
      unidade_ids: unidadeIds, unidade_ativa: unidadeAtiva,
      telefone: body.telefone ?? null, status: "Ativo", updated_at: new Date().toISOString(),
    }).eq("user_id", userId!);
    if (upErr) return errorResponse(500, upErr.message, requestId, log);
  } else {
    const { error: insErr } = await admin.from("profiles").insert({
      user_id: userId,
      nome, email, perfil: "admin", tenant_id: tenantId,
      unidade_ids: unidadeIds, unidade_ativa: unidadeAtiva,
      telefone: body.telefone ?? null, status: "Ativo",
      friendly_id: body.friendlyId ?? undefined,
    });
    if (insErr) return errorResponse(500, insErr.message, requestId, log);
  }

  return jsonResponse(200, { ok: true, user_id: userId, email, tenant_id: tenantId }, requestId);
});
