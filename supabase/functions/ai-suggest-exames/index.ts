// Edge function: ai-suggest-exames
// Sugere exames laboratoriais com base na queixa clínica usando Lovable AI Gateway (Gemini 2.5 Flash).
// Retorna JSON estruturado via tool calling.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "../_shared/runtime/createClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// =====================================================================
// Rate limit em memória (best-effort, por instância da edge function).
// 20 requisições por janela de 5 minutos por par (user_id|ip).
// =====================================================================
const RL_MAX = 20;
const RL_WINDOW_MS = 5 * 60 * 1000;
const rlBuckets = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const cur = rlBuckets.get(key);
  if (!cur || cur.resetAt <= now) {
    rlBuckets.set(key, { count: 1, resetAt: now + RL_WINDOW_MS });
    return { ok: true, retryAfter: 0 };
  }
  if (cur.count >= RL_MAX) {
    return { ok: false, retryAfter: Math.ceil((cur.resetAt - now) / 1000) };
  }
  cur.count += 1;
  return { ok: true, retryAfter: 0 };
}

interface RequestBody {
  queixa: string;
  sexo?: string;        // "M" | "F" | "Masculino" | "Feminino" | etc.
  idade?: number | string;
  exames_atuais?: string[];          // já adicionados no atendimento
  historico_exames?: string[];       // exames realizados em atendimentos anteriores
  catalogo_disponivel?: string[];    // exames cadastrados no tenant
  foco?: "triagem" | "investigacao" | "acompanhamento" | string; // foco clínico da sugestão
}

