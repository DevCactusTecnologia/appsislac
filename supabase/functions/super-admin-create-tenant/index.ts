// Edge function super-admin-create-tenant
// ----------------------------------------------------------------------------
// Cria um novo tenant (laboratório) e convida o admin inicial via e-mail.
// O admin convidado já entra com profile vinculado ao tenant + role 'admin'.
// Caller DEVE ser super_admin.

import { createClient } from "../_shared/runtime/createClient.ts";
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

/**
 * Validar CNPJ usando dígito verificador
 * CNPJ deve ter 14 dígitos
 */
function isValidCNPJ(cnpj: string): boolean {
  if (!cnpj || cnpj.length !== 14 || !/^\d+$/.test(cnpj)) {
    return false;
  }

  // Validar dígitos verificadores
  // Primeiro dígito
  let sum = 0;
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cnpj[i]) * weights1[i];
  }
  const digit1 = 11 - (sum % 11);
  const d1 = digit1 >= 10 ? 0 : digit1;

  if (parseInt(cnpj[12]) !== d1) {
    return false;
  }

  // Segundo dígito
  sum = 0;
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3];
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cnpj[i]) * weights2[i];
  }
  const digit2 = 11 - (sum % 11);
  const d2 = digit2 >= 10 ? 0 : digit2;

  if (parseInt(cnpj[13]) !== d2) {
    return false;
  }

  return true;
}

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
  
  // ✅ VALIDAÇÃO 1: Nome obrigatório
  if (!nome) return errorResponse(400, "Nome do laboratório obrigatório", requestId, log);
  
  // ✅ VALIDAÇÃO 2: Email válido (regex rigoroso)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!adminEmail || !emailRegex.test(adminEmail)) {
    return errorResponse(400, "Email do admin inválido (ex: usuario@empresa.com.br)", requestId, log);
  }
  
  // ✅ VALIDAÇÃO 3: Nome do admin
  if (!adminNome) return errorResponse(400, "Nome do admin obrigatório", requestId, log);
  
  // ✅ VALIDAÇÃO 4: Senha — sem regras de complexidade (aceita qualquer valor não-vazio).
  //    O Supabase Auth ainda aplica o mínimo configurado no projeto.


  const slug = slugify(slugInput || nome);
  
  // ✅ VALIDAÇÃO 5: CNPJ — apenas normaliza para dígitos; sem checagem de DV.
  let cnpj = typeof body.cnpj === "string" ? body.cnpj.trim() : "";
  if (cnpj) {
    cnpj = cnpj.replace(/[^\d]/g, "");
  }

  
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
  //
  //    IMPORTANTE: Se admin falhar, TODA a operação falha (não continuamos!)
  let adminUserId: string | null = null;

  if (adminSenha) {
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: adminEmail,
      password: adminSenha,
      email_confirm: true,
      user_metadata: { full_name: adminNome, tenant_id: tenant.id, perfil: "admin" },
    });
    if (cErr || !created?.user) {
      // ✅ CRÍTICO: Falhar aqui! Admin é essencial!
      // Fazer ROLLBACK: deletar tenant que foi criado
      log.error("createUser falhou", { err: cErr?.message, tenantId: tenant.id });
      
      await admin.from("tenants").delete().eq("id", tenant.id);
      
      return errorResponse(
        500,
        `Falha ao criar admin: ${cErr?.message ?? "desconhecido"}. Tenant foi deletado para manter consistência.`,
        requestId,
        log,
        cErr
      );
    }
    adminUserId = created.user.id;
  } else {
    const redirectTo = `${new URL(req.url).origin.replace(/\/functions.*/, "")}/reset-password`;
    const { data: inviteData, error: invErr } = await admin.auth.admin.inviteUserByEmail(adminEmail, {
      data: { full_name: adminNome, tenant_id: tenant.id, perfil: "admin" },
      redirectTo,
    });
    if (invErr || !inviteData?.user) {
      // ✅ CRÍTICO: Falhar aqui também!
      log.error("invite falhou", { err: invErr?.message, tenantId: tenant.id });
      
      await admin.from("tenants").delete().eq("id", tenant.id);
      
      return errorResponse(
        500,
        `Falha ao enviar convite: ${invErr?.message ?? "desconhecido"}. Tenant foi deletado para manter consistência.`,
        requestId,
        log,
        invErr
      );
    }
    adminUserId = inviteData.user.id;
  }

  // 8. Validar que user_id foi realmente criado
  if (!adminUserId) {
    log.error("adminUserId é null após criação", { tenantId: tenant.id });
    await admin.from("tenants").delete().eq("id", tenant.id);
    
    return errorResponse(
      500,
      "Falha crítica: user ID não foi retornado. Tenant foi deletado.",
      requestId,
      log
    );
  }

  // 9. Garante role 'admin' para o usuário criado
  const { error: roleErr } = await admin.from("user_roles").upsert(
    { user_id: adminUserId, role: "admin" },
    { onConflict: "user_id,role" },
  );

  if (roleErr) {
    log.error("falha ao criar role admin", { err: roleErr.message, userId: adminUserId, tenantId: tenant.id });
    
    // ✅ Limpar: deletar user criado
    await admin.auth.admin.deleteUser(adminUserId);
    await admin.from("tenants").delete().eq("id", tenant.id);
    
    return errorResponse(
      500,
      "Falha ao atribuir role admin. Tenant e user foram deletados.",
      requestId,
      log,
      roleErr
    );
  }

  // 9.1 Garante row em profiles (snapshot/admin panel dependem)
  const { error: profErr } = await admin.from("profiles").upsert(
    {
      user_id: adminUserId,
      tenant_id: tenant.id,
      email: adminEmail,
      nome: adminNome,
      perfil: "admin",
      status: "Ativo",
      unidade_ids: [],
      unidade_ativa: "",
      permissoes_extras: [],
      permissoes_revogadas: [],
    },
    { onConflict: "user_id" },
  );
  if (profErr) {
    log.warn("profiles upsert falhou (não crítico)", { err: profErr.message, userId: adminUserId, tenantId: tenant.id });
  }

  log.info("tenant criado com sucesso", { 
    tenantId: tenant.id, 
    adminEmail, 
    adminUserId,
    labCode: finalLabCode 
  });
  
  return jsonResponse(200, {
    ok: true,
    tenant: { ...tenant, lab_code: finalLabCode },
    labCode: finalLabCode,
    adminUserId,
  }, requestId);
});
