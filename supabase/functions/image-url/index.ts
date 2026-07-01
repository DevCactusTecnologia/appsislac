// Edge function: image-url
// ----------------------------------------------------------------------------
// Retorna URL pré-assinada (1h) para uma imagem do tenant armazenada no S3.
// Slice 3: apenas control-plane (profiles/tenants/rpc/S3). Probe do tenant
// via `getTenantClient` valida acessibilidade em modo dedicated.

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
  const log = createLogger("image-url", requestId);
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
  const key = typeof body.key === "string" ? body.key.trim() : "";
  if (!key) return errorResponse(400, "key obrigatório", requestId, log);

  const platform = getPlatformClient();

  const { data: callerProfile } = await platform
    .from("profiles").select("tenant_id").eq("user_id", caller.id).maybeSingle();
  const callerTenant = (callerProfile as { tenant_id?: string } | null)?.tenant_id;
  if (!callerTenant) return errorResponse(403, "Sem tenant", requestId, log);

  try {
    await getTenantClient(callerTenant);
  } catch (e) {
    if (e instanceof MigrationBlockedError) {
      return errorResponse(503, `Runtime dedicado indisponível (${e.code})`, requestId, log);
    }
    throw e;
  }

  const { data: tenantRow } = await platform
    .from("tenants").select("cnpj").eq("id", callerTenant).maybeSingle();
  const cnpj = ((tenantRow as { cnpj?: string } | null)?.cnpj ?? "").replace(/\D+/g, "");

  const validPrefixes = [
    cnpj && cnpj.length >= 8 ? `${cnpj}/` : null,
    `${callerTenant}/`,
  ].filter(Boolean) as string[];
  const allowed = validPrefixes.some((p) => key.startsWith(p));
  if (!allowed) {
    const { data: isSuper } = await platform.rpc("is_super_admin", { _user_id: caller.id });
    if (!isSuper) return errorResponse(403, "Chave fora do tenant", requestId, log);
  }

  const s3 = await loadS3Config(SUPABASE_URL, SERVICE_KEY);
  if (!s3) return errorResponse(500, "Bucket não configurado", requestId, log);

  let url: string;
  try {
    url = await s3PresignGet(s3, key, 3600);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao assinar URL";
    log.error("presign failed", { err: msg });
    return errorResponse(502, msg, requestId, log);
  }

  await recordStorageAudit(SUPABASE_URL, SERVICE_KEY, {
    tenant_id: callerTenant,
    user_id: caller.id,
    category: "auditoria",
    backend: "s3",
    bucket: s3.bucket,
    object_key: key,
    action: "sign_read",
    request_id: requestId,
  });

  return jsonResponse(200, { ok: true, url, expires_in: 3600 }, requestId);
});
