// WhatsApp 2.0 — Template Sync.
// Responsabilidade única: ler os templates aprovados na conta Meta Business
// (WABA) e atualizar a tabela `whatsapp_templates_cache`. A Meta é a única
// fonte de verdade. Sem CRUD manual.

import { createClient } from "../_shared/runtime/createClient.ts";

import { corsHeaders } from "../_shared/cors.ts";
const WABA_ID = Deno.env.get("WHATSAPP_META_BUSINESS_ACCOUNT_ID") ?? "";
const META_TOKEN = Deno.env.get("WHATSAPP_META_ACCESS_TOKEN") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

type MetaTemplate = {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components?: Array<{ type: string; text?: string; buttons?: unknown[] }>;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!WABA_ID || !META_TOKEN || !SUPABASE_URL || !SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "missing_config" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let url: string | null = `https://graph.facebook.com/v21.0/${WABA_ID}/message_templates?limit=100`;
  const all: MetaTemplate[] = [];
  try {
    while (url) {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${META_TOKEN}` } });
      const j = await r.json();
      if (!r.ok) {
        return new Response(JSON.stringify({ error: "meta_fetch_failed", detail: j }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = (j as { data?: MetaTemplate[]; paging?: { next?: string } });
      for (const t of data.data ?? []) all.push(t);
      url = data.paging?.next ?? null;
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: "fetch_error", message: String(e) }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let upserts = 0;
  for (const t of all) {
    const body = t.components?.find((c) => c.type === "BODY")?.text ?? null;
    const buttons = t.components?.find((c) => c.type === "BUTTONS")?.buttons ?? null;
    const varCount = body ? (body.match(/\{\{\d+\}\}/g)?.length ?? 0) : 0;
    await admin.from("whatsapp_templates_cache").upsert({
      nome: t.name,
      idioma: t.language || "pt_BR",
      categoria: t.category,
      status: t.status,
      corpo: body,
      botoes: buttons,
      variaveis_count: varCount,
      meta_template_id: t.id,
      meta_payload: t as unknown as Record<string, unknown>,
      sincronizado_em: new Date().toISOString(),
    }, { onConflict: "nome,idioma" });
    upserts++;
  }

  return new Response(JSON.stringify({ ok: true, total: all.length, upserts }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
