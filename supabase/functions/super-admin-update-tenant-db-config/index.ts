// Edge function super-admin-update-tenant-db-config
// Onda B — Control Plane multi-database (cadastro manual de banco).
//
// Persiste apenas METADADOS de conexão em public.tenant_registry:
//   db_provider, db_host, db_port, db_name, db_user, db_region,
//   db_secret_ref, runtime_mode, database_strategy.
//
// IMPORTANTE: a senha do banco NUNCA é persistida em texto. O super admin
// cadastra a senha como secret no Lovable Cloud e informa apenas o NOME
// do secret aqui (db_secret_ref). O runtime resolverá via Secrets em runtime.

import { createClient } from "../_shared/runtime/createClient.ts";
import { jsonResponse, errorResponse, preflight, newRequestId, createLogger } from "../_shared/hardening.ts";

interface Body {
  tenantId?: unknown;
  dbProvider?: unknown;
  dbHost?: unknown;
  dbPort?: unknown;
  dbName?: unknown;
  dbUser?: unknown;
  dbRegion?: unknown;
  dbSecretRef?: unknown;
  dbProjectUrl?: unknown;
  dbAnonKeySecretRef?: unknown;
  runtimeMode?: unknown;
  databaseStrategy?: unknown;
  runtimeDedicatedEnabled?: unknown;
}

