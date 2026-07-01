// Edge function: soroteca-sugerir-posicao
// Sugere a melhor posição de armazenamento para uma amostra usando Lovable AI Gateway.
// Fallback determinístico se a IA falhar ou devolver posição inválida.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "../_shared/runtime/createClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Rate limit: 30/5min por user
const RL_MAX = 30;
const RL_WINDOW_MS = 5 * 60 * 1000;
const rlBuckets = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string) {
  const now = Date.now();
  const cur = rlBuckets.get(key);
  if (!cur || cur.resetAt <= now) {
    rlBuckets.set(key, { count: 1, resetAt: now + RL_WINDOW_MS });
    return { ok: true, retryAfter: 0 };
  }
  if (cur.count >= RL_MAX) return { ok: false, retryAfter: Math.ceil((cur.resetAt - now) / 1000) };
  cur.count += 1;
  return { ok: true, retryAfter: 0 };
}

interface Body {
  amostra_id: string;
}

interface Sugestao {
  posicao_id: string;
  posicao_codigo: string;
  galeria_nome: string;
  local_nome: string;
  score: number;
  motivo: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return json({ error: "Server misconfigured" }, 500);

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const token = authHeader.slice(7).trim();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    const userId = claimsData?.claims?.sub as string | undefined;
    if (claimsError || !userId) return json({ error: "Unauthorized" }, 401);

    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
    const rl = checkRateLimit(`${userId}|${ip}`);
    if (!rl.ok) return json({ error: "rate-limit" }, 429, { "Retry-After": String(rl.retryAfter) });

    const body = (await req.json()) as Body;
    if (!body.amostra_id) return json({ error: "amostra_id obrigatório" }, 400);

    // 1) Amostra + material
    const { data: amostra } = await supabase
      .from("amostras")
      .select("id, codigo_barra, tipo_material, data_coleta, atendimento_id")
      .eq("id", body.amostra_id)
      .maybeSingle();
    if (!amostra) return json({ error: "amostra não encontrada" }, 404);

    const { data: material } = await supabase
      .from("materiais_amostra")
      .select("nome, dias_retencao, temperatura_recomendada")
      .eq("nome", amostra.tipo_material)
      .maybeSingle();

    // 2) Locais ativos + galerias + posições livres
    const { data: locais } = await supabase
      .from("locais_armazenamento")
      .select("id, nome, tipo, temperatura_min, temperatura_max, ativo")
      .eq("ativo", true);
    if (!locais || locais.length === 0) {
      return json({ error: "nenhum local cadastrado", sugestao: null, alternativas: [] }, 200);
    }
    const { data: galerias } = await supabase
      .from("galerias")
      .select("id, nome, local_id, ativo")
      .eq("ativo", true)
      .in("local_id", locais.map((l) => l.id as string));
    const galeriasArr = galerias ?? [];
    if (galeriasArr.length === 0) {
      return json({ sugestao: null, alternativas: [], motivo: "Nenhuma galeria ativa." }, 200);
    }

    const { data: posicoes } = await supabase
      .from("posicoes_galeria")
      .select("id, codigo, galeria_id, ordem, ativo")
      .eq("ativo", true)
      .in("galeria_id", galeriasArr.map((g) => g.id as string))
      .order("ordem");
    const posArr = posicoes ?? [];
    if (posArr.length === 0) return json({ sugestao: null, alternativas: [], motivo: "Sem posições." }, 200);

    const { data: ocupadas } = await supabase
      .from("amostra_alocacoes")
      .select("posicao_id, alocada_em, amostras!inner(tipo_material)")
      .is("retirada_em", null)
      .in("posicao_id", posArr.map((p) => p.id as string));
    const ocupSet = new Set((ocupadas ?? []).map((o) => (o as { posicao_id: string }).posicao_id));

    // Posições livres com contexto enriquecido
    const livres = posArr
      .filter((p) => !ocupSet.has(p.id as string))
      .map((p) => {
        const g = galeriasArr.find((x) => x.id === p.galeria_id)!;
        const l = locais.find((x) => x.id === g.local_id)!;
        return {
          posicao_id: p.id as string,
          posicao_codigo: p.codigo as string,
          galeria_id: g.id as string,
          galeria_nome: g.nome as string,
          local_id: l.id as string,
          local_nome: l.nome as string,
          local_tipo: l.tipo as string,
          tmin: l.temperatura_min as number | null,
          tmax: l.temperatura_max as number | null,
        };
      });
    if (livres.length === 0) {
      return json({ sugestao: null, alternativas: [], motivo: "Sem posições livres." }, 200);
    }

    // Vizinhos de cada galeria — prazo de expurgo similar = cluster bom
    const vizinhos: Record<string, { tipo_material: string; alocada_em: string }[]> = {};
    for (const o of (ocupadas ?? []) as Array<{
      posicao_id: string;
      alocada_em: string;
      amostras: { tipo_material: string };
    }>) {
      const p = posArr.find((x) => x.id === o.posicao_id);
      if (!p) continue;
      const gid = p.galeria_id as string;
      if (!vizinhos[gid]) vizinhos[gid] = [];
      vizinhos[gid].push({ tipo_material: o.amostras.tipo_material, alocada_em: o.alocada_em });
    }

