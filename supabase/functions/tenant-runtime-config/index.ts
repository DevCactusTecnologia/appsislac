// Edge function: tenant-runtime-config
//
// Fase 2 — Retorna ao FRONTEND a configuração de roteamento do runtime
// para o tenant do usuário autenticado.
//
// Contract:
//   { mode: "shared" | "dedicated",
//     dedicated: { url, anon_key } | null,
//     allowed_tables: string[] }
//
// Gate (todos precisam ser true para retornar "dedicated"):
//   - tenant_registry.database_strategy = 'dedicated'
//     OR tenant_registry.runtime_mode = 'isolated_db'
//   - tenant_registry.schema_provisioned_at IS NOT NULL
//   - tenant_registry.runtime_dedicated_enabled = true
//   - db_project_url e db_anon_key_secret_ref preenchidos
//   - secret resolvível via Deno.env
//
// Qualquer falha → retorna { mode: "shared", ... } (fail-safe).
//
// Anon key é publishable e pode ir para o browser — mesmo padrão do
// VITE_SUPABASE_PUBLISHABLE_KEY do projeto shared.

import { createClient } from "../_shared/runtime/createClient.ts";
import { jsonResponse, errorResponse, preflight, newRequestId, createLogger } from "../_shared/hardening.ts";

// Allowlist inicial da Fase 2 — só estas tabelas roteiam para o dedicado.
// Precisam existir no schema provisionado (SCHEMA_MINIMO_V1).
const ALLOWED_TABLES_V1 = [
  "pacientes",
  "atendimentos",
  "atendimento_exames",
  "atendimento_pagamentos",
];

const PROJECT_URL_RE = /^https:\/\/[a-z0-9-]+\.supabase\.(co|in|net)$/i;
const SECRET_REF_RE = /^[A-Z][A-Z0-9_]{2,63}$/;

function sharedResponse(reason?: string) {
  return {
    mode: "shared" as const,
    dedicated: null,
    allowed_tables: [] as string[],
    reason: reason ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const requestId = newRequestId(req);
  const log = createLogger("tenant-runtime-config", requestId);
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
  const { data: { user }, error: uErr } = await userClient.auth.getUser();
  if (uErr || !user) return errorResponse(401, "Não autenticado", requestId, log);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Descobre o tenant do usuário via profiles.
  const { data: profile } = await admin
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const tenantId = (profile as { tenant_id?: string } | null)?.tenant_id;
  if (!tenantId) {
    return jsonResponse(200, sharedResponse("no_tenant"));
  }

  const { data: reg, error: rErr } = await admin
    .from("tenant_registry")
    .select("runtime_mode, database_strategy, runtime_dedicated_enabled, schema_provisioned_at, db_project_url, db_anon_key_secret_ref")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (rErr) {
    log.warn("registry_read_failed", { tenantId, err: rErr.message });
    return jsonResponse(200, sharedResponse("registry_read_failed"));
  }
  if (!reg) return jsonResponse(200, sharedResponse("no_registry"));

  const isDedicated = reg.database_strategy === "dedicated" || reg.runtime_mode === "isolated_db";
  if (!isDedicated) return jsonResponse(200, sharedResponse("mode_shared"));
  if (!reg.runtime_dedicated_enabled) return jsonResponse(200, sharedResponse("flag_off"));
  if (!reg.schema_provisioned_at) return jsonResponse(200, sharedResponse("not_provisioned"));

  const url = (reg.db_project_url ?? "").trim();
  const secretRef = (reg.db_anon_key_secret_ref ?? "").trim();
  if (!url || !PROJECT_URL_RE.test(url)) return jsonResponse(200, sharedResponse("invalid_url"));
  if (!secretRef || !SECRET_REF_RE.test(secretRef)) return jsonResponse(200, sharedResponse("invalid_secret_ref"));

  const anonKey = Deno.env.get(secretRef);
  if (!anonKey) {
    log.warn("secret_missing", { tenantId, secretRef });
    return jsonResponse(200, sharedResponse("secret_missing"));
  }

  log.info("routing_dedicated", { tenantId, url });
  return jsonResponse(200, {
    mode: "dedicated",
    dedicated: { url, anon_key: anonKey },
    allowed_tables: ALLOWED_TABLES_V1,
    reason: null,
  });
});
