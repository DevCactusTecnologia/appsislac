// ai-speak — texto → áudio (TTS) via ElevenLabs.
// Voz natural e humanizada para as respostas do Assistente.
// Recebe { text, voiceId? }, devolve { audio: base64Mp3, mime }.
import { aiCorsHeaders, authenticate, jsonResponse } from "../_shared/aiAuth.ts";
import { encode as base64Encode } from "https://deno.land/std@0.224.0/encoding/base64.ts";

// Voz padrão multilíngue (PT-BR soa bem): Sarah.
const DEFAULT_VOICE = "EXAVITQu4vr4xnSDxMaL";
const MAX_CHARS = 1200;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: aiCorsHeaders });

  const ELEVEN_KEY = Deno.env.get("ELEVENLABS_API_KEY");
  if (!ELEVEN_KEY) return jsonResponse({ error: "missing_elevenlabs_api_key" }, 500);

  const auth = await authenticate(req);
  if (!auth.ok) return auth.response;

  let body: { text?: string; voiceId?: string } = {};
  try { body = await req.json(); } catch { /* noop */ }

  const raw = (body.text ?? "").trim();
  if (!raw) return jsonResponse({ error: "empty_text" }, 400);

  // Limita para evitar custo/latência exagerados em respostas longas.
  const text = raw.length > MAX_CHARS ? raw.slice(0, MAX_CHARS) + "…" : raw;
  const voiceId = (body.voiceId ?? DEFAULT_VOICE).trim();

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": ELEVEN_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.8,
          style: 0.25,
          use_speaker_boost: true,
          speed: 1.0,
        },
      }),
    },
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return jsonResponse({ error: "tts_failed", status: res.status, message: txt.slice(0, 300) }, res.status);
  }

  const buf = new Uint8Array(await res.arrayBuffer());
  return jsonResponse({ audio: base64Encode(buf), mime: "audio/mpeg" });
});
