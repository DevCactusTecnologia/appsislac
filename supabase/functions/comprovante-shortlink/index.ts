// Cria um link curto (codigo de 6 caracteres) que aponta para a URL
// assinada de um comprovante PDF. O front chama esta função após fazer
// o upload do PDF e usa o shortlink no lugar da URL gigante do Storage.
//
// - Requer JWT (resolução de tenant via profiles)
// - Expiração: 24h (default; configurável por body.ttlHours até 168h)
// - Retorna: { codigo, shortUrl, expiraEm }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.3";
import {
  createLogger,
  errorResponse,
  jsonResponse,
  newRequestId,
  preflight,
} from "../_shared/hardening.ts";
import { checkRateLimit, extractIp } from "../_shared/rateLimit.ts";

interface Body {
  url: string;
  protocolo: string;
  tipo: "pagamento" | "atendimento" | "comparecimento";
  ttlHours?: number;
  /** Domínio custom do tenant (ex: meulab.com.br). Frontend envia se conhecer.
   *  Sem isso, retornamos apenas o codigo e o front monta o host. */
  hostHint?: string;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem caracteres ambíguos

function gerarCodigo(len = 6): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();

  const requestId = newRequestId(req);
  const log = createLogger("comprovante-shortlink", requestId);

  if (req.method !== "POST") {
    return errorResponse(405, "method not allowed", requestId, log);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    return errorResponse(500, "service unavailable", requestId, log, "missing env");
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse(401, "unauthorized", requestId, log);
  }
  const token = authHeader.slice("Bearer ".length).trim();

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claims?.claims?.sub) {
    return errorResponse(401, "unauthorized", requestId, log, claimsErr ?? "no claims");
  }
  const userId = claims.claims.sub as string;

  let body: Partial<Body>;
  try {
    body = (await req.json()) as Partial<Body>;
  } catch (e) {
    return errorResponse(400, "invalid JSON body", requestId, log, e);
  }

  if (!body.url || typeof body.url !== "string" || !/^https?:\/\//.test(body.url)) {
    return errorResponse(400, "url is required and must be http(s)", requestId, log);
  }
  if (!body.protocolo || typeof body.protocolo !== "string") {
    return errorResponse(400, "protocolo is required", requestId, log);
  }
  if (!body.tipo || !["pagamento", "atendimento", "comparecimento"].includes(body.tipo)) {
    return errorResponse(400, "tipo invalido", requestId, log);
  }
  const ttl = Math.min(Math.max(Number(body.ttlHours) || 24, 1), 168);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (profileErr || !profile?.tenant_id) {
    return errorResponse(403, "tenant nao resolvido", requestId, log, profileErr);
  }
  const tenantId = profile.tenant_id as string;

  // Resolve host: dominio_custom > slug > host hint > origin
  const { data: tenant } = await admin
    .from("tenants")
    .select("slug, dominio_custom")
    .eq("id", tenantId)
    .maybeSingle();

  // Tenta gerar codigo unico (até 5 tentativas)
  let codigo = "";
  const expiraEm = new Date(Date.now() + ttl * 3600_000).toISOString();
  for (let attempt = 0; attempt < 5; attempt++) {
    codigo = gerarCodigo(6);
    const { error: insErr } = await admin.from("comprovante_links").insert({
      tenant_id: tenantId,
      codigo,
      url_assinada: body.url,
      atendimento_protocolo: body.protocolo,
      tipo: body.tipo,
      expira_em: expiraEm,
      criado_por: userId,
    });
    if (!insErr) break;
    if (attempt === 4) {
      log.error("insert_failed", { err: insErr });
      return errorResponse(502, "nao foi possivel criar o link", requestId, log, insErr);
    }
  }

  // Monta a shortUrl. Prioridade: domínio custom > origin enviado pelo client.
  // O front monta /p/:codigo na rota pública.
  const origin = body.hostHint?.replace(/\/+$/, "") ?? "";
  let shortUrl = "";
  if (tenant?.dominio_custom) {
    shortUrl = `https://${tenant.dominio_custom.replace(/^https?:\/\//, "").replace(/\/+$/, "")}/p/${codigo}`;
  } else if (origin) {
    shortUrl = `${origin}/p/${codigo}`;
  } else if (tenant?.slug) {
    shortUrl = `https://sislac.lovable.app/p/${codigo}`;
  } else {
    shortUrl = `https://sislac.lovable.app/p/${codigo}`;
  }

  return jsonResponse(
    200,
    { codigo, shortUrl, expiraEm, slug: tenant?.slug ?? null, dominioCustom: tenant?.dominio_custom ?? null },
    requestId,
  );
});