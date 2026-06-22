// Super Admin: testa credenciais de integrações externas (SMTP, AI, S3, WhatsApp).
// - Requer usuário autenticado com role 'super_admin'.
// - Recebe { integration: 'smtp' | 'ai' | 's3' | 'whatsapp', config: object }.
// - Retorna { ok, message, details } sem expor segredos.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Integration = "smtp" | "ai" | "s3" | "whatsapp";

interface SmtpCfg {
  host: string; port: number; user: string; password: string;
  fromEmail: string; fromName?: string; security: "none" | "starttls" | "ssl";
}
interface AiCfg { geminiApiKey?: string; openaiApiKey?: string; openaiOrgId?: string; }
interface S3Cfg {
  accessKeyId: string; secretAccessKey: string;
  region: string; bucket: string; endpoint?: string;
}
interface WppCfg {
  provider: "meta";
  phoneNumberId?: string; accessToken?: string;
  verifyToken?: string; businessAccountId?: string;
}

/* ------------------------------ SMTP -------------------------------------- */

async function testSmtp(cfg: SmtpCfg): Promise<{ ok: boolean; message: string; details?: unknown }> {
  const missing: string[] = [];
  if (!cfg.host) missing.push("host");
  if (!cfg.port) missing.push("port");
  if (!cfg.user) missing.push("user");
  if (!cfg.password) missing.push("password");
  if (!cfg.fromEmail) missing.push("fromEmail");
  if (missing.length) {
    return { ok: false, message: `Campos obrigatórios ausentes: ${missing.join(", ")}` };
  }

  // Tenta abrir um socket TCP/TLS no host:port e ler o banner do servidor SMTP.
  // Não envia credenciais — apenas valida acessibilidade e handshake.
  const useTls = cfg.security === "ssl";
  let conn: Deno.Conn | null = null;
  try {
    const opts = { hostname: cfg.host, port: cfg.port };
    conn = useTls
      ? await Promise.race([
          Deno.connectTls(opts),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 8000)),
        ])
      : await Promise.race([
          Deno.connect(opts),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 8000)),
        ]);

    // Lê banner inicial (220 ...)
    const buf = new Uint8Array(1024);
    const n = await Promise.race([
      conn.read(buf),
      new Promise<null>((res) => setTimeout(() => res(null), 5000)),
    ]);
    if (!n) {
      return { ok: false, message: "Servidor não respondeu (sem banner SMTP)." };
    }
    const banner = new TextDecoder().decode(buf.subarray(0, n as number)).trim();
    if (!banner.startsWith("220")) {
      return { ok: false, message: `Banner inesperado: ${banner.slice(0, 80)}` };
    }
    return {
      ok: true,
      message: `Conexão estabelecida com ${cfg.host}:${cfg.port} (${cfg.security}).`,
      details: { banner: banner.slice(0, 120) },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: `Falha ao conectar: ${msg}` };
  } finally {
    try { conn?.close(); } catch { /* noop */ }
  }
}

/* -------------------------------- AI -------------------------------------- */

async function testAi(cfg: AiCfg): Promise<{ ok: boolean; message: string; details?: unknown }> {
  if (!cfg.geminiApiKey && !cfg.openaiApiKey) {
    return { ok: false, message: "Informe ao menos uma chave (Gemini ou OpenAI)." };
  }
  const results: Record<string, { ok: boolean; status?: number; error?: string }> = {};

  if (cfg.openaiApiKey) {
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${cfg.openaiApiKey}`,
      };
      if (cfg.openaiOrgId) headers["OpenAI-Organization"] = cfg.openaiOrgId;
      const r = await fetch("https://api.openai.com/v1/models", { headers });
      results.openai = { ok: r.ok, status: r.status };
      if (!r.ok) {
        const t = await r.text();
        results.openai.error = t.slice(0, 200);
      }
    } catch (e) {
      results.openai = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  if (cfg.geminiApiKey) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cfg.geminiApiKey)}`,
      );
      results.gemini = { ok: r.ok, status: r.status };
      if (!r.ok) {
        const t = await r.text();
        results.gemini.error = t.slice(0, 200);
      }
    } catch (e) {
      results.gemini = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  const allOk = Object.values(results).every((v) => v.ok);
  const okList = Object.entries(results).filter(([, v]) => v.ok).map(([k]) => k);
  const failList = Object.entries(results).filter(([, v]) => !v.ok).map(([k]) => k);
  return {
    ok: allOk,
    message: allOk
      ? `Chaves válidas: ${okList.join(", ")}`
      : `Falha em: ${failList.join(", ")}${okList.length ? ` (ok: ${okList.join(", ")})` : ""}`,
    details: results,
  };
}

/* -------------------------------- S3 -------------------------------------- */

// AWS SigV4 mínimo para HEAD bucket.
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

