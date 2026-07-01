// Helper compartilhado: cliente S3 mínimo (SigV4) usado pelas edge functions
// para gravar/ler/assinar objetos no bucket privado configurado em
// `saas_settings.s3_config`. Também centraliza a convenção de paths.
//
//  Convenção de pastas (auditável):
//    {cnpj}/pacientes/{paciente_ref}/{categoria}/{yyyy}/{mm}/{uuid}-{nome}
//    {cnpj}/_globais/{categoria}/{yyyy}/{mm}/{uuid}-{nome}
//
//  - cnpj          = somente dígitos (14)
//  - paciente_ref  = CPF (11 dígitos) ou, na ausência, "id-{patient_id}"
//  - categoria     = comprovantes | documentos | laudos | auditoria

import { createClient } from "../_shared/runtime/createClient.ts";

export interface S3Config {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
  endpoint?: string;
}

export type StorageCategory =
  | "comprovantes"
  | "documentos"
  | "laudos"
  | "auditoria"
  | "assinaturas"
  | "logo"
  | "avatares";

export interface PathParts {
  cnpj: string;
  pacienteRef?: string | null;
  pacienteId?: number | null;
  category: StorageCategory;
  filename: string;
}

function digits(s: string): string {
  return (s ?? "").replace(/\D+/g, "");
}

function safeName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 180);
}

function rootForTenant(cnpj: string, tenantId: string): string {
  const c = digits(cnpj);
  return c.length >= 8 ? c : tenantId;
}

function patientSegment(p: PathParts): string {
  const cpf = digits(p.pacienteRef ?? "");
  if (cpf.length === 11) return cpf;
  if (p.pacienteId) return `id-${p.pacienteId}`;
  return "sem-paciente";
}

/** Monta a chave do objeto seguindo a convenção. */
export function buildObjectKey(p: PathParts & { tenantId: string }): string {
  const root = rootForTenant(p.cnpj, p.tenantId);
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const id = crypto.randomUUID().slice(0, 8);
  const file = safeName(p.filename);
  if (p.pacienteRef || p.pacienteId) {
    return `${root}/pacientes/${patientSegment(p)}/${p.category}/${y}/${m}/${id}-${file}`;
  }
  return `${root}/_globais/${p.category}/${y}/${m}/${id}-${file}`;
}

/** Carrega a configuração S3 ativa (saas_settings.s3_config). */
export async function loadS3Config(supabaseUrl: string, serviceKey: string): Promise<S3Config | null> {
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin
    .from("saas_settings")
    .select("value")
    .eq("key", "s3_config")
    .maybeSingle();
  if (error || !data?.value) return null;
  const v = data.value as Partial<S3Config>;
  const cfg: S3Config = {
    accessKeyId: (v.accessKeyId ?? "").trim(),
    secretAccessKey: (v.secretAccessKey ?? "").trim(),
    region: (v.region ?? "").trim(),
    bucket: (v.bucket ?? "").trim(),
    endpoint: (v.endpoint ?? "").trim() || undefined,
  };
  if (!cfg.accessKeyId || !cfg.secretAccessKey || !cfg.region || !cfg.bucket) return null;
  return cfg;
}

/* ---------------------------- AWS SigV4 ---------------------------------- */

async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const buf = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey(
    "raw", key as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  return crypto.subtle.sign("HMAC", k, new TextEncoder().encode(data));
}
function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function endpointHostAndPath(cfg: S3Config, key: string): { host: string; path: string; url: string } {
  if (cfg.endpoint) {
    const host = cfg.endpoint.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const path = `/${cfg.bucket}/${encodeKey(key)}`;
    return { host, path, url: `https://${host}${path}` };
  }
  const host = `${cfg.bucket}.s3.${cfg.region}.amazonaws.com`;
  const path = `/${encodeKey(key)}`;
  return { host, path, url: `https://${host}${path}` };
}

function encodeKey(key: string): string {
  return key.split("/").map((seg) => encodeURIComponent(seg)).join("/");
}

async function signedHeaders(
  cfg: S3Config,
  method: "PUT" | "HEAD" | "GET" | "DELETE",
  key: string,
  payload: Uint8Array | "",
  extraHeaders: Record<string, string> = {},
): Promise<{ url: string; headers: Record<string, string> }> {
  const { host, path, url } = endpointHostAndPath(cfg, key);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = await sha256Hex(payload === "" ? "" : payload);

  const baseHeaders: Record<string, string> = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    ...extraHeaders,
  };

  const sortedHeaderNames = Object.keys(baseHeaders).map((h) => h.toLowerCase()).sort();
  const canonicalHeaders =
    sortedHeaderNames.map((h) => `${h}:${baseHeaders[h] ?? baseHeaders[Object.keys(baseHeaders).find((k) => k.toLowerCase() === h)!]}\n`).join("");
  const signedHeadersStr = sortedHeaderNames.join(";");

  const canonicalRequest = [
    method, path, "", canonicalHeaders, signedHeadersStr, payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${cfg.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256", amzDate, credentialScope, await sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = await hmac(new TextEncoder().encode("AWS4" + cfg.secretAccessKey), dateStamp);
  const kRegion = await hmac(kDate, cfg.region);
  const kService = await hmac(kRegion, "s3");
  const kSigning = await hmac(kService, "aws4_request");
  const signature = toHex(await hmac(kSigning, stringToSign));

  const authHeader =
    `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeadersStr}, Signature=${signature}`;

  return { url, headers: { ...baseHeaders, Authorization: authHeader } };
}

/** PUT object com SigV4. */
export async function s3PutObject(
  cfg: S3Config,
  key: string,
  body: Uint8Array,
  contentType: string,
): Promise<void> {
  const { url, headers } = await signedHeaders(cfg, "PUT", key, body, {
    "content-type": contentType,
  });
  const r = await fetch(url, { method: "PUT", headers, body });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`S3 PUT ${r.status}: ${txt.slice(0, 300)}`);
  }
}

/** Gera URL assinada GET (presigned) — querystring SigV4. */
export async function s3PresignGet(
  cfg: S3Config,
  key: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const { host, path } = endpointHostAndPath(cfg, key);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${cfg.region}/s3/aws4_request`;

  const params = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${cfg.accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresInSeconds),
    "X-Amz-SignedHeaders": "host",
  });
  // Reordenar deterministicamente conforme spec
  const sortedQuery = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  const canonicalRequest = [
    "GET", path, sortedQuery, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256", amzDate, credentialScope, await sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = await hmac(new TextEncoder().encode("AWS4" + cfg.secretAccessKey), dateStamp);
  const kRegion = await hmac(kDate, cfg.region);
  const kService = await hmac(kRegion, "s3");
  const kSigning = await hmac(kService, "aws4_request");
  const signature = toHex(await hmac(kSigning, stringToSign));

  return `https://${host}${path}?${sortedQuery}&X-Amz-Signature=${signature}`;
}

/** Insere registro de auditoria. Falhas são logadas mas NÃO interrompem o fluxo. */
export async function recordStorageAudit(
  supabaseUrl: string,
  serviceKey: string,
  row: {
    tenant_id: string;
    user_id?: string | null;
    paciente_id?: number | null;
    paciente_ref?: string | null;
    category: StorageCategory;
    backend: "s3" | "supabase";
    bucket: string;
    object_key: string;
    action: "upload" | "sign_read" | "delete";
    size_bytes?: number | null;
    content_type?: string | null;
    request_id?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await admin.from("storage_audit").insert(row);
  } catch (e) {
    console.error("[storage_audit] insert failed", e);
  }
}