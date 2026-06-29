// Edge function: assinatura-url
// ----------------------------------------------------------------------------
// Retorna URL pré-assinada (1h) para a imagem de assinatura de um usuário.
// O caller precisa estar autenticado e pertencer ao mesmo tenant do alvo
// (ou ser super_admin / admin global). Usado pelo modal de edição e pelo
// renderizador de laudo no frontend.
//
// Body: { userId: string }

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
  const log = createLogger("assinatura-url", requestId);
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
  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!userId) return errorResponse(400, "userId obrigatório", requestId, log);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Carrega perfil alvo + caller para validar tenant
  const { data: target } = await admin
    .from("profiles")
    .select("tenant_id, assinatura_imagem_key")
    .eq("user_id", userId)
    .maybeSingle();
  if (!target) return errorResponse(404, "Usuário não encontrado", requestId, log);
  const t = target as { tenant_id: string; assinatura_imagem_key: string | null };
  if (!t.assinatura_imagem_key) {
    return jsonResponse(200, { ok: true, url: null }, requestId);
  }

  const { data: callerProfile } = await admin
    .from("profiles").select("tenant_id").eq("user_id", caller.id).maybeSingle();
  const callerTenant = (callerProfile as { tenant_id?: string } | null)?.tenant_id;
  if (callerTenant !== t.tenant_id) {
    // Permite super_admin
    const { data: isSuper } = await admin.rpc("is_super_admin", { _user_id: caller.id });
    if (!isSuper) return errorResponse(403, "Sem permissão", requestId, log);
  }

  let url: string;
  let backend: "s3" | "storage" = "s3";
  let bucketLabel = "";

  if (t.assinatura_imagem_key.startsWith("storage://")) {
    // Formato: storage://<bucket>/<path>
    const rest = t.assinatura_imagem_key.slice("storage://".length);
    const slash = rest.indexOf("/");
    const bucket = slash >= 0 ? rest.slice(0, slash) : rest;
    const path = slash >= 0 ? rest.slice(slash + 1) : "";
    backend = "storage";
    bucketLabel = bucket;
    const { data: signed, error: sErr } = await admin.storage
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