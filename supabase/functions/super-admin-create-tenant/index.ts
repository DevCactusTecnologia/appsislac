// Edge function super-admin-create-tenant
// ----------------------------------------------------------------------------
// Cria um novo tenant (laboratório) e convida o admin inicial via e-mail.
// O admin convidado já entra com profile vinculado ao tenant + role 'admin'.
// Caller DEVE ser super_admin.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  jsonResponse,
  errorResponse,
  preflight,
  newRequestId,
  createLogger,
} from "../_shared/hardening.ts";

interface Body {
  nome?: unknown;
  slug?: unknown;
  cnpj?: unknown;
  emailContato?: unknown;
  telefone?: unknown;
  plano?: unknown;
  labCode?: unknown;
  adminEmail?: unknown;
  adminNome?: unknown;
  adminSenha?: unknown;
}

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const requestId = newRequestId(req);
  const log = createLogger("super-admin-create-tenant", requestId);

  if (req.method !== "POST") return errorResponse(405, "Method not allowed", requestId, log);

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
  if (callerErr || !caller) return errorResponse(401, "Não autenticado", requestId, log);

  // 2. Verifica super_admin
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: isSuper, error: rErr } = await admin.rpc("is_super_admin", { _user_id: caller.id });
  if (rErr) return errorResponse(500, "Falha ao validar permissão", requestId, log, rErr);
  if (!isSuper) return errorResponse(403, "Apenas super admins podem criar tenants", requestId, log);

  // 3. Valida body
  let body: Body;
  try { body = await req.json() as Body; } catch {
    return errorResponse(400, "JSON inválido", requestId, log);
  }
  const nome = typeof body.nome === "string" ? body.nome.trim() : "";
  const slugInput = typeof body.slug === "string" ? body.slug.trim() : "";
  const adminEmail = typeof body.adminEmail === "string" ? body.adminEmail.trim().toLowerCase() : "";
  const adminNome = typeof body.adminNome === "string" ? body.adminNome.trim() : "";
  const adminSenha = typeof body.adminSenha === "string" ? body.adminSenha : "";
  if (!nome) return errorResponse(400, "Nome do laboratório obrigatório", requestId, log);
  if (!adminEmail || !adminEmail.includes("@")) return errorResponse(400, "Email do admin inválido", requestId, log);
  if (!adminNome) return errorResponse(400, "Nome do admin obrigatório", requestId, log);
  if (adminSenha && adminSenha.length < 6) {
    return errorResponse(400, "Senha do admin deve ter pelo menos 6 caracteres", requestId, log);
  }

  const slug = slugify(slugInput || nome);
  const cnpj = typeof body.cnpj === "string" ? body.cnpj.trim() : "";
  const emailContato = typeof body.emailContato === "string" ? body.emailContato.trim() : adminEmail;
  const telefone = typeof body.telefone === "string" ? body.telefone.trim() : "";
  const plano = typeof body.plano === "string" ? body.plano : "free";

  // lab_code humano opcional (ex.: "SJMED"). Se vazio, o trigger
  // tenant_registry_lab_code_guard gera LAB### automaticamente.
  let labCode: string | null = null;
  if (typeof body.labCode === "string" && body.labCode.trim()) {
    const normalized = body.labCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!/^[A-Z0-9]{3,12}$/.test(normalized)) {
      return errorResponse(400, "Código do laboratório inválido (3 a 12 caracteres A-Z/0-9)", requestId, log);
    }
    labCode = normalized;
  }

  // 4. Cria tenant
  const { data: tenant, error: tErr } = await admin
    .from("tenants")
    .insert({
      nome, slug, cnpj, email_contato: emailContato, telefone,
      plano, status: "ativo", created_by: caller.id,
    })
    .select()
    .single();
  if (tErr || !tenant) {
    log.warn("tenant insert falhou", { err: tErr?.message });
    return errorResponse(400, tErr?.message ?? "Falha ao criar tenant", requestId, log);
  }

  // 4b. Se o operador informou um lab_code custom, sobrescreve o gerado
  //     pelo trigger (auto-insert do tenant_registry). lab_code é imutável
  //     APÓS este ponto — depois disso o guard bloqueia mudanças.
  if (labCode) {
    const { error: lcErr } = await admin
      .from("tenant_registry")
      .update({ lab_code: labCode })
      .eq("tenant_id", tenant.id);
    if (lcErr) {
      log.warn("override lab_code falhou", { err: lcErr.message });
    }
  }

  // Lê o lab_code final (custom ou auto) para devolver ao front
  const { data: regRow } = await admin
    .from("tenant_registry")
    .select("lab_code")
    .eq("tenant_id", tenant.id)
    .maybeSingle();
  const finalLabCode = (regRow as { lab_code?: string } | null)?.lab_code ?? null;

  // 5. Cria unidade padrão
  const { error: uErr } = await admin.from("unidades").insert({
    id: `und-${tenant.id.slice(0, 6)}`,
    nome: nome + " - Sede",
    tipo: "SEDE",
    padrao: true,
    ativo: true,
    tenant_id: tenant.id,
  });
  if (uErr) log.warn("unidade padrão falhou", { err: uErr.message });

  // 6. Seed dos mapas de trabalho padrão (copia do tenant template)
  const { data: seededMapas, error: seedErr } = await admin.rpc(
    "seed_default_mapas_for_tenant",
    { _tenant_id: tenant.id },
  );
  if (seedErr) {
    log.warn("seed mapas padrão falhou", { err: seedErr.message });
  } else {
    log.info("seed mapas padrão", { tenantId: tenant.id, inseridos: seededMapas });
  }

  // 6b. Seed das formas de pagamento padrão (Dinheiro, PIX, Débito, Crédito)
  const { data: seededFormas, error: seedFormasErr } = await admin.rpc(
    "seed_default_formas_pagamento_for_tenant",
    { _tenant_id: tenant.id },
  );
  if (seedFormasErr) {
    log.warn("seed formas pagamento falhou", { err: seedFormasErr.message });
  } else {
    log.info("seed formas pagamento", { tenantId: tenant.id, inseridos: seededFormas });
  }

  // 7. Cria o admin: se senha foi fornecida, cria já com senha (sem convite por e-mail);
  //    caso contrário, envia convite por e-mail para o admin definir a própria senha.
  let adminUserId: string | null = null;
  let warning: string | undefined;

  if (adminSenha) {
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: adminEmail,
      password: adminSenha,
      email_confirm: true,
      user_metadata: { full_name: adminNome, tenant_id: tenant.id, perfil: "admin" },
    });
    if (cErr || !created?.user) {
      log.warn("createUser falhou", { err: cErr?.message });
      return jsonResponse(200, {
        ok: true, tenant,
        warning: "Tenant criado, mas criação do admin falhou: " + (cErr?.message ?? "?"),
      }, requestId);
    }
    adminUserId = created.user.id;
  } else {
    const redirectTo = `${new URL(req.url).origin.replace(/\/functions.*/, "")}/reset-password`;
    const { data: inviteData, error: invErr } = await admin.auth.admin.inviteUserByEmail(adminEmail, {
      data: { full_name: adminNome, tenant_id: tenant.id, perfil: "admin" },
      redirectTo,
    });
    if (invErr || !inviteData?.user) {
      log.warn("invite falhou", { err: invErr?.message });
      return jsonResponse(200, {
        ok: true, tenant, warning: "Tenant criado, mas convite falhou: " + (invErr?.message ?? "?"),
      }, requestId);
    }
    adminUserId = inviteData.user.id;
  }

  // 8. Garante role 'admin' para o usuário criado
  await admin.from("user_roles").upsert(
    { user_id: adminUserId, role: "admin" },
    { onConflict: "user_id,role" },
  );

  log.info("tenant criado", { tenantId: tenant.id, adminEmail, viaSenha: !!adminSenha });
  return jsonResponse(200, {
    ok: true,
    tenant: { ...tenant, lab_code: finalLabCode },
    labCode: finalLabCode,
    adminUserId,
    warning,
  }, requestId);
});
