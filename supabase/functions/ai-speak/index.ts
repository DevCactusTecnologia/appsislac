// ai-speak — texto → áudio (TTS) via ElevenLabs.
// Modelo TRAVADO em `eleven_v3` (decisão de produto — não trocar).
// Recebe { text, voiceId? }, devolve { audio: base64Mp3, mime }.
// Lê voiceId/apiKey do saas_settings (key: elevenlabs_config) quando não informado.
import { aiCorsHeaders, authenticate, jsonResponse } from "../_shared/aiAuth.ts";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

// Voz padrão (PT-BR) — voz personalizada do laboratório.
const DEFAULT_VOICE = "7iqXtOF3wl3pomwXFY7G";
// Modelo fixo, não configurável.
const FIXED_MODEL = "eleven_v3";
const MAX_CHARS = 1200;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: aiCorsHeaders });

  const auth = await authenticate(req);
  if (!auth.ok) return auth.response;

  let body: { text?: string; voiceId?: string } = {};
  try { body = await req.json(); } catch { /* noop */ }

  const raw = (body.text ?? "").trim();
  if (!raw) return jsonResponse({ error: "empty_text" }, 400);

  // Busca config global do ElevenLabs (voiceId/apiKey opcionais; modelId IGNORADO).
  let cfg: { apiKey?: string; voiceId?: string } = {};
  try {
    const { data } = await auth.admin
      .from("saas_settings")
      .select("value")
      .eq("key", "elevenlabs_config")
      .maybeSingle();
    cfg = ((data as { value?: unknown } | null)?.value as typeof cfg) ?? {};
  } catch { /* mantém defaults */ }

  const ELEVEN_KEY = (cfg.apiKey?.trim() || Deno.env.get("ELEVENLABS_API_KEY") || "").trim();
  if (!ELEVEN_KEY) return jsonResponse({ error: "missing_elevenlabs_api_key" }, 500);

  const text = raw.length > MAX_CHARS ? raw.slice(0, MAX_CHARS) + "…" : raw;
  const voiceId = (body.voiceId ?? cfg.voiceId ?? DEFAULT_VOICE).trim() || DEFAULT_VOICE;

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
        // Modelo travado — eleven_v3 (mais expressivo e natural em PT-BR).
        model_id: FIXED_MODEL,
        // Configurações otimizadas para soar humano e conversacional.
        voice_settings: {
          stability: 0.35,
          similarity_boost: 0.85,
          style: 0.55,
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
  return jsonResponse({ audio: encodeBase64(buf), mime: "audio/mpeg" });
});