interface SugestaoExame {
  exame: string;
  justificativa: string;
  confianca?: "alta" | "media" | "baixa";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ---------- AuthN: exige JWT válido (usuário logado) ----------
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return new Response(
        JSON.stringify({ error: "Server misconfigured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const token = authHeader.slice(7).trim();
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    const userId = claimsData?.claims?.sub as string | undefined;
    if (claimsError || !userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---------- Rate limit por user_id + IP ----------
    const ip =
      (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";
    const rlKey = `${userId}|${ip}`;
    const rl = checkRateLimit(rlKey);
    if (!rl.ok) {
      return new Response(
        JSON.stringify({ error: "Limite de requisições atingido. Aguarde alguns minutos." }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(rl.retryAfter),
          },
        },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = (await req.json()) as RequestBody;
    const queixa = (body.queixa || "").trim();

    if (!queixa || queixa.length < 3) {
      return new Response(
        JSON.stringify({ error: "Queixa muito curta. Informe ao menos uma descrição." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Truncate inputs defensively to keep the prompt compact and predictable.
    const sexo = (body.sexo || "Não informado").toString().slice(0, 30);
    const idade = body.idade != null ? String(body.idade).slice(0, 30) : "Não informada";
    const examesAtuais = (body.exames_atuais || []).slice(0, 50).map((s) => String(s).slice(0, 120));
    const historico = (body.historico_exames || []).slice(0, 50).map((s) => String(s).slice(0, 120));
    const catalogo = (body.catalogo_disponivel || []).slice(0, 400).map((s) => String(s).slice(0, 120));
    const focoRaw = (body.foco || "triagem").toString().toLowerCase().trim();
    const foco: "triagem" | "investigacao" | "acompanhamento" =
      focoRaw === "investigacao" || focoRaw === "investigação" ? "investigacao"
      : focoRaw === "acompanhamento" ? "acompanhamento"
      : "triagem";

    const focoTexto =
      foco === "investigacao"
        ? "INVESTIGAÇÃO APROFUNDADA — sugira exames específicos para confirmar/excluir hipóteses diagnósticas, incluindo testes de segunda linha, marcadores específicos e exames complementares."
        : foco === "acompanhamento"
          ? "ACOMPANHAMENTO — sugira exames de monitoramento de condição já estabelecida, priorizando exames presentes no histórico do paciente para comparação evolutiva."
          : "TRIAGEM — sugira exames de rastreio amplo, baratos e de alta sensibilidade para investigação inicial.";

    const systemPrompt =
      `Você é um assistente clínico-laboratorial especializado em sugerir exames pertinentes ` +
      `a uma queixa do paciente em um laboratório de análises clínicas no Brasil. ` +
      `Regras OBRIGATÓRIAS:\n` +
      `1) Sugira de 3 a 8 exames, do mais relevante para o menos relevante.\n` +
      `2) Se um catálogo de exames disponíveis for fornecido, SUGIRA APENAS exames cuja grafia exista ` +
      `nesse catálogo (case-insensitive). Use exatamente a grafia do catálogo no campo "exame".\n` +
      `3) NÃO sugira exames que já estejam em "exames já adicionados".\n` +
      `4) Considere idade, sexo e histórico ao priorizar (ex.: repetir HbA1c se diabético; PSA somente em homens).\n` +
      `5) Cada justificativa deve ter no máximo 140 caracteres, em português, objetiva, sem jargão excessivo.\n` +
      `6) Não invente diagnósticos. Use linguagem cautelosa ("avaliar", "investigar", "rastrear").\n` +
      `7) Retorne SEMPRE pelo tool call sugerir_exames. Nunca responda em texto livre.\n` +
      `8) FOCO solicitado: ${focoTexto}\n` +
      `9) Para cada sugestão, atribua "confianca" como "alta", "media" ou "baixa" conforme: ` +
      `alta = forte indicação clínica direta para a queixa; media = indicação razoável/complementar; ` +
      `baixa = exame de descarte ou contexto fraco.`;

    const userPrompt =
      `Queixa do paciente: "${queixa}"\n` +
      `Sexo: ${sexo}\n` +
      `Idade: ${idade}\n` +
      `Foco da sugestão: ${foco}\n\n` +
      `Exames já adicionados neste atendimento (NÃO repetir):\n${examesAtuais.length ? examesAtuais.map((e) => `- ${e}`).join("\n") : "(nenhum)"}\n\n` +
      `Histórico recente de exames do paciente (apenas para contexto):\n${historico.length ? historico.slice(0, 30).map((e) => `- ${e}`).join("\n") : "(sem histórico)"}\n\n` +
      `Catálogo de exames disponíveis no laboratório (use exatamente esta grafia):\n${catalogo.length ? catalogo.join(", ") : "(catálogo não fornecido — sugira exames laboratoriais comuns no Brasil)"}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "sugerir_exames",
              description: "Retorna uma lista priorizada de exames laboratoriais com justificativa clínica curta.",
              parameters: {
                type: "object",
                properties: {
                  sugestoes: {
                    type: "array",
                    minItems: 1,
                    maxItems: 8,
                    items: {
                      type: "object",
                      properties: {
                        exame: { type: "string", description: "Nome do exame, conforme catálogo quando fornecido." },
                        justificativa: { type: "string", description: "Por que este exame é pertinente. Máx 140 chars." },
                        confianca: {
                          type: "string",
                          enum: ["alta", "media", "baixa"],
                          description: "Nível de confiança clínica da sugestão.",
                        },
                      },
                      required: ["exame", "justificativa", "confianca"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["sugestoes"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "sugerir_exames" } },
      }),
    });

    if (aiResponse.status === 429) {
      return new Response(
        JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (aiResponse.status === 402) {
      return new Response(
        JSON.stringify({ error: "Créditos da IA esgotados. Adicione créditos no workspace." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error", aiResponse.status, errText);
      return new Response(
        JSON.stringify({ error: "Falha na IA. Tente novamente." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiJson = await aiResponse.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    const argsRaw = toolCall?.function?.arguments;

    let sugestoes: SugestaoExame[] = [];
    if (argsRaw) {
      try {
        const parsed = typeof argsRaw === "string" ? JSON.parse(argsRaw) : argsRaw;
        if (Array.isArray(parsed?.sugestoes)) {
          sugestoes = parsed.sugestoes
            .filter((s: unknown): s is SugestaoExame =>
              !!s && typeof (s as SugestaoExame).exame === "string" &&
              typeof (s as SugestaoExame).justificativa === "string",
            )
            .map((s: SugestaoExame) => {
              const c = (s.confianca || "media").toString().toLowerCase().trim();
              const conf: "alta" | "media" | "baixa" =
                c === "alta" ? "alta" : c === "baixa" ? "baixa" : "media";
              return {
                exame: s.exame.trim().slice(0, 160),
                justificativa: s.justificativa.trim().slice(0, 240),
                confianca: conf,
              };
            });
        }
      } catch (e) {
        console.error("Failed to parse tool arguments", e, argsRaw);
      }
    }

    // Filter out duplicates (case-insensitive) just in case the model returned something already in examesAtuais.
    const atuaisNorm = new Set(examesAtuais.map((s) => s.toUpperCase().trim()));
    sugestoes = sugestoes.filter((s) => !atuaisNorm.has(s.exame.toUpperCase().trim()));

    // Heurística híbrida: se o exame está no histórico recente, sobe a confiança um nível
    // (forte sinal clínico de que faz sentido repetir). Apenas para foco != "triagem".
    const historicoNorm = new Set(historico.map((s) => s.toUpperCase().trim()));
    if (foco !== "triagem") {
      sugestoes = sugestoes.map((s) => {
        if (historicoNorm.has(s.exame.toUpperCase().trim())) {
          const upgrade: Record<"alta" | "media" | "baixa", "alta" | "media" | "baixa"> = {
            baixa: "media",
            media: "alta",
            alta: "alta",
          };
          return { ...s, confianca: upgrade[s.confianca || "media"] };
        }
        return s;
      });
    }

    return new Response(
      JSON.stringify({ sugestoes, foco }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("ai-suggest-exames error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});