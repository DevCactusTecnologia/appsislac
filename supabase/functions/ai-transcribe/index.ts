// ai-transcribe — voz → texto via Lovable AI Gateway (openai/gpt-4o-mini-transcribe).
// Contrato: multipart `file` → { text }. Sem dependência de credenciais externas.
import { aiCorsHeaders, authenticate, jsonResponse } from "../_shared/aiAuth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: aiCorsHeaders });

  const auth = await authenticate(req);
  if (!auth.ok) return auth.response;

  const LOVABLE_KEY = (Deno.env.get("LOVABLE_API_KEY") ?? "").trim();
  if (!LOVABLE_KEY) return jsonResponse({ error: "missing_lovable_api_key" }, 500);

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
  upstream.append("file", file, file.name || "recording.webm");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_KEY}`,
      "Lovable-API-Key": LOVABLE_KEY,
    },
    body: upstream,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return jsonResponse({ error: "stt_failed", status: res.status, message: txt.slice(0, 300) }, res.status);
  }

  const data = await res.json().catch(() => ({} as { text?: string }));
  return jsonResponse({ text: (data as { text?: string })?.text ?? "" });
});
