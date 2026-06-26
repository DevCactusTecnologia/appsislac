// ai-transcribe — voz → texto via ElevenLabs Scribe.
// Mesmo contrato anterior (multipart `file`, retorna { text }) — apenas troca de provedor.
import { aiCorsHeaders, authenticate, jsonResponse } from "../_shared/aiAuth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: aiCorsHeaders });

  const auth = await authenticate(req);
  if (!auth.ok) return auth.response;

  let cfgKey = "";
  try {
    const { data } = await auth.admin
      .from("saas_settings")
      .select("value")
      .eq("key", "elevenlabs_config")
      .maybeSingle();
    cfgKey = (((data as { value?: unknown } | null)?.value as { apiKey?: string } | null)?.apiKey ?? "").trim();
  } catch { /* noop */ }
  const ELEVEN_KEY = (cfgKey || Deno.env.get("ELEVENLABS_API_KEY") || "").trim();
  if (!ELEVEN_KEY) return jsonResponse({ error: "missing_elevenlabs_api_key" }, 500);

  let form: FormData;
  try { form = await req.formData(); }
  catch { return jsonResponse({ error: "expected_multipart" }, 400); }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return jsonResponse({ error: "empty_audio" }, 400);
  }
  if (file.size > 20 * 1024 * 1024) {
    return jsonResponse({ error: "audio_too_large" }, 413);
  }

  const upstream = new FormData();
  upstream.append("file", file, file.name || "recording.webm");
  upstream.append("model_id", "scribe_v1");
  // ElevenLabs usa ISO 639-3; "por" = português.
  const lang = form.get("language");
  upstream.append("language_code", typeof lang === "string" && lang.length >= 2 ? "por" : "por");
  upstream.append("tag_audio_events", "false");
  upstream.append("diarize", "false");

  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": ELEVEN_KEY },
    body: upstream,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return jsonResponse({ error: "transcription_failed", status: res.status, message: txt.slice(0, 300) }, res.status);
  }

  const data = await res.json().catch(() => null) as { text?: string } | null;
  return jsonResponse({ text: (data?.text ?? "").trim() });
});
