// Webhook publico chamado pela Meta (Facebook) para entregar status de
// mensagens enviadas via WhatsApp Cloud API.
//
// - GET ?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
//   Faz o handshake. Aceita se algum tenant tiver esse webhook_verify_token
//   cadastrado em tenant_whatsapp_config.
//
// - POST { entry: [{ changes: [{ value: { statuses: [...] } }] }] }
//   Atualiza whatsapp_mensagens.status conforme status.id.
//
// Não exige JWT (chamado pela Meta).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// =====================================================================
// Validação HMAC-SHA256 do header `x-hub-signature-256` enviado pela Meta.
// Modo soft: se WHATSAPP_APP_SECRET não estiver configurado, apenas loga
// um warning e processa normalmente (compatibilidade). Quando o secret for
// configurado, qualquer payload com assinatura inválida é rejeitado (401).
// =====================================================================
async function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const provided = signatureHeader.slice("sha256=".length).trim().toLowerCase();
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // timing-safe compare
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response("service unavailable", { status: 500, headers: corsHeaders });
  }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ===== Handshake da Meta =====
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const tokenSent = url.searchParams.get("hub.verify_token") ?? "";
    const challenge = url.searchParams.get("hub.challenge") ?? "";
    if (mode !== "subscribe" || !tokenSent) {
      return new Response("forbidden", { status: 403, headers: corsHeaders });
    }
    const { data, error } = await admin
      .from("tenant_whatsapp_config")
      .select("id")
      .eq("webhook_verify_token", tokenSent)
      .limit(1);
    if (error || !data || data.length === 0) {
      return new Response("forbidden", { status: 403, headers: corsHeaders });
    }
    return new Response(challenge, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }

  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405, headers: corsHeaders });
  }

  // ===== Validação HMAC do payload (Meta) =====
  const rawBody = await req.text();
  const appSecret = Deno.env.get("WHATSAPP_APP_SECRET");
  const signatureHeader = req.headers.get("x-hub-signature-256");
  // Fail-closed: sem WHATSAPP_APP_SECRET configurado, recusamos o payload.
  if (!appSecret) {
    console.error("whatsapp-webhook: WHATSAPP_APP_SECRET not configured — rejecting payload (fail-closed).");
    return new Response("webhook not configured", { status: 503, headers: corsHeaders });
  }
  const valid = await verifyMetaSignature(rawBody, signatureHeader, appSecret);
  if (!valid) {
    console.warn("whatsapp-webhook: invalid signature, rejecting payload");
    return new Response("invalid signature", { status: 401, headers: corsHeaders });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response("invalid json", { status: 400, headers: corsHeaders });
  }

  type StatusItem = { id: string; status: string; timestamp?: string; errors?: unknown };
  type WhatsappEntry = {
    changes?: Array<{ value?: { statuses?: StatusItem[] } }>;
  };
  const entries = (body as { entry?: WhatsappEntry[] })?.entry ?? [];
  const all: StatusItem[] = [];
  for (const e of entries) {
    for (const c of e.changes ?? []) {
      for (const s of c.value?.statuses ?? []) all.push(s);
    }
  }

  for (const s of all) {
    if (!s?.id) continue;
    const validStatus = ["sent", "delivered", "read", "failed"].includes(s.status)
      ? s.status
      : "sent";
    const errMsg = (s.errors && JSON.stringify(s.errors).slice(0, 500)) || null;
    await admin
      .from("whatsapp_mensagens")
      .update({
        status: validStatus,
        erro: errMsg,
      })
      .eq("message_id", s.id);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});