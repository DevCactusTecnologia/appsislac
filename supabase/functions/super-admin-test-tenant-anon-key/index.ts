// Edge function super-admin-test-tenant-anon-key
//
// Valida se a anon key do projeto Supabase dedicado do tenant está
// corretamente cadastrada como secret no Lovable Cloud e realmente
// funciona contra o PostgREST do projeto dedicado.
//
// Faz um GET em `/rest/v1/profiles?select=user_id&limit=1` para validar se a
// anon/publishable key funciona contra a Data API do projeto dedicado e se o
// schema mínimo está exposto pelo PostgREST.
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

  if (!projectUrl) return jsonResponse(200, { ok: false, stage: "validate", error: "URL do projeto dedicado não informada" });
  if (!PROJECT_URL_RE.test(projectUrl)) {
    return jsonResponse(200, { ok: false, stage: "validate", error: "URL do projeto dedicado inválida (esperado https://<ref>.supabase.co)" });
  }
  if (!secretRef) return jsonResponse(200, { ok: false, stage: "validate", error: "Nome do secret com a anon key não informado" });
  if (!SECRET_REF_RE.test(secretRef)) {
    return jsonResponse(200, { ok: false, stage: "validate", error: "Nome do secret inválido (use UPPER_SNAKE_CASE, 3–64 chars)" });
  }

  const anon = Deno.env.get(secretRef)?.trim();
  if (!anon) {
    return jsonResponse(200, {
      ok: false,
      stage: "secret",
      error: `Secret "${secretRef}" não está cadastrado no Lovable Cloud`,
      secretRef,
    });
  }

  const profilesUrl = `${projectUrl.replace(/\/$/, "")}/rest/v1/profiles?select=user_id&limit=1`;
  const apiHeaders = { apikey: anon };

  const t0 = Date.now();
  let profilesStatus = 0;
  let profilesBodyPreview = "";
  try {
    const res = await fetch(profilesUrl, {
      method: "GET",
      // Publishable keys (`sb_publishable_...`) are not JWTs. Sending them as
      // `Authorization: Bearer ...` makes PostgREST reject an otherwise valid key.
      headers: { ...apiHeaders, Accept: "application/json" },
    });
    profilesStatus = res.status;
    profilesBodyPreview = (await res.text()).slice(0, 240);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse(200, { ok: false, stage: "fetch", error: `Falha ao contactar ${profilesUrl}: ${msg}`, projectUrl, secretRef });
  }

  // PostgREST devolve 401 quando a apikey é inválida E também quando a key é
  // válida mas o role `anon` não tem GRANT na tabela. Diferenciamos pelo corpo:
  // erro 42501 = permission denied = key OK, faltam GRANTs (schema incompleto).
  const isGrantMissing = /"?code"?\s*:\s*"?42501"?|permission denied for/i.test(profilesBodyPreview);
  if ((profilesStatus === 401 || profilesStatus === 403) && !isGrantMissing) {
    return jsonResponse(200, {
      ok: false,
      stage: "auth",
      error: `A Data API recusou a Publishable/Anon Key (HTTP ${profilesStatus}). Verifique se o valor cadastrado em "${secretRef}" pertence exatamente a este projeto dedicado.`,
      status: profilesStatus,
      projectUrl,
      secretRef,
      bodyPreview: profilesBodyPreview,
    });
  }
  if (isGrantMissing) {
    return jsonResponse(200, {
      ok: true,
      latencyMs: Date.now() - t0,
      status: profilesStatus,
      projectUrl,
      secretRef,
      schemaReady: false,
      profilesStatus,
      profilesBodyPreview,
      hint: "Publishable/Anon Key válida — PostgREST autenticou. Falta apenas GRANT SELECT em public.profiles para `anon` (será aplicado ao provisionar o schema).",
    });
  }
  if (profilesStatus >= 500) {
    return jsonResponse(200, {
      ok: false,
      stage: "server",
      error: `Data API do projeto dedicado respondeu HTTP ${profilesStatus}.`,
      status: profilesStatus,
      projectUrl,
      bodyPreview: profilesBodyPreview,
    });
  }

  const latencyMs = Date.now() - t0;
  const schemaReady = profilesStatus === 200;
  const schemaMissing = profilesStatus === 404 || /PGRST|relation|schema cache|not found/i.test(profilesBodyPreview);

  return jsonResponse(200, {
    ok: true,
    latencyMs,
    status: profilesStatus,
    projectUrl,
    secretRef,
    schemaReady,
    profilesStatus,
    profilesBodyPreview: schemaReady ? undefined : profilesBodyPreview,
    hint: schemaReady
      ? undefined
      : schemaMissing
        ? "Publishable/Anon Key válida, mas a tabela `profiles` ainda não está exposta pela Data API — provisione o schema antes de ativar o roteamento."
        : "Publishable/Anon Key aceita, mas a checagem do schema retornou um status inesperado. Verifique permissões e exposição da tabela `profiles`.",
  });
});
