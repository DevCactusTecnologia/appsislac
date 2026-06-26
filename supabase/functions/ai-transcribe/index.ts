// ai-transcribe — adaptador de voz → texto do Assistente do SISLAC.
// Não cria nova arquitetura: apenas converte áudio em texto e devolve.
// O texto retorna ao cliente e segue exatamente o mesmo fluxo do ai-chat.
import { aiCorsHeaders, authenticate, jsonResponse } from "../_shared/aiAuth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: aiCorsHeaders });

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return jsonResponse({ error: "missing_lovable_api_key" }, 500);

  const auth = await authenticate(req);
  if (!auth.ok) return auth.response;

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
  upstream.append("model", "openai/gpt-4o-mini-transcribe");
  upstream.append("file", file, file.name || "recording.wav");
  const language = form.get("language");
  if (typeof language === "string" && /^[a-z]{2}$/.test(language)) {
    upstream.append("language", language);
  }

  const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}` },
    body: upstream,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return jsonResponse({ error: "transcription_failed", status: res.status, message: txt.slice(0, 300) }, res.status);
  }

  const data = await res.json().catch(() => null) as { text?: string } | null;
  return jsonResponse({ text: data?.text ?? "" });
});
