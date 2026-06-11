// Edge function: image-url
// ----------------------------------------------------------------------------
// Retorna URL pré-assinada (1h) para uma imagem do tenant armazenada no S3.
// Aceita resolução por chave (logo/avatar/assinatura genérica) validando que
// a chave começa com o prefixo do tenant do caller.
//
// Body JSON: { key: string }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
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
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    return errorResponse(500, "Server misconfiguration", requestId, log);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user: caller }, error: callerErr } = await userClient.auth.getUser();
  if (callerErr || !caller) return errorResponse(401, "Não autenticado", requestId, log);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return errorResponse(400, "JSON inválido", requestId, log); }
  const key = typeof body.key === "string" ? body.key.trim() : "";
  if (!key) return errorResponse(400, "key obrigatório", requestId, log);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: callerProfile } = await admin
    .from("profiles").select("tenant_id").eq("user_id", caller.id).maybeSingle();
  const callerTenant = (callerProfile as { tenant_id?: string } | null)?.tenant_id;
  if (!callerTenant) return errorResponse(403, "Sem tenant", requestId, log);

  const { data: tenantRow } = await admin
    .from("tenants").select("cnpj").eq("id", callerTenant).maybeSingle();
  const cnpj = ((tenantRow as { cnpj?: string } | null)?.cnpj ?? "").replace(/\D+/g, "");

  // Valida prefixo: deve ser {cnpj}/... ou {tenantId}/... (fallback)
  const validPrefixes = [
    cnpj && cnpj.length >= 8 ? `${cnpj}/` : null,
    `${callerTenant}/`,
  ].filter(Boolean) as string[];
  const allowed = validPrefixes.some((p) => key.startsWith(p));
  if (!allowed) {
    const { data: isSuper } = await admin.rpc("is_super_admin", { _user_id: caller.id });
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