async function testS3(cfg: S3Cfg): Promise<{ ok: boolean; message: string; details?: unknown }> {
  cfg = {
    ...cfg,
    accessKeyId: (cfg.accessKeyId || "").trim(),
    secretAccessKey: (cfg.secretAccessKey || "").trim(),
    region: (cfg.region || "").trim(),
    bucket: (cfg.bucket || "").trim(),
    endpoint: (cfg.endpoint || "").trim(),
  };
  const missing: string[] = [];
  if (!cfg.accessKeyId) missing.push("accessKeyId");
  if (!cfg.secretAccessKey) missing.push("secretAccessKey");
  if (!cfg.region) missing.push("region");
  if (!cfg.bucket) missing.push("bucket");
  if (missing.length) {
    return { ok: false, message: `Campos obrigatórios ausentes: ${missing.join(", ")}` };
  }

  try {
    const host = cfg.endpoint
      ? cfg.endpoint.replace(/^https?:\/\//, "").replace(/\/$/, "")
      : `${cfg.bucket}.s3.${cfg.region}.amazonaws.com`;
    const path = cfg.endpoint ? `/${cfg.bucket}` : "/";
    const url = `https://${host}${path}`;

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); // 20240101T000000Z
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = await sha256Hex("");

    const canonicalHeaders =
      `host:${host}\n` +
      `x-amz-content-sha256:${payloadHash}\n` +
      `x-amz-date:${amzDate}\n`;
    const signedHeaders = "host;x-amz-content-sha256;x-amz-date";

    const canonicalRequest = [
      "HEAD", path, "", canonicalHeaders, signedHeaders, payloadHash,
    ].join("\n");

    const credentialScope = `${dateStamp}/${cfg.region}/s3/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      await sha256Hex(canonicalRequest),
    ].join("\n");

    const kDate = await hmac(new TextEncoder().encode("AWS4" + cfg.secretAccessKey), dateStamp);
    const kRegion = await hmac(kDate, cfg.region);
    const kService = await hmac(kRegion, "s3");
    const kSigning = await hmac(kService, "aws4_request");
    const signature = toHex(await hmac(kSigning, stringToSign));

    const authHeader =
      `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const r = await fetch(url, {
      method: "HEAD",
      headers: {
        "x-amz-date": amzDate,
        "x-amz-content-sha256": payloadHash,
        "Authorization": authHeader,
      },
    });

    if (r.status === 200) {
      return { ok: true, message: `Bucket "${cfg.bucket}" acessível na região ${cfg.region}.` };
    }
    if (r.status === 301 || r.status === 400) {
      const region = r.headers.get("x-amz-bucket-region");
      return {
        ok: false,
        message: region
          ? `Região incorreta. O bucket está em "${region}".`
          : `Resposta inesperada (HTTP ${r.status}).`,
        details: { status: r.status, region },
      };
    }
    if (r.status === 403) {
      return { ok: false, message: "Acesso negado: credenciais inválidas ou sem permissão no bucket." };
    }
    if (r.status === 404) {
      return { ok: false, message: `Bucket "${cfg.bucket}" não encontrado.` };
    }
    return { ok: false, message: `Falha HTTP ${r.status}.` };
  } catch (e) {
    return { ok: false, message: `Erro de rede: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/* ----------------------------- WhatsApp ----------------------------------- */

async function testWhatsapp(cfg: WppCfg): Promise<{ ok: boolean; message: string; details?: unknown }> {
  if (cfg.provider === "meta") {
    if (!cfg.phoneNumberId || !cfg.accessToken) {
      return { ok: false, message: "Phone Number ID e Access Token são obrigatórios." };
    }
    try {
      const r = await fetch(
        `https://graph.facebook.com/v20.0/${encodeURIComponent(cfg.phoneNumberId)}?fields=display_phone_number,verified_name`,
        { headers: { Authorization: `Bearer ${cfg.accessToken}` } },
      );
      const body = await r.json().catch(() => ({}));
      if (r.ok) {
        return {
          ok: true,
          message: `Conectado a ${(body as any).display_phone_number ?? "número"} (${(body as any).verified_name ?? "sem nome"}).`,
        };
      }
      return {
        ok: false,
        message: `Meta Graph respondeu ${r.status}: ${(body as any)?.error?.message ?? "erro desconhecido"}`,
      };
    } catch (e) {
      return { ok: false, message: `Erro de rede: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  return { ok: false, message: "Provedor não suportado — apenas Meta Cloud API é aceita." };
}

/* ------------------------------ Handler ----------------------------------- */

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Método não permitido" });
  }

  // Auth: exige token e role super_admin.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json(401, { error: "Não autorizado" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    return json(500, { error: "Variáveis de ambiente ausentes" });
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user?.id) {
    return json(401, { error: "Sessão inválida" });
  }
  const userId = userData.user.id;

  const { data: isAdmin, error: roleErr } = await supabase.rpc("is_super_admin", { _user_id: userId });
  if (roleErr || !isAdmin) {
    return json(403, { error: "Acesso restrito ao Super Admin" });
  }

  let payload: { integration?: Integration; config?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "JSON inválido" });
  }
  const { integration, config } = payload;
  if (!integration || !config || typeof config !== "object") {
    return json(400, { error: "Parâmetros 'integration' e 'config' são obrigatórios" });
  }

  try {
    let result: { ok: boolean; message: string; details?: unknown };
    switch (integration) {
      case "smtp":
        result = await testSmtp(config as SmtpCfg);
        break;
      case "ai":
        result = await testAi(config as AiCfg);
        break;
      case "s3":
        result = await testS3(config as S3Cfg);
        break;
      case "whatsapp":
        result = await testWhatsapp(config as WppCfg);
        break;
      default:
        return json(400, { error: `Integração desconhecida: ${integration}` });
    }
    return json(200, { integration, ...result });
  } catch (e) {
    return json(500, {
      integration,
      ok: false,
      message: `Erro interno ao testar conexão: ${e instanceof Error ? e.message : String(e)}`,
    });
  }
});