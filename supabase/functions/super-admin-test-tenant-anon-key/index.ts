// Edge function super-admin-test-tenant-anon-key
//
// Valida se a anon key do projeto Supabase dedicado do tenant está
// corretamente cadastrada como secret no Lovable Cloud e realmente
// funciona contra o PostgREST do projeto dedicado.
//
// Faz duas checagens separadas:
//   1. Uma tabela inexistente controlada valida SOMENTE se a publishable/anon
//      key pertence ao projeto: key válida → 404/PGRST; key inválida → auth 401.
//   2. `/_sislac_schema_health` valida se o schema já foi provisionado.
//
// Não usamos tabelas de domínio como `profiles` para validar a key, porque uma
// tabela sem GRANT/RLS ainda não pronta gera 401/403 e cria falso negativo.
//
// Nunca devolve a anon key em texto — apenas o nome do secret.

import { createClient } from "../_shared/runtime/createClient.ts";
import { jsonResponse, errorResponse, preflight, newRequestId, createLogger } from "../_shared/hardening.ts";

const SECRET_REF_RE = /^[A-Z][A-Z0-9_]{2,63}$/;
const PROJECT_URL_RE = /^https:\/\/[a-z0-9-]+\.supabase\.(co|in|net)$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const requestId = newRequestId(req);
  const log = createLogger("super-admin-test-tenant-anon-key", requestId);
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

  let body: { tenantId?: string; dbProjectUrl?: string; dbAnonKeySecretRef?: string } = {};
  try { body = await req.json(); } catch {
    return errorResponse(400, "JSON inválido", requestId, log);
  }

  let projectUrl = (body.dbProjectUrl ?? "").trim();
  let secretRef = (body.dbAnonKeySecretRef ?? "").trim();

  if (body.tenantId && (!projectUrl || !secretRef)) {
    const { data: reg, error: regErr } = await admin
      .from("tenant_registry")
      .select("db_project_url, db_anon_key_secret_ref")
      .eq("tenant_id", body.tenantId)
      .maybeSingle();
    if (regErr) return errorResponse(500, "Falha ao ler tenant_registry", requestId, log);
    if (reg) {
      projectUrl ||= (reg.db_project_url ?? "").trim();
      secretRef ||= (reg.db_anon_key_secret_ref ?? "").trim();
    }
  }

  const configHint =
    "Abra a tela do laboratório (Super Admin → Laboratórios → este tenant → aba \"Banco de dados\") e informe a URL do projeto Supabase dedicado e os nomes dos secrets (service role e anon key) antes de rodar a migração.";

  if (!projectUrl && !secretRef) {
    return jsonResponse(200, {
      ok: false,
      stage: "validate",
      code: "DEDICATED_CONFIG_MISSING",
      error: "Este tenant ainda não tem um projeto Supabase dedicado configurado.",
      hint: configHint,
    });
  }
  if (!projectUrl) {
    return jsonResponse(200, {
      ok: false,
      stage: "validate",
      code: "DEDICATED_URL_MISSING",
      error: "URL do projeto Supabase dedicado não foi cadastrada para este tenant.",
      hint: configHint,
    });
  }
  if (!PROJECT_URL_RE.test(projectUrl)) {
    return jsonResponse(200, {
      ok: false,
      stage: "validate",
      code: "DEDICATED_URL_INVALID",
      error: `A URL cadastrada (\"${projectUrl}\") não tem o formato esperado.`,
      hint: "Use o formato exato https://<project-ref>.supabase.co (sem barra final, sem /rest, sem /auth).",
    });
  }
  if (!secretRef) {
    return jsonResponse(200, {
      ok: false,
      stage: "validate",
      code: "DEDICATED_ANON_SECRET_REF_MISSING",
      error: "O nome do secret com a anon/publishable key do projeto dedicado não foi informado.",
      hint: configHint,
    });
  }
  if (!SECRET_REF_RE.test(secretRef)) {
    return jsonResponse(200, {
      ok: false,
      stage: "validate",
      code: "DEDICATED_ANON_SECRET_REF_INVALID",
      error: `Nome de secret inválido: \"${secretRef}\".`,
      hint: "Use UPPER_SNAKE_CASE com 3 a 64 caracteres (ex.: TENANT_ACME_ANON_KEY).",
    });
  }

  const anon = Deno.env.get(secretRef)?.trim();
  if (!anon) {
    return jsonResponse(200, {
      ok: false,
      stage: "secret",
      code: "DEDICATED_ANON_SECRET_NOT_SET",
      error: `Secret \"${secretRef}\" não está cadastrado no Lovable Cloud.`,
      hint: `Cadastre o secret \"${secretRef}\" com a anon/publishable key do projeto dedicado nas configurações do Lovable Cloud e execute o teste novamente.`,
      secretRef,
    });
  }

  const baseUrl = projectUrl.replace(/\/$/, "");
  const keyProbeUrl = `${baseUrl}/rest/v1/__sislac_key_probe__?select=id&limit=1`;
  const healthUrl = `${baseUrl}/rest/v1/_sislac_schema_health?select=schema_version,provisioned_at&limit=1`;
  const apiHeaders = { apikey: anon };

  const t0 = Date.now();
  let authStatus = 0;
  let authBodyPreview = "";
  try {
    const res = await fetch(keyProbeUrl, {
      method: "GET",
      // Publishable keys (`sb_publishable_...`) are not JWTs. Sending them as
      // `Authorization: Bearer ...` makes PostgREST reject an otherwise valid key.
      headers: { ...apiHeaders, Accept: "application/json" },
    });
    authStatus = res.status;
    authBodyPreview = (await res.text()).slice(0, 240);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse(200, {
      ok: false,
      stage: "fetch",
      code: "DEDICATED_UNREACHABLE",
      error: `Não foi possível contactar o projeto dedicado (${keyProbeUrl}).`,
      hint: `Confirme que a URL está correta e que o projeto Supabase está ativo. Detalhe técnico: ${msg}`,
      projectUrl,
      secretRef,
    });
  }

  const authProbeAccepted =
    authStatus === 404 ||
    /PGRST|relation|schema cache|not found|permission denied|42501/i.test(authBodyPreview);
  if ((authStatus === 401 || authStatus === 403) && !authProbeAccepted) {
    return jsonResponse(200, {
      ok: false,
      stage: "auth",
      code: "DEDICATED_ANON_KEY_REJECTED",
      error: `A Data API do projeto dedicado recusou a chave (HTTP ${authStatus}).`,
      hint: `Verifique se o valor cadastrado no secret \"${secretRef}\" é exatamente a anon/publishable key deste projeto dedicado (não a service_role, e não de outro projeto).`,
      status: authStatus,
      projectUrl,
      secretRef,
      bodyPreview: authBodyPreview,
    });
  }
  if (!authProbeAccepted && authStatus >= 500) {
    return jsonResponse(200, {
      ok: false,
      stage: "server",
      code: "DEDICATED_DATA_API_ERROR",
      error: `A Data API do projeto dedicado respondeu HTTP ${authStatus}.`,
      hint: "O projeto dedicado pode estar reiniciando ou com incidente. Aguarde alguns minutos e tente novamente.",
      status: authStatus,
      projectUrl,
      bodyPreview: authBodyPreview,
    });
  }

  let healthStatus = 0;
  let healthBodyPreview = "";
  try {
    const health = await fetch(healthUrl, {
      method: "GET",
      headers: { ...apiHeaders, Accept: "application/json" },
    });
    healthStatus = health.status;
    healthBodyPreview = (await health.text()).slice(0, 240);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse(200, {
      ok: true,
      latencyMs: Date.now() - t0,
      status: authStatus,
      projectUrl,
      secretRef,
      schemaReady: false,
      healthStatus,
      hint: `Publishable/Anon Key válida, mas não foi possível verificar o schema health: ${msg}`,
    });
  }

  const latencyMs = Date.now() - t0;
  const schemaReady = healthStatus === 200;
  const schemaMissing = healthStatus === 404 || /PGRST|relation|schema cache|not found/i.test(healthBodyPreview);
  const schemaPermissionMissing = (healthStatus === 401 || healthStatus === 403) && /"?code"?\s*:\s*"?42501"?|permission denied for/i.test(healthBodyPreview);

  return jsonResponse(200, {
    ok: true,
    latencyMs,
    status: authStatus,
    projectUrl,
    secretRef,
    schemaReady,
    authStatus,
    healthStatus,
    healthBodyPreview: schemaReady ? undefined : healthBodyPreview,
    hint: schemaReady
      ? undefined
      : schemaMissing || schemaPermissionMissing
        ? "Publishable/Anon Key válida. O schema dedicado ainda não está provisionado/pronto — execute Provisionar schema."
        : "Publishable/Anon Key válida, mas a checagem do schema health retornou status inesperado. Rode Provisionar schema para recriar grants e sentinela.",
  });
});
