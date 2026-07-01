// Edge function: tenant-dedicated-login-gate
//
// Bloqueia login operacional quando o tenant já está com runtime dedicado
// ligado, mas o banco dedicado ainda não recebeu a base real do laboratório.
//
// Auth continua no projeto compartilhado; por isso a autenticação de senha pode
// passar mesmo sem dados no dedicado. Este gate faz a prova de existência do
// usuário em public.profiles do banco dedicado via conexão Postgres direta.

import { createClient } from "../_shared/runtime/createClient.ts";
import { Client } from "https://deno.land/x/postgres@v0.19.3/mod.ts";
import { jsonResponse, errorResponse, preflight, newRequestId, createLogger } from "../_shared/hardening.ts";

const SECRET_REF_RE = /^[A-Z][A-Z0-9_]{2,63}$/;
const PROJECT_URL_RE = /^https:\/\/[a-z0-9-]+\.supabase\.(co|in|net)$/i;

function okShared(reason: string) {
  return { ok: true, mode: "shared" as const, reason };
}

function block(error: string, code: string) {
  return { ok: false, mode: "dedicated" as const, code, error };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const requestId = newRequestId(req);
  const log = createLogger("tenant-dedicated-login-gate", requestId);
  if (req.method !== "POST" && req.method !== "GET") {
    return errorResponse(405, "Method not allowed", requestId, log);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    return errorResponse(500, "Server misconfiguration", requestId, log);
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return errorResponse(401, "Não autenticado", requestId, log);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: sharedProfile, error: profileErr } = await admin
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profileErr) return errorResponse(500, "Falha ao validar perfil", requestId, log, profileErr);

  const tenantId = (sharedProfile as { tenant_id?: string } | null)?.tenant_id;
  if (!tenantId) return jsonResponse(200, okShared("no_tenant"), requestId);

  const { data: reg, error: regErr } = await admin
    .from("tenant_registry")
    .select("runtime_mode, database_strategy, runtime_dedicated_enabled, schema_provisioned_at, db_host, db_port, db_name, db_user, db_secret_ref, db_project_url, db_anon_key_secret_ref")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (regErr) return errorResponse(500, "Falha ao validar configuração do laboratório", requestId, log, regErr);
  if (!reg) return jsonResponse(200, okShared("no_registry"), requestId);

  const isDedicated = reg.database_strategy === "dedicated" || reg.runtime_mode === "isolated_db";
  if (!isDedicated) return jsonResponse(200, okShared("mode_shared"), requestId);
  if (!reg.runtime_dedicated_enabled) return jsonResponse(200, okShared("flag_off"), requestId);
  if (!reg.schema_provisioned_at) {
    return jsonResponse(200, block(
      "Banco dedicado ativo, mas o schema dedicado ainda não foi provisionado/importado. Login bloqueado para evitar uso do banco compartilhado.",
      "dedicated_not_provisioned",
    ), requestId);
  }

  const projectUrl = (reg.db_project_url ?? "").trim();
  const anonSecretRef = (reg.db_anon_key_secret_ref ?? "").trim();
  if (!projectUrl || !PROJECT_URL_RE.test(projectUrl)) {
    return jsonResponse(200, block(
      "Banco dedicado ativo, mas a URL do projeto Supabase dedicado está ausente ou inválida. Login bloqueado para evitar fallback no compartilhado.",
      "dedicated_project_url_invalid",
    ), requestId);
  }
  if (!anonSecretRef || !SECRET_REF_RE.test(anonSecretRef)) {
    return jsonResponse(200, block(
      "Banco dedicado ativo, mas o secret da anon key dedicada está ausente ou inválido. Login bloqueado para evitar fallback no compartilhado.",
      "dedicated_anon_secret_invalid",
    ), requestId);
  }
  if (!Deno.env.get(anonSecretRef)) {
    return jsonResponse(200, block(
      `Banco dedicado ativo, mas o secret "${anonSecretRef}" da anon key dedicada não está cadastrado no Lovable Cloud.`,
      "dedicated_anon_secret_missing",
    ), requestId);
  }

  const secretRef = (reg.db_secret_ref ?? "").trim();
  if (!reg.db_host || !reg.db_port || !reg.db_name || !reg.db_user || !secretRef) {
    return jsonResponse(200, block(
      "Banco dedicado ativo, mas os metadados de conexão estão incompletos. Corrija a configuração no Super Admin.",
      "dedicated_connection_metadata_incomplete",
    ), requestId);
  }
  if (!SECRET_REF_RE.test(secretRef)) {
    return jsonResponse(200, block(
      "Banco dedicado ativo, mas o secret da senha está inválido. Corrija a configuração no Super Admin.",
      "invalid_secret_ref",
    ), requestId);
  }
  const password = Deno.env.get(secretRef);
  if (!password) {
    return jsonResponse(200, block(
      `Banco dedicado ativo, mas o secret "${secretRef}" não está cadastrado no Lovable Cloud.`,
      "secret_missing",
    ), requestId);
  }

  const client = new Client({
    hostname: reg.db_host,
    port: reg.db_port,
    database: reg.db_name,
    user: reg.db_user,
    password,
    tls: { enabled: true, enforce: false } as any,
    connection: { attempts: 1 },
  });

  try {
    await client.connect();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.warn("dedicated_connect_failed", { tenantId, msg });
    return jsonResponse(200, block(
      "Banco dedicado ativo, mas não foi possível conectar nele. Login bloqueado para evitar fallback no compartilhado.",
      "dedicated_connect_failed",
    ), requestId);
  }

  try {
    const table = await client.queryObject<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'profiles'
       ) AS exists`,
    );
    if (!table.rows[0]?.exists) {
      return jsonResponse(200, block(
        "Banco dedicado ativo, mas a base real ainda não foi importada: tabela de usuários (profiles) ausente no dedicado.",
        "dedicated_profiles_table_missing",
      ), requestId);
    }

    const profile = await client.queryObject<{ status: string | null; tenant_id: string | null }>(
      `SELECT status, tenant_id::text AS tenant_id
         FROM public.profiles
        WHERE user_id = $1::uuid
        LIMIT 1`,
      [user.id],
    );
    const row = profile.rows[0] ?? null;
    if (!row) {
      return jsonResponse(200, block(
        "Banco dedicado ativo, mas este usuário ainda não existe no banco dedicado. Importe/migre os dados antes de liberar o login.",
        "dedicated_user_not_migrated",
      ), requestId);
    }
    if (row.tenant_id && row.tenant_id !== tenantId) {
      log.warn("dedicated_profile_tenant_mismatch", { tenantId, dedicatedTenantId: row.tenant_id, userId: user.id });
      return jsonResponse(200, block(
        "Banco dedicado ativo, mas o usuário importado pertence a outro laboratório. Login bloqueado.",
        "dedicated_profile_tenant_mismatch",
      ), requestId);
    }
    if (row.status === "Inativo") {
      return jsonResponse(200, block(
        "Sua conta está inativa no banco dedicado deste laboratório.",
        "dedicated_user_inactive",
      ), requestId);
    }

    return jsonResponse(200, { ok: true, mode: "dedicated", tenant_id: tenantId }, requestId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.warn("dedicated_gate_query_failed", { tenantId, msg });
    return jsonResponse(200, block(
      "Banco dedicado ativo, mas a validação dos usuários falhou. Login bloqueado para evitar uso do banco compartilhado.",
      "dedicated_gate_query_failed",
    ), requestId);
  } finally {
    try { await client.end(); } catch { /* noop */ }
  }
});