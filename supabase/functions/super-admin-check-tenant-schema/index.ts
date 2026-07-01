// Edge function: super-admin-check-tenant-schema
//
// Verifica o estado do schema no banco DEDICADO do tenant.
// - Conecta usando as credenciais do tenant_registry + secret do Vault.
// - Confirma existência das tabelas core do SISLAC.
// - Retorna a última linha de _sislac_health_check (schema_version, quando).
//
// Somente Super Admin. Não modifica nada — read-only.

import { createClient } from "../_shared/runtime/createClient.ts";
import { Client } from "https://deno.land/x/postgres@v0.19.3/mod.ts";
import { jsonResponse, errorResponse, preflight, newRequestId, createLogger } from "../_shared/hardening.ts";

const SECRET_REF_RE = /^[A-Z][A-Z0-9_]{2,63}$/;

const EXPECTED_TABLES = [
  "_sislac_health_check",
  "pacientes",
  "atendimentos",
  "atendimento_exames",
  "atendimento_pagamentos",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const requestId = newRequestId(req);
  const log = createLogger("super-admin-check-tenant-schema", requestId);
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

  let body: { tenantId?: string } = {};
  try { body = await req.json(); } catch {
    return errorResponse(400, "JSON inválido", requestId, log);
  }
  if (!body.tenantId) return errorResponse(400, "tenantId obrigatório", requestId, log);

  const { data: reg, error: regErr } = await admin
    .from("tenant_registry")
    .select("db_host, db_port, db_name, db_user, db_secret_ref, runtime_mode, database_strategy, schema_provisioned_at, schema_version")
    .eq("tenant_id", body.tenantId)
    .maybeSingle();
  if (regErr) return errorResponse(500, "Falha ao ler tenant_registry", requestId, log, regErr);
  if (!reg) return errorResponse(404, "tenant_registry não encontrado", requestId, log);

  const isDedicated = reg.runtime_mode === "isolated_db" || reg.database_strategy === "dedicated";
  if (!isDedicated) {
    return jsonResponse(200, { ok: false, stage: "config", error: "Tenant é Compartilhado — não há schema dedicado" });
  }

  const secretRef = reg.db_secret_ref ?? "";
  if (!reg.db_host || !reg.db_port || !reg.db_name || !reg.db_user || !secretRef) {
    return errorResponse(400, "Metadados de conexão incompletos", requestId, log);
  }
  if (!SECRET_REF_RE.test(secretRef)) return errorResponse(400, "Nome do secret inválido", requestId, log);
  const password = Deno.env.get(secretRef);
  if (!password) return errorResponse(400, `Secret "${secretRef}" não cadastrado no Lovable Cloud`, requestId, log);

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
    return jsonResponse(200, { ok: false, stage: "connect", error: msg });
  }

  try {
    // Presença das tabelas esperadas.
    const q = await client.queryObject<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema='public' AND table_name = ANY($1)`,
      [EXPECTED_TABLES],
    );
    const found = new Set(q.rows.map((r) => r.table_name));
    const missing = EXPECTED_TABLES.filter((t) => !found.has(t));

    // Última linha do health_check (se a tabela existe).
    let lastHealth: { schema_version: string; provisioned_at: string; note: string | null } | null = null;
    if (found.has("_sislac_health_check")) {
      const h = await client.queryObject<{ schema_version: string; provisioned_at: string; note: string | null }>(
        `SELECT schema_version, provisioned_at, note
           FROM public._sislac_health_check
          ORDER BY provisioned_at DESC LIMIT 1`,
      );
      lastHealth = h.rows[0] ?? null;
    }

    // Contagens úteis para diagnóstico (safe mesmo em base recém-criada).
    const counts: Record<string, number | null> = {};
    for (const t of EXPECTED_TABLES) {
      if (t === "_sislac_health_check") continue;
      if (!found.has(t)) { counts[t] = null; continue; }
      try {
        const c = await client.queryObject<{ n: bigint }>(`SELECT COUNT(*)::bigint AS n FROM public.${t}`);
        counts[t] = Number(c.rows[0]?.n ?? 0);
      } catch {
        counts[t] = null;
      }
    }

    return jsonResponse(200, {
      ok: missing.length === 0,
      tables_expected: EXPECTED_TABLES,
      tables_found: Array.from(found),
      tables_missing: missing,
      counts,
      last_health: lastHealth,
      registry: {
        schema_provisioned_at: reg.schema_provisioned_at,
        schema_version: reg.schema_version,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.error("check_failed", { msg });
    return jsonResponse(200, { ok: false, stage: "query", error: msg });
  } finally {
    try { await client.end(); } catch { /* noop */ }
  }
});
