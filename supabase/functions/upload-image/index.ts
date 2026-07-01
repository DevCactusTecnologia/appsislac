// Edge function: upload-image
// Slice 3: `tenant_lab_config` é tenant-scoped → `getTenantClient`.
// `profiles`/`tenants`/RPC/Storage permanecem no control-plane.

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
  type StorageCategory,
} from "../_shared/s3.ts";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

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
  const log = createLogger("upload-image", requestId);
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

  const category = body.category === "logo" || body.category === "avatar"
    ? (body.category as "logo" | "avatar")
    : null;
  if (!category) return errorResponse(400, "category inválido (logo|avatar)", requestId, log);

  const platform = getPlatformClient();

  const { data: callerProfile, error: cpErr } = await platform
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", caller.id)
    .maybeSingle();
  if (cpErr || !callerProfile) return errorResponse(404, "Perfil não encontrado", requestId, log);
  const tenantId = (callerProfile as { tenant_id: string }).tenant_id;

  let tenantDb;
  try {
    tenantDb = await getTenantClient(tenantId);
  } catch (e) {
    if (e instanceof MigrationBlockedError) {
      return errorResponse(503, `Runtime dedicado indisponível (${e.code})`, requestId, log);
    }
    throw e;
  }

  let targetUserId = caller.id;
  if (category === "avatar" && typeof body.targetUserId === "string" && body.targetUserId) {
    targetUserId = body.targetUserId;
    if (targetUserId !== caller.id) {
      const { data: isAdmin } = await platform.rpc("has_role", { _user_id: caller.id, _role: "admin" });
      const { data: isManager } = await platform.rpc("has_role", { _user_id: caller.id, _role: "manager" });
      if (!isAdmin && !isManager) {
        return errorResponse(403, "Sem permissão para alterar este usuário", requestId, log);
      }
      const { data: targetP } = await platform.from("profiles").select("tenant_id").eq("user_id", targetUserId).maybeSingle();
      const tTenant = (targetP as { tenant_id?: string } | null)?.tenant_id;
      if (tTenant !== tenantId) return errorResponse(403, "Usuário fora do tenant", requestId, log);
    }
  }

  if (category === "logo") {
    const { data: isAdmin } = await platform.rpc("has_role", { _user_id: caller.id, _role: "admin" });
    const { data: isManager } = await platform.rpc("has_role", { _user_id: caller.id, _role: "manager" });
    const { data: isSuper } = await platform.rpc("is_super_admin", { _user_id: caller.id });
    if (!isAdmin && !isManager && !isSuper) return errorResponse(403, "Sem permissão para alterar logo", requestId, log);
  }

  const { data: tenantRow } = await platform
    .from("tenants").select("cnpj").eq("id", tenantId).maybeSingle();
  const cnpj = (tenantRow as { cnpj?: string } | null)?.cnpj ?? "";

  if (body.remove === true) {
    if (category === "logo") {
      const { error } = await tenantDb
        .from("tenant_lab_config")
        .update({ logo_key: null, logo: null })
        .eq("tenant_id", tenantId);
      if (error) return errorResponse(500, "Falha ao remover logo: " + error.message, requestId, log);
    } else {
      const { error } = await platform
        .from("profiles")
        .update({ avatar_key: null, avatar: null })
        .eq("user_id", targetUserId);
      if (error) return errorResponse(500, "Falha ao remover avatar: " + error.message, requestId, log);
    }
    log.info("imagem removida", { category, targetUserId });
    return jsonResponse(200, { ok: true, removed: true }, requestId);
  }

  const filename = typeof body.filename === "string" ? body.filename : `${category}.png`;
  const contentType = typeof body.contentType === "string" ? body.contentType : "";
  const dataB64 = typeof body.dataBase64 === "string" ? body.dataBase64 : "";
  if (!ALLOWED_MIME.has(contentType.toLowerCase())) {
    return errorResponse(400, "Tipo de arquivo não suportado (PNG, JPEG ou WEBP)", requestId, log);
  }
  if (!dataB64) return errorResponse(400, "dataBase64 obrigatório", requestId, log);

  let bytes: Uint8Array;
  try { bytes = decodeBase64(dataB64); } catch {
    return errorResponse(400, "dataBase64 inválido", requestId, log);
  }
  if (bytes.byteLength === 0) return errorResponse(400, "Arquivo vazio", requestId, log);
  if (bytes.byteLength > MAX_BYTES) return errorResponse(400, "Arquivo excede 2 MB", requestId, log);

  const s3 = await loadS3Config(SUPABASE_URL, SERVICE_KEY);

  const storageCategory: StorageCategory = category === "logo" ? "logo" : "avatares";
  const namedFile = category === "logo" ? filename : `${targetUserId}-${filename}`;

  if (!s3) {
    const extFromType = (contentType.split("/")[1] || "png").toLowerCase().replace("jpeg", "jpg");
    const bucket = "tenant-assets";
    const safe = namedFile.replace(/\.[^/.]+$/, "").replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 120) || "file";
    const path = `${tenantId}/${storageCategory}/${crypto.randomUUID()}-${safe}.${extFromType}`;

    const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body: bytes,
    });
    if (!uploadRes.ok) {
      const txt = await uploadRes.text();
      log.error("storage upload failed", { status: uploadRes.status, txt });
      return errorResponse(502, "Falha ao enviar para storage: " + txt, requestId, log);
    }
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;

    if (category === "logo") {
      const { error } = await tenantDb
        .from("tenant_lab_config")
        .update({ logo: publicUrl, logo_key: null })
        .eq("tenant_id", tenantId);
      if (error) return errorResponse(500, "Falha ao gravar logo: " + error.message, requestId, log);
    } else {
      const { error } = await platform
        .from("profiles")
        .update({ avatar: publicUrl, avatar_key: null })
        .eq("user_id", targetUserId);
      if (error) return errorResponse(500, "Falha ao gravar avatar: " + error.message, requestId, log);
    }

    log.info("imagem enviada (storage fallback)", { category, path });
    return jsonResponse(200, { ok: true, key: null, logo: publicUrl, url: publicUrl, backend: "storage" }, requestId);
  }

  const objectKey = buildObjectKey({
    tenantId,
    cnpj,
    category: storageCategory,
    filename: namedFile,
  });

  try {
    await s3PutObject(s3, objectKey, bytes, contentType);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha no upload S3";
    log.error("s3 put failed", { err: msg });
    return errorResponse(502, "Falha no upload: " + msg, requestId, log);
  }

  if (category === "logo") {
    const { error } = await tenantDb
      .from("tenant_lab_config")
      .update({ logo_key: objectKey, logo: null })
      .eq("tenant_id", tenantId);
    if (error) return errorResponse(500, "Falha ao gravar logo: " + error.message, requestId, log);
  } else {
    const { error } = await platform
      .from("profiles")
      .update({ avatar_key: objectKey, avatar: null })
      .eq("user_id", targetUserId);
    if (error) return errorResponse(500, "Falha ao gravar avatar: " + error.message, requestId, log);
  }

  await recordStorageAudit(SUPABASE_URL, SERVICE_KEY, {
    tenant_id: tenantId,
    user_id: caller.id,
    category: storageCategory,
    backend: "s3",
    bucket: s3.bucket,
    object_key: objectKey,
    action: "upload",
    size_bytes: bytes.byteLength,
    content_type: contentType,
    request_id: requestId,
    metadata: { target_user_id: targetUserId, category },
  });

  log.info("imagem enviada", { category, key: objectKey });
  return jsonResponse(200, { ok: true, key: objectKey }, requestId);
});
