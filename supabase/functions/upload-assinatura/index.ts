// Edge function: upload-assinatura
// Slice 3: `profiles` continua control-plane (identity). Probe do tenant via
// `getTenantClient` valida acessibilidade em modo dedicated.

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
import {
  buildObjectKey,
  loadS3Config,
  s3PutObject,
  recordStorageAudit,
} from "../_shared/s3.ts";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/jpg"]);

function decodeBase64(b64: string): Uint8Array {
  const clean = b64.replace(/^data:[^;]+;base64,/, "").replace(/\s+/g, "");
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const requestId = newRequestId(req);
  const log = createLogger("upload-assinatura", requestId);
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

  if (userId !== caller.id) {
    const { data: isAdmin, error: roleErr } = await platform.rpc("has_role", {
      _user_id: caller.id,
      _role: "admin",
    });
    if (roleErr) return errorResponse(500, "Falha ao validar permissão", requestId, log);
    if (!isAdmin) return errorResponse(403, "Sem permissão para alterar este usuário", requestId, log);
  }

  const { data: targetProfile, error: tpErr } = await platform
    .from("profiles")
    .select("tenant_id, assinatura_imagem_key")
    .eq("user_id", userId)
    .maybeSingle();
  if (tpErr || !targetProfile) {
    return errorResponse(404, "Usuário não encontrado", requestId, log);
  }
  const tenantId = (targetProfile as { tenant_id: string }).tenant_id;

  try {
    await getTenantClient(tenantId);
  } catch (e) {
    if (e instanceof MigrationBlockedError) {
      return errorResponse(503, `Runtime dedicado indisponível (${e.code})`, requestId, log);
    }
    throw e;
  }

  if (body.remove === true) {
    const { error: upErr } = await platform
      .from("profiles")
      .update({ assinatura_imagem_key: null, assinatura_tipo: "carimbo" })
      .eq("user_id", userId);
    if (upErr) return errorResponse(500, "Falha ao remover: " + upErr.message, requestId, log);
    log.info("assinatura removida", { userId });
    return jsonResponse(200, { ok: true, removed: true }, requestId);
  }

  const filename = typeof body.filename === "string" ? body.filename : "assinatura.png";
  const contentType = typeof body.contentType === "string" ? body.contentType : "";
  const dataB64 = typeof body.dataBase64 === "string" ? body.dataBase64 : "";
  if (!ALLOWED_MIME.has(contentType.toLowerCase())) {
    return errorResponse(400, "Tipo de arquivo não suportado (PNG ou JPEG)", requestId, log);
  }
  if (!dataB64) return errorResponse(400, "dataBase64 obrigatório", requestId, log);

  let bytes: Uint8Array;
  try { bytes = decodeBase64(dataB64); } catch {
    return errorResponse(400, "dataBase64 inválido", requestId, log);
  }
  if (bytes.byteLength === 0) return errorResponse(400, "Arquivo vazio", requestId, log);
  if (bytes.byteLength > MAX_BYTES) {
    return errorResponse(400, "Arquivo excede 2 MB", requestId, log);
  }

  const s3 = await loadS3Config(SUPABASE_URL, SERVICE_KEY);

  let objectKey: string;
  let backend: "s3" | "storage" = "s3";
  let bucketLabel = "";

  if (s3) {
    const { data: tenant } = await platform
      .from("tenants").select("cnpj").eq("id", tenantId).maybeSingle();
    const cnpj = (tenant as { cnpj?: string } | null)?.cnpj ?? "";
    objectKey = buildObjectKey({
      tenantId,
      cnpj,
      category: "assinaturas",
      filename: `${userId}-${filename}`,
    });
    bucketLabel = s3.bucket;
    try {
      await s3PutObject(s3, objectKey, bytes, contentType);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha no upload S3";
      log.error("s3 put failed", { err: msg });
      return errorResponse(502, "Falha no upload: " + msg, requestId, log);
    }
  } else {
    backend = "storage";
    bucketLabel = "assinaturas";
    const safeFile = filename.replace(/[^\w.\-]+/g, "_");
    const storagePath = `${tenantId}/${userId}/${Date.now()}-${safeFile}`;
    objectKey = `storage://assinaturas/${storagePath}`;
    const { error: upErr } = await platform.storage
      .from("assinaturas")
      .upload(storagePath, bytes, { contentType, upsert: true });
    if (upErr) {
      log.error("storage put failed", { err: upErr.message });
      return errorResponse(502, "Falha no upload: " + upErr.message, requestId, log);
    }
  }

  const { error: upErr } = await platform
    .from("profiles")
    .update({ assinatura_imagem_key: objectKey, assinatura_tipo: "imagem" })
    .eq("user_id", userId);
  if (upErr) return errorResponse(500, "Falha ao gravar perfil: " + upErr.message, requestId, log);

  await recordStorageAudit(SUPABASE_URL, SERVICE_KEY, {
    tenant_id: tenantId,
    user_id: caller.id,
    category: "assinaturas",
    backend,
    bucket: bucketLabel,
    object_key: objectKey,
    action: "upload",
    size_bytes: bytes.byteLength,
    content_type: contentType,
    request_id: requestId,
    metadata: { target_user_id: userId },
  });

  log.info("assinatura enviada", { userId, key: objectKey, backend });
  return jsonResponse(200, { ok: true, key: objectKey }, requestId);
});
