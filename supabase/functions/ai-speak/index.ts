// ai-speak — texto → áudio (TTS) via Lovable AI Gateway (openai/gpt-4o-mini-tts).
// Contrato preservado: { text, voice? } → { audio: base64Mp3, mime: "audio/mpeg" }.
import { aiCorsHeaders, authenticate, jsonResponse } from "../_shared/aiAuth.ts";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const DEFAULT_VOICE = "alloy";
const MAX_CHARS = 1500;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: aiCorsHeaders });

  const auth = await authenticate(req);
  if (!auth.ok) return auth.response;

  let body: { text?: string; voice?: string } = {};
  try { body = await req.json(); } catch { /* noop */ }

  const raw = (body.text ?? "").trim();
  if (!raw) return jsonResponse({ error: "empty_text" }, 400);

  const LOVABLE_KEY = (Deno.env.get("LOVABLE_API_KEY") ?? "").trim();
  if (!LOVABLE_KEY) return jsonResponse({ error: "missing_lovable_api_key" }, 500);

  const text = raw.length > MAX_CHARS ? raw.slice(0, MAX_CHARS) + "…" : raw;
  const voice = (body.voice ?? DEFAULT_VOICE).trim() || DEFAULT_VOICE;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_KEY}`,
      "Lovable-API-Key": LOVABLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini-tts",
      input: text,
      voice,
      response_format: "mp3",
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return jsonResponse({ error: "tts_failed", status: res.status, message: txt.slice(0, 300) }, res.status);
  }

  const buf = new Uint8Array(await res.arrayBuffer());
  return jsonResponse({ audio: encodeBase64(buf), mime: "audio/mpeg" });
});
