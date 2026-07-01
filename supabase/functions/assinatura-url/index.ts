// Edge function: assinatura-url
// ----------------------------------------------------------------------------
// Retorna URL pré-assinada (1h) para a imagem de assinatura de um usuário.
// Slice 3: `profiles` e Storage permanecem no control-plane (shared).
// O `getTenantClient` é usado como probe do tenant do alvo para preparar
// futuras auditorias tenant-locais (idempotente em shared).

import {
  getPlatformClient,
  getTenantClient,
  getUserClient,
  MigrationBlockedError,
} from "../_shared/runtime/db.ts";
import {
  jsonResponse,
  errorResponse,
  preflight,
  newRequestId,
  createLogger,
} from "../_shared/hardening.ts";
import { loadS3Config, s3PresignGet, recordStorageAudit } from "../_shared/s3.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const requestId = newRequestId(req);
  const log = createLogger("assinatura-url", requestId);
  if (req.method !== "POST") return errorResponse(405, "Method not allowed", requestId, log);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return errorResponse(500, "Server misconfiguration", requestId, log);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = getUserClient(authHeader);
  const { data: { user: caller }, error: callerErr } = await userClient.auth.getUser();
  if (callerErr || !caller) return errorResponse(401, "Não autenticado", requestId, log);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return errorResponse(400, "JSON inválido", requestId, log); }
  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!userId) return errorResponse(400, "userId obrigatório", requestId, log);

  const platform = getPlatformClient();

  const { data: target } = await platform
    .from("profiles")
    .select("tenant_id, assinatura_imagem_key")
    .eq("user_id", userId)
    .maybeSingle();
  if (!target) return errorResponse(404, "Usuário não encontrado", requestId, log);
  const t = target as { tenant_id: string; assinatura_imagem_key: string | null };
  if (!t.assinatura_imagem_key) {
    return jsonResponse(200, { ok: true, url: null }, requestId);
  }

  const { data: callerProfile } = await platform
    .from("profiles").select("tenant_id").eq("user_id", caller.id).maybeSingle();
  const callerTenant = (callerProfile as { tenant_id?: string } | null)?.tenant_id;
  if (callerTenant !== t.tenant_id) {
    const { data: isSuper } = await platform.rpc("is_super_admin", { _user_id: caller.id });
    if (!isSuper) return errorResponse(403, "Sem permissão", requestId, log);
  }

  // Probe de rota tenant (garante que dedicated está acessível quando aplicável).
  try {
    await getTenantClient(t.tenant_id);
  } catch (e) {
    if (e instanceof MigrationBlockedError) {
      return errorResponse(503, `Runtime dedicado indisponível (${e.code})`, requestId, log);
    }
    throw e;
  }

  let url: string;
  let backend: "s3" | "storage" = "s3";
  let bucketLabel = "";

  if (t.assinatura_imagem_key.startsWith("storage://")) {
    const rest = t.assinatura_imagem_key.slice("storage://".length);
    const slash = rest.indexOf("/");
    const bucket = slash >= 0 ? rest.slice(0, slash) : rest;
    const path = slash >= 0 ? rest.slice(slash + 1) : "";
    backend = "storage";
    bucketLabel = bucket;
    const { data: signed, error: sErr } = await platform.storage
      .from(bucket).createSignedUrl(path, 3600);
    if (sErr || !signed?.signedUrl) {
      log.error("storage sign failed", { err: sErr?.message });
      return errorResponse(502, sErr?.message || "Falha ao assinar URL", requestId, log);
    }
    url = signed.signedUrl;
  } else {
    const s3 = await loadS3Config(SUPABASE_URL, SERVICE_KEY);
    if (!s3) return errorResponse(500, "Bucket não configurado", requestId, log);
    bucketLabel = s3.bucket;
    try {
      url = await s3PresignGet(s3, t.assinatura_imagem_key, 3600);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao assinar URL";
      log.error("presign failed", { err: msg });
      return errorResponse(502, msg, requestId, log);
    }
  }

  await recordStorageAudit(SUPABASE_URL, SERVICE_KEY, {
    tenant_id: t.tenant_id,
    user_id: caller.id,
    category: "assinaturas",
    backend,
    bucket: bucketLabel,
    object_key: t.assinatura_imagem_key,
    action: "sign_read",
    request_id: requestId,
    metadata: { target_user_id: userId },
  });

  return jsonResponse(200, { ok: true, url, expires_in: 3600 }, requestId);
});