const ALLOWED_PROVIDERS = ["shared_supabase", "neon", "supabase_project", "external_postgres"];
const ALLOWED_MODES = ["shared_db", "isolated_db"];
const ALLOWED_STRATEGIES = ["shared", "dedicated"];
const SECRET_REF_RE = /^[A-Z][A-Z0-9_]{2,63}$/;
const PROJECT_URL_RE = /^https:\/\/[a-z0-9-]+\.supabase\.(co|in|net)$/i;


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const requestId = newRequestId(req);
  const log = createLogger("super-admin-update-tenant-db-config", requestId);
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
  const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
  if (!tenantId) return errorResponse(400, "tenantId obrigatório", requestId, log);

  const updates: Record<string, unknown> = {};

  if (body.dbProvider !== undefined) {
    if (body.dbProvider === null || body.dbProvider === "") {
      updates.db_provider = null;
    } else if (typeof body.dbProvider === "string" && ALLOWED_PROVIDERS.includes(body.dbProvider)) {
      updates.db_provider = body.dbProvider;
    } else {
      return errorResponse(400, "dbProvider inválido", requestId, log);
    }
  }
  if (body.dbHost !== undefined) {
    if (body.dbHost === null || body.dbHost === "") updates.db_host = null;
    else if (typeof body.dbHost === "string" && body.dbHost.length <= 253) updates.db_host = body.dbHost.trim();
    else return errorResponse(400, "dbHost inválido", requestId, log);
  }
  if (body.dbPort !== undefined) {
    if (body.dbPort === null || body.dbPort === "") updates.db_port = null;
    else {
      const n = Number(body.dbPort);
      if (!Number.isInteger(n) || n < 1 || n > 65535) return errorResponse(400, "dbPort inválido", requestId, log);
      updates.db_port = n;
    }
  }
  if (body.dbName !== undefined) {
    if (body.dbName === null || body.dbName === "") updates.db_name = null;
    else if (typeof body.dbName === "string" && body.dbName.length <= 128) updates.db_name = body.dbName.trim();
    else return errorResponse(400, "dbName inválido", requestId, log);
  }
  if (body.dbUser !== undefined) {
    if (body.dbUser === null || body.dbUser === "") updates.db_user = null;
    else if (typeof body.dbUser === "string" && body.dbUser.length <= 128) updates.db_user = body.dbUser.trim();
    else return errorResponse(400, "dbUser inválido", requestId, log);
  }
  if (body.dbRegion !== undefined) {
    if (body.dbRegion === null || body.dbRegion === "") updates.db_region = null;
    else if (typeof body.dbRegion === "string" && body.dbRegion.length <= 64) updates.db_region = body.dbRegion.trim();
    else return errorResponse(400, "dbRegion inválido", requestId, log);
  }
  if (body.dbSecretRef !== undefined) {
    if (body.dbSecretRef === null || body.dbSecretRef === "") {
      updates.db_secret_ref = null;
    } else if (typeof body.dbSecretRef === "string" && SECRET_REF_RE.test(body.dbSecretRef)) {
      updates.db_secret_ref = body.dbSecretRef;
    } else {
      return errorResponse(400, "dbSecretRef inválido (use UPPER_SNAKE_CASE)", requestId, log);
    }
  }
  if (body.dbProjectUrl !== undefined) {
    if (body.dbProjectUrl === null || body.dbProjectUrl === "") {
      updates.db_project_url = null;
    } else if (typeof body.dbProjectUrl === "string" && PROJECT_URL_RE.test(body.dbProjectUrl.trim())) {
      updates.db_project_url = body.dbProjectUrl.trim();
    } else {
      return errorResponse(400, "dbProjectUrl inválido (esperado https://<ref>.supabase.co)", requestId, log);
    }
  }
  if (body.dbAnonKeySecretRef !== undefined) {
    if (body.dbAnonKeySecretRef === null || body.dbAnonKeySecretRef === "") {
      updates.db_anon_key_secret_ref = null;
    } else if (typeof body.dbAnonKeySecretRef === "string" && SECRET_REF_RE.test(body.dbAnonKeySecretRef)) {
      updates.db_anon_key_secret_ref = body.dbAnonKeySecretRef;
    } else {
      return errorResponse(400, "dbAnonKeySecretRef inválido (use UPPER_SNAKE_CASE)", requestId, log);
    }
  }

  if (body.runtimeMode !== undefined) {
    if (typeof body.runtimeMode === "string" && ALLOWED_MODES.includes(body.runtimeMode)) {
      updates.runtime_mode = body.runtimeMode;
      // mantém database_strategy coerente
      updates.database_strategy = body.runtimeMode === "isolated_db" ? "dedicated" : "shared";
    } else {
      return errorResponse(400, "runtimeMode inválido", requestId, log);
    }
  }
  if (body.databaseStrategy !== undefined) {
    if (typeof body.databaseStrategy === "string" && ALLOWED_STRATEGIES.includes(body.databaseStrategy)) {
      updates.database_strategy = body.databaseStrategy;
    } else {
      return errorResponse(400, "databaseStrategy inválido", requestId, log);
    }
  }

  if (Object.keys(updates).length === 0) return errorResponse(400, "Nada para atualizar", requestId, log);

  // Garante que o registry exista (idempotente).
  const { data: existing, error: selErr } = await admin
    .from("tenant_registry")
    .select("tenant_id, slug")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (selErr) return errorResponse(500, "Erro ao consultar registry", requestId, log, selErr);
  if (!existing) return errorResponse(404, "tenant_registry não encontrado para esse tenant", requestId, log);

  const { data, error } = await admin
    .from("tenant_registry")
    .update(updates)
    .eq("tenant_id", tenantId)
    .select()
    .single();
  if (error) return errorResponse(500, "Erro ao atualizar configuração de banco", requestId, log, error);

  // Espelha database_strategy na tabela legada `tenants` para evitar divergência.
  if (updates.database_strategy !== undefined) {
    const { error: mirrorErr } = await admin
      .from("tenants")
      .update({ database_strategy: updates.database_strategy })
      .eq("id", tenantId);
    if (mirrorErr) log.warn("Falha ao espelhar database_strategy em tenants", { tenantId, error: mirrorErr.message });
  }

  log.info("tenant_registry db config atualizado", { tenantId, fields: Object.keys(updates) });
  return jsonResponse(200, { ok: true, registry: data }, requestId);
});