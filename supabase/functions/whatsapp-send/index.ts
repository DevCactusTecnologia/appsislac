// @deprecated WhatsApp 2.0 — substituído pelo fluxo centralizado
// (`enqueue_whatsapp` + edge function `whatsapp-dispatcher`). Mantido em
// produção apenas para tenants ainda nos modos legados `simples`, `cloud_api`
// e `zapi`. Será removido quando 100% dos tenants estiverem em `centralized`.
//
// Envia um PDF de comprovante via WhatsApp Cloud API (Meta) usando as
// credenciais configuradas pelo laboratório (tabela tenant_whatsapp_config).
//
// Fluxo:
//   1. Recebe { telefone, pdfUrl, caption, atendimentoProtocolo, tipo }
//   2. Resolve tenant + credenciais
//   3. Posta em https://graph.facebook.com/v21.0/<phone_number_id>/messages
//      type=document, document.link=<pdfUrl>
//   4. Registra em whatsapp_mensagens com message_id
//
// O laboratório precisa ter cadastrado phone_number_id + access_token
// + ativo=true em Configurações → Laboratório → WhatsApp.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.3";
import {
  createLogger,
  errorResponse,
  jsonResponse,
  newRequestId,
  preflight,
} from "../_shared/hardening.ts";

interface Body {
  telefone: string;
  pdfUrl: string;
  filename?: string;
  caption?: string;
  atendimentoProtocolo?: string;
  tipo?: string;
  /** P0 #4 — idempotency key calculada no frontend: sha256(tenant|protocolo|tipo|telefone|bucket5min). */
  idempotencyKey?: string;
}

/** Computa idempotencyKey caso o frontend não envie (defesa em profundidade). */
async function computeIdempotencyKey(
  tenantId: string,
  protocolo: string | undefined,
  tipo: string | undefined,
  telefone: string,
): Promise<string> {
  const bucket = Math.floor(Date.now() / (5 * 60_000));
  const raw = `${tenantId}|${protocolo ?? ""}|${tipo ?? ""}|${telefone}|${bucket}`;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const arr = Array.from(new Uint8Array(buf));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizePhone(input: string): string {
  const d = input.replace(/\D/g, "");
  if (!d) return "";
  return d.startsWith("55") ? d : `55${d}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const requestId = newRequestId(req);
  const log = createLogger("whatsapp-send", requestId);

  if (req.method !== "POST") {
    return errorResponse(405, "method not allowed", requestId, log);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    return errorResponse(500, "service unavailable", requestId, log);
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

  const telefone = normalizePhone(String(body.telefone ?? ""));
  if (!telefone || telefone.length < 12) {
    return errorResponse(400, "telefone invalido", requestId, log);
  }
  if (!body.pdfUrl || !/^https?:\/\//.test(String(body.pdfUrl))) {
    return errorResponse(400, "pdfUrl invalida", requestId, log);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile } = await admin
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile?.tenant_id) {
    return errorResponse(403, "tenant nao resolvido", requestId, log);
  }
  const tenantId = profile.tenant_id as string;

  // P0 #4 — checagem de idempotência ANTES de tudo
  const idemKey = body.idempotencyKey ??
    await computeIdempotencyKey(tenantId, body.atendimentoProtocolo, body.tipo, telefone);
  {
    const { data: prev } = await admin
      .from("whatsapp_mensagens")
      .select("message_id, status, modo:tipo_documento")
      .eq("tenant_id", tenantId)
      .eq("idempotency_key", idemKey)
      .maybeSingle();
    if (prev?.message_id && prev.status === "sent") {
      log.info("idempotent_replay", { idemKey, messageId: prev.message_id });
      return jsonResponse(200, {
        messageId: prev.message_id,
        status: "sent",
        idempotent: true,
      }, requestId);
    }
  }

  const { data: cfg } = await admin
    .from("tenant_whatsapp_config")
    .select(
      "modo, phone_number_id, access_token, zapi_instance_id, zapi_token, zapi_client_token, ativo",
    )
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!cfg || !cfg.ativo) {
    return errorResponse(
      412,
      "WhatsApp nao configurado para este laboratorio",
      requestId,
      log,
    );
  }

  const modo = (cfg.modo as string | null) ?? "simples";
  const filename = (body.filename ?? "comprovante.pdf").replace(/[^A-Za-z0-9._-]/g, "_");
  const caption = (body.caption ?? "").slice(0, 1024);

  // Modo simples nao envia pelo backend — o frontend usa wa.me com shortlink.
  if (modo === "simples") {
    return errorResponse(
      412,
      "Modo Simples: envio aberto no WhatsApp Web pelo frontend",
      requestId,
      log,
    );
  }

  let messageId: string | null = null;
  let status: "sent" | "failed" = "failed";
  let erroMsg: string | null = null;
  let respJson: unknown = null;

  try {
    if (modo === "cloud_api") {
      if (!cfg.phone_number_id || !cfg.access_token) {
        return errorResponse(412, "Cloud API incompleto", requestId, log);
      }
      const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: telefone,
        type: "document",
        document: { link: body.pdfUrl, filename, caption },
      };
      const r = await fetch(
        `https://graph.facebook.com/v21.0/${cfg.phone_number_id}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cfg.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );
      respJson = await r.json().catch(() => ({}));
      if (!r.ok) {
        erroMsg =
          (respJson as { error?: { message?: string } })?.error?.message ??
          `meta_http_${r.status}`;
      } else {
        messageId =
          (respJson as { messages?: Array<{ id?: string }> })?.messages?.[0]?.id ?? null;
        status = messageId ? "sent" : "failed";
        if (!messageId) erroMsg = "meta_no_message_id";
      }
    } else if (modo === "zapi") {
      if (!cfg.zapi_instance_id || !cfg.zapi_token) {
        return errorResponse(412, "Z-API incompleto", requestId, log);
      }
      const url =
        `https://api.z-api.io/instances/${cfg.zapi_instance_id}` +
        `/token/${cfg.zapi_token}/send-document/pdf`;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (cfg.zapi_client_token) headers["Client-Token"] = cfg.zapi_client_token;
      const r = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          phone: telefone,
          document: body.pdfUrl,
          fileName: filename,
          caption,
        }),
      });
      respJson = await r.json().catch(() => ({}));
      if (!r.ok) {
        erroMsg =
          (respJson as { error?: string; message?: string })?.error ??
          (respJson as { message?: string })?.message ??
          `zapi_http_${r.status}`;
      } else {
        messageId =
          (respJson as { messageId?: string; id?: string })?.messageId ??
          (respJson as { id?: string })?.id ??
          null;
        status = messageId ? "sent" : "failed";
        if (!messageId) erroMsg = "zapi_no_message_id";
      }
    } else {
      return errorResponse(412, `modo invalido: ${modo}`, requestId, log);
    }
  } catch (e) {
    erroMsg = e instanceof Error ? e.message : String(e);
  }

  // P0 #4 — grava com idempotency_key (apenas se sent, para permitir retentativa de falhas)
  await admin.from("whatsapp_mensagens").insert({
    tenant_id: tenantId,
    atendimento_protocolo: body.atendimentoProtocolo ?? null,
    telefone_destino: telefone,
    tipo_documento: body.tipo ?? null,
    message_id: messageId,
    status,
    erro: erroMsg,
    payload: respJson as Record<string, unknown> | null,
    enviado_por: userId,
    idempotency_key: status === "sent" ? idemKey : null,
  });

  if (status !== "sent") {
    return errorResponse(502, erroMsg ?? "envio falhou", requestId, log);
  }

  return jsonResponse(200, { messageId, status, modo }, requestId);
});