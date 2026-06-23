// Edge function: soroteca-reorganizar-galeria
// Sugere um plano de remanejamento de amostras dentro de uma galeria.
// NÃO aplica nada — apenas retorna o plano; a aplicação é client-side via RPC mover_amostra.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RL_MAX = 10;
const RL_WINDOW_MS = 5 * 60 * 1000;
const rl = new Map<string, { count: number; resetAt: number }>();
function checkRl(key: string) {
  const now = Date.now();
  const cur = rl.get(key);
  if (!cur || cur.resetAt <= now) {
    rl.set(key, { count: 1, resetAt: now + RL_WINDOW_MS });
    return { ok: true, retryAfter: 0 };
  }
  if (cur.count >= RL_MAX) return { ok: false, retryAfter: Math.ceil((cur.resetAt - now) / 1000) };
  cur.count += 1;
  return { ok: true, retryAfter: 0 };
}

interface MovItem {
  amostra_id: string;
  amostra_codigo: string;
  paciente_nome: string | null;
  posicao_origem_id: string;
  posicao_origem_codigo: string;
  posicao_destino_id: string;
  posicao_destino_codigo: string;
  motivo: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) return json({ error: "Unauthorized" }, 401);
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return json({ error: "Server misconfigured" }, 500);
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const token = authHeader.slice(7).trim();
    const { data: claims } = await supabase.auth.getClaims(token);
    const userId = claims?.claims?.sub as string | undefined;
    if (!userId) return json({ error: "Unauthorized" }, 401);
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
    const r = checkRl(`${userId}|${ip}`);
    if (!r.ok) return json({ error: "rate-limit" }, 429, { "Retry-After": String(r.retryAfter) });

    const { galeria_id } = (await req.json()) as { galeria_id?: string };
    if (!galeria_id) return json({ error: "galeria_id obrigatório" }, 400);

    // Carrega contexto da galeria
    const { data: gal } = await supabase
      .from("galerias")
      .select("id, nome, local_id, locais_armazenamento!inner(nome, temperatura_min, temperatura_max)")
      .eq("id", galeria_id)
      .maybeSingle();
    if (!gal) return json({ error: "galeria_inexistente" }, 404);

    const { data: posicoes } = await supabase
      .from("posicoes_galeria")
      .select("id, codigo, ordem, ativo")
      .eq("galeria_id", galeria_id)
      .eq("ativo", true)
      .order("ordem")
      .order("codigo");
    const posArr = (posicoes ?? []) as Array<{ id: string; codigo: string; ordem: number }>;
    if (posArr.length === 0) return json({ movimentacoes: [], resumo: "Galeria vazia.", ganho_estimado: "0", fonte: "fallback" });

    const { data: alocs } = await supabase
      .from("amostra_alocacoes")
      .select("posicao_id, alocada_em, amostra_id, amostras!inner(id, codigo_barra, tipo_material, atendimento_id)")
      .is("retirada_em", null)
      .in("posicao_id", posArr.map((p) => p.id));

    type Aloc = { posicao_id: string; alocada_em: string; amostra_id: string; amostras: { id: string; codigo_barra: string; tipo_material: string; atendimento_id: number | null } };
    const alocArr = (alocs ?? []) as unknown as Aloc[];

    // Pacientes (PII fica server-side, devolvido só no plano final)
    const atendIds = Array.from(new Set(alocArr.map((a) => a.amostras.atendimento_id).filter((v): v is number => v != null)));
    let pacMap = new Map<number, string | null>();
    if (atendIds.length) {
      const { data: ats } = await supabase.from("atendimentos").select("id, paciente_nome").in("id", atendIds);
      pacMap = new Map((ats ?? []).map((a) => [a.id as number, (a as { paciente_nome: string | null }).paciente_nome]));
    }

    // Retenção por material
    const materiais = Array.from(new Set(alocArr.map((a) => a.amostras.tipo_material)));
    const retMap = new Map<string, number | null>();
    if (materiais.length) {
      const { data: mats } = await supabase.from("materiais_amostra").select("nome, dias_retencao").in("nome", materiais);
      for (const m of (mats ?? []) as Array<{ nome: string; dias_retencao: number | null }>) retMap.set(m.nome, m.dias_retencao);
    }

    // Snapshot compacto para a IA
    const ocupadasPorPos = new Map<string, Aloc>();
    for (const a of alocArr) ocupadasPorPos.set(a.posicao_id, a);

    const snapshot = posArr.map((p) => {
      const a = ocupadasPorPos.get(p.id);
      if (!a) return { posicao_id: p.id, codigo: p.codigo, ordem: p.ordem, ocupada: false };
      const dias_retencao = retMap.get(a.amostras.tipo_material) ?? null;
      let dias_para_expurgo: number | null = null;
      if (dias_retencao != null && dias_retencao > 0) {
        const exp = new Date(a.alocada_em);
        exp.setDate(exp.getDate() + dias_retencao);
        dias_para_expurgo = Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      }
      return {
        posicao_id: p.id,
        codigo: p.codigo,
        ordem: p.ordem,
        ocupada: true,
        amostra_id: a.amostra_id,
        material: a.amostras.tipo_material,
        dias_para_expurgo,
      };
    });

    const livres = snapshot.filter((s) => !s.ocupada).length;
    const ocupadas = snapshot.length - livres;

    // Helper para enriquecer plano
    function enrich(mvs: Array<{ amostra_id: string; posicao_destino_id: string; motivo: string }>): MovItem[] {
      const out: MovItem[] = [];
      const seenDest = new Set<string>();
      for (const m of mvs) {
        const a = alocArr.find((x) => x.amostra_id === m.amostra_id);
        const pd = posArr.find((p) => p.id === m.posicao_destino_id);
        if (!a || !pd) continue;
        if (a.posicao_id === pd.id) continue;
        if (seenDest.has(pd.id)) continue;
        if (ocupadasPorPos.has(pd.id) && ocupadasPorPos.get(pd.id)!.amostra_id !== m.amostra_id) continue;
        seenDest.add(pd.id);
        const po = posArr.find((p) => p.id === a.posicao_id)!;
        out.push({
          amostra_id: m.amostra_id,
          amostra_codigo: a.amostras.codigo_barra,
          paciente_nome: a.amostras.atendimento_id != null ? pacMap.get(a.amostras.atendimento_id) ?? null : null,
          posicao_origem_id: a.posicao_id,
          posicao_origem_codigo: po.codigo,
          posicao_destino_id: pd.id,
          posicao_destino_codigo: pd.codigo,
          motivo: (m.motivo || "Reorganização IA").slice(0, 160),
        });
      }
      return out;
    }

    // Fallback determinístico: agrupa por material e empurra próximas-do-expurgo para o início (ordem baixa)
    function fallbackPlan(): MovItem[] {
      const ocupadas = snapshot.filter((s) => s.ocupada);
      ocupadas.sort((a, b) => {
        const da = a.dias_para_expurgo ?? 99999;
        const db = b.dias_para_expurgo ?? 99999;
        if (da !== db) return da - db;
        return (a.material || "").localeCompare(b.material || "");
      });
      const slots = [...posArr];
      const plano: Array<{ amostra_id: string; posicao_destino_id: string; motivo: string }> = [];
      for (let i = 0; i < ocupadas.length; i++) {
        const dest = slots[i];
        if (!dest) break;
        if (ocupadas[i].posicao_id === dest.id) continue;
        plano.push({
          amostra_id: ocupadas[i].amostra_id!,
          posicao_destino_id: dest.id,
          motivo: `Agrupar por material/expurgo (${ocupadas[i].material}, ${ocupadas[i].dias_para_expurgo ?? "—"}d)`,
        });
      }
      return enrich(plano);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      const mv = fallbackPlan();
      return json({
        movimentacoes: mv,
        resumo: `Plano determinístico — ${mv.length} movimentação(ões). ${ocupadas} ocupadas / ${livres} livres.`,
        ganho_estimado: mv.length > 0 ? "Agrupa amostras próximas do expurgo nas posições de saída." : "Sem ganho identificado.",
        fonte: "fallback",
      });
    }

    const sys =
      "Você é um especialista em logística de soroteca. Receba o snapshot de uma galeria e proponha um plano de remanejamento. " +
      "Otimize: 1) agrupar amostras do mesmo material, 2) colocar amostras próximas do expurgo nas posições de menor ordem (saída fácil), " +
      "3) consolidar posições livres contíguas. Use APENAS posicao_id e amostra_id do snapshot. " +
      "Evite movimentações desnecessárias. Responda SEMPRE pelo tool call propor_plano.";

    const userMsg = JSON.stringify({
      galeria: gal.nome,
      total_posicoes: snapshot.length,
      livres,
      ocupadas,
      snapshot,
    });

    const ai = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: userMsg },
        ],
        tools: [{
          type: "function",
          function: {
            name: "propor_plano",
            description: "Devolve plano de remanejamento.",
            parameters: {
              type: "object",
              properties: {
                movimentacoes: {
                  type: "array",
                  maxItems: 50,
                  items: {
                    type: "object",
                    properties: {
                      amostra_id: { type: "string" },
                      posicao_destino_id: { type: "string" },
                      motivo: { type: "string" },
                    },
                    required: ["amostra_id", "posicao_destino_id", "motivo"],
                  },
                },
                resumo: { type: "string" },
                ganho_estimado: { type: "string" },
              },
              required: ["movimentacoes", "resumo"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "propor_plano" } },
      }),
    });

    if (ai.status === 429) return json({ error: "Limite IA. Tente novamente." }, 429);
    if (ai.status === 402) return json({ error: "Créditos IA esgotados." }, 402);
    if (!ai.ok) {
      console.error("AI fail", await ai.text());
      const mv = fallbackPlan();
      return json({
        movimentacoes: mv,
        resumo: `Plano determinístico — IA falhou. ${mv.length} movimentação(ões).`,
        ganho_estimado: "Heurística por material e expurgo.",
        fonte: "fallback",
      });
    }

    const aiJson = await ai.json();
    const args = aiJson?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let parsed: { movimentacoes?: Array<{ amostra_id: string; posicao_destino_id: string; motivo: string }>; resumo?: string; ganho_estimado?: string } = {};
    try { parsed = typeof args === "string" ? JSON.parse(args) : args ?? {}; } catch (_e) { /* ignore */ }

    const mv = enrich(parsed.movimentacoes ?? []);
    if (mv.length === 0) {
      const fb = fallbackPlan();
      return json({
        movimentacoes: fb,
        resumo: parsed.resumo || `Plano determinístico — ${fb.length} movimentação(ões).`,
        ganho_estimado: parsed.ganho_estimado || "Heurística por material e expurgo.",
        fonte: "fallback",
      });
    }
    return json({
      movimentacoes: mv,
      resumo: parsed.resumo || `${mv.length} movimentação(ões) sugeridas.`,
      ganho_estimado: parsed.ganho_estimado || "—",
      fonte: "ia",
    });
  } catch (e) {
    console.error("soroteca-reorganizar-galeria error", e);
    return json({ error: e instanceof Error ? e.message : "erro" }, 500);
  }
});

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  });
}
