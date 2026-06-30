// Edge function super-admin-test-tenant-db
// Abre uma conexão Postgres real usando os metadados salvos em tenant_registry
// + a senha resolvida do secret (db_secret_ref) e executa SELECT 1.
//
// Retorna: ok, latencyMs, serverVersion, database, user, host, port.
// Nunca devolve a senha em texto.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { Client } from "https://deno.land/x/postgres@v0.19.3/mod.ts";
import { jsonResponse, errorResponse, preflight, newRequestId, createLogger } from "../_shared/hardening.ts";

const SECRET_REF_RE = /^[A-Z][A-Z0-9_]{2,63}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const requestId = newRequestId(req);
  const log = createLogger("super-admin-test-tenant-db", requestId);
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

  let body: {
    tenantId?: string;
    // Permite testar conexão antes de salvar (override):
    dbHost?: string; dbPort?: number; dbName?: string; dbUser?: string;
    dbSecretRef?: string; sslMode?: "require" | "disable";
  } = {};
  try { body = await req.json(); } catch {
    return errorResponse(400, "JSON inválido", requestId, log);
  }

  // Carrega config persistida (se houver tenantId) e mescla com overrides
  let host = body.dbHost ?? "";
  let port = body.dbPort ?? 0;
  let database = body.dbName ?? "";
  let user = body.dbUser ?? "";
  let secretRef = body.dbSecretRef ?? "";

  if (body.tenantId) {
    const { data: reg, error: regErr } = await admin
      .from("tenant_registry")
      .select("db_host, db_port, db_name, db_user, db_secret_ref")
      .eq("tenant_id", body.tenantId)
      .maybeSingle();
    if (regErr) return errorResponse(500, "Falha ao ler tenant_registry", requestId, log);
    if (reg) {
      host ||= reg.db_host ?? "";
      port ||= reg.db_port ?? 0;
      database ||= reg.db_name ?? "";
      user ||= reg.db_user ?? "";
      secretRef ||= reg.db_secret_ref ?? "";
    }
  }

  if (!host) return errorResponse(400, "Host não informado", requestId, log);
  if (!port) return errorResponse(400, "Porta não informada", requestId, log);
  if (!database) return errorResponse(400, "Database não informado", requestId, log);
  if (!user) return errorResponse(400, "Usuário não informado", requestId, log);
  if (!secretRef) return errorResponse(400, "Secret (db_secret_ref) não informado", requestId, log);
  if (!SECRET_REF_RE.test(secretRef)) return errorResponse(400, "Nome do secret inválido", requestId, log);

  const password = Deno.env.get(secretRef);
  if (!password) {
    return errorResponse(400, `Secret "${secretRef}" não está cadastrado no Lovable Cloud`, requestId, log);
  }

  const tls = body.sslMode === "disable" ? false : { enabled: true, enforce: false };
  const client = new Client({
    hostname: host,
    port,
    database,
    user,
    password,
    tls: tls as any,
    connection: { attempts: 1 },
  });

  const t0 = Date.now();
  try {
    await client.connect();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.info("connect_failed", { host, port, database, user, msg });
    return jsonResponse(200, {
      ok: false,
      stage: "connect",
      error: msg,
      host, port, database, user,
    });
  }

  try {
    const r = await client.queryObject<{ v: number; ver: string; db: string; usr: string }>(
      "select 1::int as v, version() as ver, current_database() as db, current_user as usr"
    );
    const latencyMs = Date.now() - t0;
    const row = r.rows[0];
    return jsonResponse(200, {
      ok: true,
      latencyMs,
      serverVersion: row?.ver ?? null,
      database: row?.db ?? database,
      user: row?.usr ?? user,
      host, port,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse(200, { ok: false, stage: "query", error: msg, host, port, database, user });
  } finally {
    try { await client.end(); } catch { /* noop */ }
  }
});