    // Compatibilidade temperatura (heurística determinística)
    function compatTemp(lTmin: number | null, lTmax: number | null): boolean {
      const rec = (material?.temperatura_recomendada || "").toLowerCase();
      if (!rec) return true;
      if (lTmin == null || lTmax == null) return true;
      if (rec.includes("ambiente")) return lTmax >= 15 && lTmin <= 30;
      if (rec.includes("refriger") || rec.includes("2-8") || rec.includes("2 a 8")) return lTmin >= 2 && lTmax <= 10;
      if (rec.includes("-20") || rec.includes("congel")) return lTmax <= -15;
      if (rec.includes("-80") || rec.includes("ultra")) return lTmax <= -70;
      return true;
    }
    const candidatas = livres.filter((p) => compatTemp(p.tmin, p.tmax));
    const pool = candidatas.length > 0 ? candidatas : livres;

    // Top 8 amostras compactas para a IA (sem PII)
    const sample = pool.slice(0, 8).map((p) => ({
      posicao_id: p.posicao_id,
      caminho: `${p.local_nome} › ${p.galeria_nome} › ${p.posicao_codigo}`,
      local_tipo: p.local_tipo,
      temp: p.tmin != null && p.tmax != null ? `${p.tmin}°C..${p.tmax}°C` : "—",
      vizinhos_mesmo_material:
        (vizinhos[p.galeria_id] || []).filter((v) => v.tipo_material === amostra.tipo_material).length,
    }));

    const fallback = pool[0];

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return json(
        {
          sugestao: toSug(fallback, 50, "Fallback determinístico — IA indisponível."),
          alternativas: pool.slice(1, 3).map((p) => toSug(p, 40, "Próxima posição livre.")),
          fonte: "fallback",
        },
        200,
      );
    }

    const sys =
      "Você ajuda um técnico de soroteca a escolher a melhor posição livre para armazenar uma amostra. " +
      "Priorize: 1) compatibilidade térmica, 2) agrupar com amostras do mesmo material e prazo de expurgo similar, " +
      "3) menor fragmentação (preencher galerias já iniciadas antes de abrir novas). " +
      "Responda SEMPRE pelo tool call sugerir_posicao. Use IDs do conjunto fornecido.";

    const user = JSON.stringify({
      amostra: {
        material: amostra.tipo_material,
        retencao_dias: material?.dias_retencao ?? null,
        temperatura_recomendada: material?.temperatura_recomendada ?? null,
      },
      candidatas: sample,
    });

    const ai = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "sugerir_posicao",
              description: "Retorna a posição ideal e até 2 alternativas.",
              parameters: {
                type: "object",
                properties: {
                  escolhida: {
                    type: "object",
                    properties: {
                      posicao_id: { type: "string" },
                      score: { type: "number" },
                      motivo: { type: "string" },
                    },
                    required: ["posicao_id", "score", "motivo"],
                  },
                  alternativas: {
                    type: "array",
                    maxItems: 2,
                    items: {
                      type: "object",
                      properties: {
                        posicao_id: { type: "string" },
                        score: { type: "number" },
                        motivo: { type: "string" },
                      },
                      required: ["posicao_id", "motivo"],
                    },
                  },
                },
                required: ["escolhida"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "sugerir_posicao" } },
      }),
    });

    if (ai.status === 429) return json({ error: "Limite IA. Tente novamente." }, 429);
    if (ai.status === 402)
      return json({ error: "Créditos IA esgotados. Adicione créditos no workspace." }, 402);
    if (!ai.ok) {
      console.error("AI fail", await ai.text());
      return json(
        {
          sugestao: toSug(fallback, 50, "Fallback — IA falhou."),
          alternativas: pool.slice(1, 3).map((p) => toSug(p, 40, "Próxima livre.")),
          fonte: "fallback",
        },
        200,
      );
    }

    const aiJson = await ai.json();
    const args = aiJson?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let parsed: { escolhida?: { posicao_id: string; score: number; motivo: string }; alternativas?: { posicao_id: string; score?: number; motivo: string }[] } = {};
    try {
      parsed = typeof args === "string" ? JSON.parse(args) : args ?? {};
    } catch (_e) { /* ignore */ }

    const escolhida = parsed.escolhida;
    const find = (id: string) => pool.find((p) => p.posicao_id === id);
    const principalRaw = escolhida ? find(escolhida.posicao_id) : null;
    const principal = principalRaw ?? fallback;
    const principalSug = toSug(
      principal,
      escolhida?.score ?? 60,
      escolhida && principalRaw
        ? escolhida.motivo
        : "Fallback: posição livre compatível.",
    );

    const altsArr = parsed.alternativas ?? [];
    const alternativas: Sugestao[] = [];
    for (const a of altsArr) {
      if (a.posicao_id === principal.posicao_id) continue;
      const p = find(a.posicao_id);
      if (p) alternativas.push(toSug(p, a.score ?? 40, a.motivo));
    }
    while (alternativas.length < 2) {
      const next = pool.find(
        (p) => p.posicao_id !== principal.posicao_id && !alternativas.some((x) => x.posicao_id === p.posicao_id),
      );
      if (!next) break;
      alternativas.push(toSug(next, 30, "Próxima posição livre."));
    }

    return json(
      { sugestao: principalSug, alternativas: alternativas.slice(0, 2), fonte: principalRaw ? "ia" : "fallback" },
      200,
    );
  } catch (e) {
    console.error("soroteca-sugerir-posicao error", e);
    return json({ error: e instanceof Error ? e.message : "erro" }, 500);
  }
});

function toSug(
  p: { posicao_id: string; posicao_codigo: string; galeria_nome: string; local_nome: string },
  score: number,
  motivo: string,
): Sugestao {
  return {
    posicao_id: p.posicao_id,
    posicao_codigo: p.posicao_codigo,
    galeria_nome: p.galeria_nome,
    local_nome: p.local_nome,
    score: Math.max(0, Math.min(100, Math.round(score))),
    motivo: motivo.slice(0, 220),
  };
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  });
}
