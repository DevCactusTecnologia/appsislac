// Edge function: lab-apoio-upload-pdf
// ------------------------------------------------------------
// Recebe um PDF (base64) anexado manualmente na página /lab-apoio
// (resultado do laboratório de apoio OU override de laudo) e:
//   1. Valida JWT + tenant do usuário
//   2. Faz upload no Supabase Storage (source-of-truth para signed URLs já
//      existentes nas demais funções: integration-pdf-resolve etc.)
//   3. ESPELHA o mesmo arquivo no bucket S3 configurado em
//      `saas_settings.s3_config` (categoria "laudos"), seguindo a convenção
//      de paths multi-tenant de `_shared/s3.ts` e gravando auditoria em
//      `storage_audit`. Falha de S3 NÃO interrompe o fluxo — o upload no
//      Supabase já garante a disponibilidade do laudo.
//   4. Atualiza a linha em `atendimento_exames` (coluna correta + auditoria).

import { createClient } from "../_shared/runtime/createClient.ts";
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

const MAX_BASE64_LEN = 14_000_000; // ~10 MB de PDF

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
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    return errorResponse(500, "service unavailable", requestId, log, "missing env");
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return errorResponse(401, "unauthorized", requestId, log);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
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

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Tenant do usuário
  const { data: profile } = await admin.from("profiles").select("tenant_id").eq("user_id", userId).maybeSingle();
  if (!profile?.tenant_id) return errorResponse(403, "tenant não resolvido", requestId, log);
  const tenantId = profile.tenant_id as string;

  // Exame + tenant
  const { data: exame } = await admin
    .from("atendimento_exames")
    .select("id, tenant_id, protocolo_externo, atendimento_id, pdf_override_url")
    .eq("id", exameId)
    .maybeSingle();
  if (!exame) return errorResponse(404, "exame não encontrado", requestId, log);
  if (exame.tenant_id !== tenantId) return errorResponse(403, "tenant mismatch", requestId, log);

  // Paciente (para path S3)
  let pacienteId: number | null = null;
  let pacienteCpf: string | null = null;
  if (exame.atendimento_id) {
    const { data: at } = await admin.from("atendimentos")
      .select("paciente_id, pacientes(cpf)")
      .eq("id", exame.atendimento_id).maybeSingle();
    pacienteId = (at?.paciente_id as number | null) ?? null;
    // deno-lint-ignore no-explicit-any
    pacienteCpf = ((at as any)?.pacientes?.cpf as string | null) ?? null;
  }

  // CNPJ do tenant (raiz no S3)
  const { data: tenantRow } = await admin.from("tenants").select("cnpj").eq("id", tenantId).maybeSingle();
  const cnpj = (tenantRow?.cnpj as string | null) ?? "";

  const target = body.target;
  const bucket = target === "override" ? "integration-pdfs" : "resultados-externos";
  const ext = body.filename.toLowerCase().endsWith(".pdf") ? "pdf" : "pdf";
  const supaPath = target === "override"
    ? `${tenantId}/integration-pdfs/${exameId}/${Date.now()}.${ext}`
    : `${tenantId}/${exameId}/${Date.now()}.${ext}`;

  // 1) Upload no Supabase Storage (source of truth para signed URLs)
  try {
    await retryTransient(async () => {
      const { error } = await admin.storage.from(bucket).upload(supaPath, bytes, {
        contentType: "application/pdf", upsert: true,
      });
      if (error) throw new Error(error.message);
      return true;
    }, { attempts: 3, baseMs: 200, opTimeoutMs: 20_000 });
  } catch (e) {
    return errorResponse(502, "upload failed, please retry", requestId, log, e);
  }

  // 2) Espelho S3 (best-effort)
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

  // 3) Atualiza atendimento_exames
  const nowIso = new Date().toISOString();
  if (target === "resultado") {
    const { error: updErr } = await admin.from("atendimento_exames").update({
      status_externo: "RESULTADO_RECEBIDO",
      arquivo_resultado_path: supaPath,
      data_retorno: nowIso,
    }).eq("id", exameId);
    if (updErr) return errorResponse(500, "update failed", requestId, log, updErr);
  } else {
    const previousPath = exame.pdf_override_url ?? null;
    const acao = previousPath ? "REPLACE" : "SET";
    const motivo = (body.motivo ?? "").toString().trim() || null;
    const { error: updErr } = await admin.from("atendimento_exames").update({
      pdf_override_url: supaPath,
      pdf_override_uploaded_by: userId,
      pdf_override_uploaded_at: nowIso,
      pdf_override_motivo: motivo,
      pdf_override_replaced_path: previousPath,
    }).eq("id", exameId);
    if (updErr) return errorResponse(500, "update failed", requestId, log, updErr);
    try {
      await admin.from("pdf_override_audit").insert({
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