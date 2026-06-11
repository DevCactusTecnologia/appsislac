// Upload PDF to private `comprovantes` bucket (tenant-scoped).
// Hardened:
//  - Requires authenticated JWT (verify_jwt is enforced in code; signing-keys mode)
//  - Resolves tenant_id from the user's profile (server-side, never trusted from body)
//  - Stores under `<tenant_id>/y/mm/dd/uuid-name.pdf` for cross-tenant isolation
//  - Validates filename, size, magic bytes, base64 integrity
//  - Returns short-lived signed URL (1h)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.3";
import {
  createLogger,
  errorResponse,
  jsonResponse,
  newRequestId,
  preflight,
  retryTransient,
} from "../_shared/hardening.ts";
import {
  buildObjectKey,
  loadS3Config,
  recordStorageAudit,
  s3PresignGet,
  s3PutObject,
  type StorageCategory,
} from "../_shared/s3.ts";

const BUCKET = "comprovantes";
const MAX_BASE64_LEN = 9_000_000; // ~6MB raw

interface UploadBody {
  filename: string;
  contentBase64: string;
  // Opcionais — habilitam paths estruturados no bucket S3 quando configurado.
  pacienteId?: number | null;
  pacienteCpf?: string | null;
  category?: StorageCategory; // default: "comprovantes"
}

function isValidFilename(name: unknown): name is string {
  return (
    typeof name === "string" &&
    name.length > 0 &&
    name.length <= 200 &&
    /^[A-Za-z0-9._-]+\.pdf$/.test(name)
  );
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();

  const requestId = newRequestId(req);
  const log = createLogger("upload-pdf", requestId);

  if (req.method !== "POST") {
    return errorResponse(405, "method not allowed", requestId, log);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    return errorResponse(500, "service unavailable", requestId, log, "missing env");
  }

  // === AUTH (signing-keys mode: verify in code) ===
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse(401, "unauthorized", requestId, log);
  }
  const token = authHeader.slice("Bearer ".length).trim();

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims?.sub) {
    return errorResponse(401, "unauthorized", requestId, log, claimsErr ?? "no claims");
  }
  const userId = claimsData.claims.sub as string;

  // === Tenant resolution (server-side; never trust body) ===
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-request-id": requestId } },
  });

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileErr || !profile?.tenant_id) {
    return errorResponse(403, "tenant not resolved for user", requestId, log, profileErr);
  }
  const tenantId = profile.tenant_id as string;

  // Busca CNPJ do tenant (usado como pasta-raiz no S3)
  const { data: tenantRow } = await admin
    .from("tenants")
    .select("cnpj")
    .eq("id", tenantId)
    .maybeSingle();
  const cnpj = (tenantRow?.cnpj as string | null) ?? "";

  // === Body validation ===
  let body: Partial<UploadBody>;
  try {
    body = (await req.json()) as Partial<UploadBody>;
  } catch (e) {
    return errorResponse(400, "invalid JSON body", requestId, log, e);
  }

  if (!body?.filename || !body?.contentBase64) {
    return errorResponse(400, "filename and contentBase64 are required", requestId, log);
  }
  if (!isValidFilename(body.filename)) {
    return errorResponse(
      400,
      "invalid filename — only [A-Za-z0-9._-] and .pdf extension allowed",
      requestId,
      log,
    );
  }
  if (typeof body.contentBase64 !== "string" || body.contentBase64.length > MAX_BASE64_LEN) {
    return errorResponse(413, "PDF too large (>6MB)", requestId, log);
  }

  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(body.contentBase64);
  } catch (e) {
    return errorResponse(400, "invalid base64 content", requestId, log, e);
  }

  // Magic bytes check: real PDFs start with %PDF
  if (
    bytes.length < 5 ||
    bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46
  ) {
    return errorResponse(400, "content is not a valid PDF", requestId, log);
  }

  const category: StorageCategory = body.category ?? "comprovantes";
  const objectKey = buildObjectKey({
    tenantId,
    cnpj,
    pacienteRef: body.pacienteCpf ?? null,
    pacienteId: body.pacienteId ?? null,
    category,
    filename: body.filename,
  });

  // Tenta S3 (bucket configurado em saas_settings.s3_config). Fallback: Supabase Storage.
  const s3 = await loadS3Config(SUPABASE_URL, SERVICE_KEY);
  const SIGNED_TTL = 3600;

  if (s3) {
    log.info("upload_start", { backend: "s3", path: objectKey, bytes: bytes.length, tenant: tenantId });
    try {
      await retryTransient(
        async () => {
          await s3PutObject(s3, objectKey, bytes, "application/pdf");
          return true;
        },
        { attempts: 3, baseMs: 200, opTimeoutMs: 20_000 },
      );
    } catch (e) {
      return errorResponse(502, "S3 upload failed, please retry", requestId, log, e);
    }
    let signedUrl: string;
    try {
      signedUrl = await s3PresignGet(s3, objectKey, SIGNED_TTL);
    } catch (e) {
      return errorResponse(502, "uploaded but failed to sign URL", requestId, log, e);
    }
    await recordStorageAudit(SUPABASE_URL, SERVICE_KEY, {
      tenant_id: tenantId, user_id: userId,
      paciente_id: body.pacienteId ?? null,
      paciente_ref: body.pacienteCpf ?? null,
      category, backend: "s3", bucket: s3.bucket, object_key: objectKey,
      action: "upload", size_bytes: bytes.length, content_type: "application/pdf",
      request_id: requestId,
    });
    log.info("upload_ok", { backend: "s3", path: objectKey });
    return jsonResponse(200, {
      url: signedUrl, path: objectKey, backend: "s3", bucket: s3.bucket, expiresIn: SIGNED_TTL,
    }, requestId);
  }

  // Fallback: Supabase Storage (bucket privado `comprovantes`)
  log.info("upload_start", { backend: "supabase", path: objectKey, bytes: bytes.length, tenant: tenantId });
  try {
    const upResult = await retryTransient(
      async () => {
        const { error } = await admin.storage
          .from(BUCKET)
          .upload(objectKey, bytes, { contentType: "application/pdf", upsert: false });
        if (error) throw new Error(error.message);
        return true;
      },
      { attempts: 3, baseMs: 200, opTimeoutMs: 20_000 },
    );
    if (!upResult) throw new Error("upload returned no result");
  } catch (e) {
    return errorResponse(502, "upload failed, please retry", requestId, log, e);
  }
  let signedUrl: string;
  try {
    const { data: signed, error: signErr } = await admin.storage
      .from(BUCKET).createSignedUrl(objectKey, SIGNED_TTL);
    if (signErr || !signed?.signedUrl) throw new Error(signErr?.message ?? "could not sign URL");
    signedUrl = signed.signedUrl;
  } catch (e) {
    return errorResponse(502, "uploaded but failed to sign URL", requestId, log, e);
  }
  await recordStorageAudit(SUPABASE_URL, SERVICE_KEY, {
    tenant_id: tenantId, user_id: userId,
    paciente_id: body.pacienteId ?? null,
    paciente_ref: body.pacienteCpf ?? null,
    category, backend: "supabase", bucket: BUCKET, object_key: objectKey,
    action: "upload", size_bytes: bytes.length, content_type: "application/pdf",
    request_id: requestId,
  });
  log.info("upload_ok", { backend: "supabase", path: objectKey });
  return jsonResponse(200, {
    url: signedUrl, path: objectKey, backend: "supabase", bucket: BUCKET, expiresIn: SIGNED_TTL,
  }, requestId);
});
