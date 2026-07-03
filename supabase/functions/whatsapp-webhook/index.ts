// Webhook publico chamado pela Meta (Facebook) para entregar:
//   1) Status de mensagens enviadas (sent / delivered / read / failed)
//   2) Mensagens recebidas — usadas para capturar opt-out (STOP/SAIR/CANCELAR)
//
// - GET ?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
//   Handshake. Aceita apenas se o token bater com WHATSAPP_META_VERIFY_TOKEN
//   (arquitetura centralizada Meta — Fase 3B).
//
// - POST body assinado por x-hub-signature-256 (HMAC SHA256 com
//   WHATSAPP_META_APP_SECRET).

import { createClient } from "../_shared/runtime/createClient.ts";

import { corsHeaders } from "../_shared/cors.ts";
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
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

const OPT_OUT_KEYWORDS = ["STOP", "SAIR", "CANCELAR", "PARAR", "UNSUBSCRIBE"];

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

  // ===== Handshake =====
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const tokenSent = url.searchParams.get("hub.verify_token") ?? "";
    const challenge = url.searchParams.get("hub.challenge") ?? "";
    const centralToken = Deno.env.get("WHATSAPP_META_VERIFY_TOKEN") ?? "";
    if (mode !== "subscribe" || !tokenSent || !centralToken || tokenSent !== centralToken) {
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

  const rawBody = await req.text();
  const appSecret = Deno.env.get("WHATSAPP_META_APP_SECRET");
  const signatureHeader = req.headers.get("x-hub-signature-256");
  if (!appSecret) {
    console.error("whatsapp-webhook: app secret not configured");
    return new Response("webhook not configured", { status: 503, headers: corsHeaders });
  }
  const valid = await verifyMetaSignature(rawBody, signatureHeader, appSecret);
  if (!valid) {
    console.warn("whatsapp-webhook: invalid signature, rejecting payload");
    return new Response("invalid signature", { status: 401, headers: corsHeaders });
  }

  let body: unknown;
  try { body = JSON.parse(rawBody); } catch {
    return new Response("invalid json", { status: 400, headers: corsHeaders });
  }

  type StatusItem = { id: string; status: string; timestamp?: string; errors?: unknown; recipient_id?: string };
  type IncomingMsg = { from: string; type: string; text?: { body?: string } };
  type WhatsappEntry = { changes?: Array<{ value?: { statuses?: StatusItem[]; messages?: IncomingMsg[] } }> };

  const entries = (body as { entry?: WhatsappEntry[] })?.entry ?? [];
  const statuses: StatusItem[] = [];
  const messages: IncomingMsg[] = [];
  for (const e of entries) {
    for (const c of e.changes ?? []) {
      for (const s of c.value?.statuses ?? []) statuses.push(s);
      for (const m of c.value?.messages ?? []) messages.push(m);
    }
  }

  // ----- Status updates -----
  for (const s of statuses) {
    if (!s?.id) continue;
    const validStatus = ["sent", "delivered", "read", "failed"].includes(s.status) ? s.status : "sent";
    const errMsg = (s.errors && JSON.stringify(s.errors).slice(0, 500)) || null;

    // 1) whatsapp_mensagens (legado + centralizado)
    await admin.from("whatsapp_mensagens").update({ status: validStatus, erro: errMsg }).eq("message_id", s.id);

    // 2) outbox (centralizado) — atualiza status final + métricas incrementais
    const { data: outboxRow } = await admin
      .from("whatsapp_outbox")
      .select("id, tenant_id, status")
      .eq("message_id", s.id)
      .maybeSingle();
    if (outboxRow) {
      if (validStatus !== "sent") {
        await admin.from("whatsapp_outbox").update({ status: validStatus === "failed" ? "failed_permanent" : "sent", erro: errMsg }).eq("id", outboxRow.id);
      }
      const today = new Date().toISOString().slice(0, 10);
      const patch: Record<string, number> = { enviados: 0, entregues: 0, lidos: 0, falhas: 0, opt_outs: 0 };
      if (validStatus === "delivered") patch.entregues = 1;
      else if (validStatus === "read") patch.lidos = 1;
      else if (validStatus === "failed") patch.falhas = 1;
      if (patch.entregues || patch.lidos || patch.falhas) {
        await admin.from("whatsapp_metrics_tenant").upsert({
          tenant_id: outboxRow.tenant_id, dia: today, ...patch,
        }, { onConflict: "tenant_id,dia", ignoreDuplicates: false });
      }
    }
  }

  // ----- Incoming messages — opt-out capture -----
  for (const m of messages) {
    if (m.type !== "text") continue;
    const txt = (m.text?.body ?? "").trim().toUpperCase();
    if (!OPT_OUT_KEYWORDS.some((k) => txt === k || txt.startsWith(k + " "))) continue;
    const phone = (m.from || "").replace(/\D/g, "");
    if (!phone) continue;
    // opt-out GLOBAL
    await admin.from("whatsapp_opt_out").upsert({
      tenant_id: null,
      telefone: phone,
      motivo: `keyword:${txt.slice(0, 32)}`,
      origem: "webhook",
    }, { onConflict: "telefone", ignoreDuplicates: true });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
