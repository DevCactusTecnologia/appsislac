// Edge function: lab-apoio-upload-pdf
// Slice 3: `atendimento_exames`, `atendimentos`, `pdf_override_audit` são
// tenant-scoped → `getTenantClient`. Storage/`profiles`/`tenants`/auditoria
// permanecem no control-plane.

import {
  getPlatformClient,
  getTenantClient,
  getUserClient,
  MigrationBlockedError,
} from "../_shared/runtime/db.ts";
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
  s3PutObject,
} from "../_shared/s3.ts";

type Target = "resultado" | "override";

interface Body {
  target: Target;
  atendimento_exame_id: number;
  filename: string;
  contentBase64: string;
  motivo?: string | null;
}

const MAX_BASE64_LEN = 14_000_000;

function isValidFilename(name: unknown): name is string {
  return typeof name === "string" && /^[A-Za-z0-9._-]+\.(pdf|PDF)$/.test(name) && name.length <= 200;
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
  const log = createLogger("lab-apoio-upload-pdf", requestId);
  if (req.method !== "POST") return errorResponse(405, "method not allowed", requestId, log);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return errorResponse(500, "service unavailable", requestId, log, "missing env");
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return errorResponse(401, "unauthorized", requestId, log);

  const userClient = getUserClient(authHeader);
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return errorResponse(401, "unauthorized", requestId, log, userErr);
  const userId = userData.user.id;

  let body: Partial<Body>;
  try { body = await req.json() as Partial<Body>; }
  catch (e) { return errorResponse(400, "invalid JSON body", requestId, log, e); }

  if (!body || (body.target !== "resultado" && body.target !== "override")) {
    return errorResponse(400, "target must be 'resultado' or 'override'", requestId, log);
  }
  const exameId = Number(body.atendimento_exame_id);
  if (!Number.isFinite(exameId) || exameId <= 0) {
    return errorResponse(400, "atendimento_exame_id obrigatório", requestId, log);
  }
  if (!isValidFilename(body.filename)) {
    return errorResponse(400, "invalid filename", requestId, log);
  }
  if (typeof body.contentBase64 !== "string" || body.contentBase64.length > MAX_BASE64_LEN) {
    return errorResponse(413, "PDF too large", requestId, log);
  }
  let bytes: Uint8Array;
  try { bytes = base64ToBytes(body.contentBase64); }
  catch (e) { return errorResponse(400, "invalid base64", requestId, log, e); }
  if (bytes.length < 5 || bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46) {
    return errorResponse(400, "content is not a valid PDF", requestId, log);
  }

  const platform = getPlatformClient();

  const { data: profile } = await platform.from("profiles").select("tenant_id").eq("user_id", userId).maybeSingle();
  if (!profile?.tenant_id) return errorResponse(403, "tenant não resolvido", requestId, log);
  const tenantId = profile.tenant_id as string;

  let tenantDb;
  try {
    tenantDb = await getTenantClient(tenantId);
  } catch (e) {
    if (e instanceof MigrationBlockedError) {
      return errorResponse(503, `Runtime dedicado indisponível (${e.code})`, requestId, log);
    }
    throw e;
  }

  const { data: exame } = await tenantDb
    .from("atendimento_exames")
    .select("id, tenant_id, protocolo_externo, atendimento_id, pdf_override_url")
    .eq("id", exameId)
    .maybeSingle();
  if (!exame) return errorResponse(404, "exame não encontrado", requestId, log);
  if (exame.tenant_id !== tenantId) return errorResponse(403, "tenant mismatch", requestId, log);

  let pacienteId: number | null = null;
  let pacienteCpf: string | null = null;
  if (exame.atendimento_id) {
    const { data: at } = await tenantDb.from("atendimentos")
      .select("paciente_id, pacientes(cpf)")
      .eq("id", exame.atendimento_id).maybeSingle();
    pacienteId = (at?.paciente_id as number | null) ?? null;
    // deno-lint-ignore no-explicit-any
    pacienteCpf = ((at as any)?.pacientes?.cpf as string | null) ?? null;
  }

  const { data: tenantRow } = await platform.from("tenants").select("cnpj").eq("id", tenantId).maybeSingle();
  const cnpj = (tenantRow?.cnpj as string | null) ?? "";

  const target = body.target;
  const bucket = target === "override" ? "integration-pdfs" : "resultados-externos";
  const ext = body.filename.toLowerCase().endsWith(".pdf") ? "pdf" : "pdf";
  const supaPath = target === "override"
    ? `${tenantId}/integration-pdfs/${exameId}/${Date.now()}.${ext}`
    : `${tenantId}/${exameId}/${Date.now()}.${ext}`;

  try {
    await retryTransient(async () => {
      const { error } = await platform.storage.from(bucket).upload(supaPath, bytes, {
        contentType: "application/pdf", upsert: true,
      });
      if (error) throw new Error(error.message);
      return true;
    }, { attempts: 3, baseMs: 200, opTimeoutMs: 20_000 });
  } catch (e) {
    return errorResponse(502, "upload failed, please retry", requestId, log, e);
  }

  let s3Key: string | null = null;
  let s3Bucket: string | null = null;
  try {
    const s3 = await loadS3Config(SUPABASE_URL, SERVICE_KEY);
    if (s3) {
      const key = buildObjectKey({
        tenantId, cnpj,
        pacienteRef: pacienteCpf, pacienteId,
        category: "laudos",
        filename: body.filename,
      });
      await retryTransient(async () => {
        await s3PutObject(s3, key, bytes, "application/pdf");
        return true;
      }, { attempts: 3, baseMs: 200, opTimeoutMs: 20_000 });
      s3Key = key;
      s3Bucket = s3.bucket;
      await recordStorageAudit(SUPABASE_URL, SERVICE_KEY, {
        tenant_id: tenantId, user_id: userId,
        paciente_id: pacienteId, paciente_ref: pacienteCpf,
        category: "laudos", backend: "s3", bucket: s3.bucket, object_key: key,
        action: "upload", size_bytes: bytes.length, content_type: "application/pdf",
        request_id: requestId,
        metadata: {
          source: "lab-apoio-upload-pdf", target,
          atendimento_exame_id: exameId,
          protocolo_externo: exame.protocolo_externo ?? null,
          supabase_bucket: bucket, supabase_path: supaPath,
        },
      });
      log.info("s3_mirror_ok", { key, bytes: bytes.length });
    } else {
      log.info("s3_mirror_skip", { reason: "no_s3_config" });
    }
  } catch (e) {
    log.warn("s3_mirror_failed", { err: e instanceof Error ? e.message : String(e) });
  }

  const nowIso = new Date().toISOString();
  if (target === "resultado") {
    const { error: updErr } = await tenantDb.from("atendimento_exames").update({
      status_externo: "RESULTADO_RECEBIDO",
      arquivo_resultado_path: supaPath,
      data_retorno: nowIso,
    }).eq("id", exameId);
    if (updErr) return errorResponse(500, "update failed", requestId, log, updErr);
  } else {
    const previousPath = exame.pdf_override_url ?? null;
    const acao = previousPath ? "REPLACE" : "SET";
    const motivo = (body.motivo ?? "").toString().trim() || null;
    const { error: updErr } = await tenantDb.from("atendimento_exames").update({
      pdf_override_url: supaPath,
      pdf_override_uploaded_by: userId,
      pdf_override_uploaded_at: nowIso,
      pdf_override_motivo: motivo,
      pdf_override_replaced_path: previousPath,
    }).eq("id", exameId);
    if (updErr) return errorResponse(500, "update failed", requestId, log, updErr);
    try {
      await tenantDb.from("pdf_override_audit").insert({
        tenant_id: tenantId,
        atendimento_exame_id: exameId,
        acao,
        storage_path_novo: supaPath,
        storage_path_anterior: previousPath,
        protocolo_externo: exame.protocolo_externo,
        motivo,
        uploaded_by: userId,
      });
    } catch (e) { log.warn("audit_insert_failed", { err: String(e) }); }
  }

  return jsonResponse(200, {
    ok: true,
    target,
    supabase_path: supaPath,
    supabase_bucket: bucket,
    s3_mirrored: !!s3Key,
    s3_key: s3Key,
    s3_bucket: s3Bucket,
  }, requestId);
});
