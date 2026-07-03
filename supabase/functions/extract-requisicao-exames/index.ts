import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { corsHeaders } from "../_shared/cors.ts";
interface ExtractRequest {
  /** Lista de arquivos (1+ páginas) em base64. */
  files: { name?: string; mimeType: string; dataBase64: string }[];
  /** Catálogo de exames disponíveis (nomes). Usado para casamento aproximado. */
  catalogo?: string[];
  /** Solicitantes selecionados no atendimento (nomes). Usado para tentar atribuir exame->solicitante. */
  solicitantes?: string[];
}

interface ExameDetectado {
  /** Nome conforme aparece no documento (cru). */
  nomeOriginal: string;
  /** Nome casado com o catálogo do laboratório (quando possível). */
  nomeCatalogo?: string;
  /** Solicitante atribuído pela IA (quando há mais de um e o documento permite identificar). */
  solicitante?: string;
  /** Confiança do casamento com o catálogo. */
  confianca?: "alta" | "media" | "baixa";
}

function bad(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function norm(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Casa nome detectado contra o catálogo (igualdade normalizada → contém → contido). */
function matchCatalogo(detectado: string, catalogo: string[]): { match?: string; confianca: "alta" | "media" | "baixa" } {
  const d = norm(detectado);
  if (!d) return { confianca: "baixa" };
  const cat = catalogo.map((c) => ({ raw: c, n: norm(c) }));
  const eq = cat.find((c) => c.n === d);
  if (eq) return { match: eq.raw, confianca: "alta" };
  const starts = cat.find((c) => c.n.startsWith(d) || d.startsWith(c.n));
  if (starts) return { match: starts.raw, confianca: "media" };
  const contains = cat.find((c) => c.n.includes(d) || d.includes(c.n));
  if (contains) return { match: contains.raw, confianca: "media" };
  return { confianca: "baixa" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return bad(405, "Method not allowed");

  let body: ExtractRequest;
  try {
    body = await req.json();
  } catch {
    return bad(400, "JSON inválido");
  }

  if (!body || !Array.isArray(body.files) || body.files.length === 0) {
    return bad(400, "Envie pelo menos um arquivo em 'files'.");
  }
  if (body.files.length > 6) {
    return bad(400, "Envie no máximo 6 arquivos por extração.");
  }

  const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
  for (const f of body.files) {
    if (!f?.dataBase64 || !f?.mimeType) return bad(400, "Arquivo inválido.");
    if (!allowed.includes(f.mimeType)) {
      return bad(400, `Formato não suportado: ${f.mimeType}. Use JPG, PNG, WEBP ou PDF.`);
    }
    if (f.dataBase64.length > 12_000_000) {
      return bad(413, "Arquivo muito grande. Limite ~9 MB por documento.");
    }
  }

  const catalogo = Array.isArray(body.catalogo) ? body.catalogo.filter((s) => typeof s === "string" && s.trim()) : [];
  const solicitantes = Array.isArray(body.solicitantes)
    ? body.solicitantes.filter((s) => typeof s === "string" && s.trim())
    : [];

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return bad(500, "LOVABLE_API_KEY não configurada");

  const systemPrompt = [
    "Você é um extrator de pedidos médicos de exames laboratoriais brasileiros.",
    "Receberá imagens/PDF de uma requisição (pedido de exames). Pode haver mais de uma página do mesmo pedido OU pedidos de médicos diferentes na mesma imagem.",
    "Sua tarefa: listar TODOS os exames solicitados, sem inventar.",
    "Regras:",
    "- Devolva o nome do exame EXATAMENTE como aparece no documento (campo 'nomeOriginal').",
    "- Se houver UMA lista comum de exames assinada por mais de um médico (ou simplesmente o pedido em conjunto), NÃO atribua solicitante específico — deixe vazio.",
    "- Se o documento mostrar claramente blocos separados por médico (cada médico com seus exames), atribua o nome do solicitante (campo 'solicitante') a cada exame correspondente.",
    "- Use APENAS solicitantes que aparecem na lista 'solicitantes_disponiveis' fornecida no input. Se o nome do médico no documento não bater com nenhum da lista, deixe 'solicitante' vazio.",
    "- NÃO duplique exames no mesmo pedido (case-insensitive). Se o mesmo exame aparece duas vezes para o MESMO solicitante, devolva uma vez só.",
    "- Não inclua observações clínicas, hipóteses diagnósticas, materiais ou orientações como exames.",
    "- Devolva exclusivamente via tool call 'extract_requisicao'.",
  ].join("\n");

  const userParts: any[] = [
    {
      type: "text",
      text: [
        "Extraia os exames solicitados desta requisição médica.",
        catalogo.length > 0
          ? "Catálogo do laboratório (use só como contexto; devolva nome cru no campo 'nomeOriginal'):\n- " + catalogo.slice(0, 400).join("\n- ")
          : "",
        solicitantes.length > 1
          ? "solicitantes_disponiveis (atribua o exame a um destes APENAS se o documento deixar claro):\n- " + solicitantes.join("\n- ")
          : solicitantes.length === 1
          ? "solicitantes_disponiveis: apenas " + solicitantes[0] + " (não preencha o campo 'solicitante' — só faz sentido com mais de um)."
          : "solicitantes_disponiveis: vazio — não preencha o campo 'solicitante'.",
      ].filter(Boolean).join("\n\n"),
    },
    ...body.files.map((f) => ({
      type: "image_url",
      image_url: { url: `data:${f.mimeType};base64,${f.dataBase64}` },
    })),
  ];

  const aiBody = {
    model: "google/gemini-2.5-pro",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userParts },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "extract_requisicao",
          description: "Lista de exames lidos da requisição médica.",
          parameters: {
            type: "object",
            properties: {
              exames: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    nomeOriginal: { type: "string" },
                    solicitante: { type: "string", description: "Nome de um solicitante da lista, ou vazio." },
                  },
                  required: ["nomeOriginal"],
                  additionalProperties: false,
                },
              },
            },
            required: ["exames"],
            additionalProperties: false,
          },
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "extract_requisicao" } },
  };

  let aiResp: Response;
  try {
    aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(aiBody),
    });
  } catch (e) {
    console.error("AI gateway fetch error", e);
    return bad(502, "Falha ao contatar o serviço de IA.");
  }

  if (!aiResp.ok) {
    if (aiResp.status === 429) return bad(429, "Muitas requisições à IA. Tente novamente em instantes.");
    if (aiResp.status === 402) return bad(402, "Créditos da IA esgotados.");
    const text = await aiResp.text().catch(() => "");
    console.error("AI gateway error", aiResp.status, text);
    return bad(502, "Falha ao processar a requisição.");
  }

  const data = await aiResp.json();
  const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
  const argsRaw = toolCall?.function?.arguments;
  if (!argsRaw) return bad(422, "Não foi possível identificar exames na imagem.");

  let parsed: { exames?: { nomeOriginal?: string; solicitante?: string }[] };
  try {
    parsed = typeof argsRaw === "string" ? JSON.parse(argsRaw) : argsRaw;
  } catch {
    return bad(422, "Resposta da IA em formato inválido.");
  }

  const lista = Array.isArray(parsed.exames) ? parsed.exames : [];
  const solicitantesNorm = new Set(solicitantes.map((s) => norm(s)));

  const detectados: ExameDetectado[] = [];
  const seen = new Set<string>();
  for (const ex of lista) {
    const original = (ex?.nomeOriginal || "").trim();
    if (!original) continue;
    const k = norm(original);
    if (!k || seen.has(k)) continue;
    seen.add(k);

    const m = catalogo.length > 0 ? matchCatalogo(original, catalogo) : { confianca: "media" as const };
    const solicRaw = (ex?.solicitante || "").trim();
    const solicOk = solicRaw && solicitantes.length > 1 && solicitantesNorm.has(norm(solicRaw))
      ? solicitantes.find((s) => norm(s) === norm(solicRaw)) || ""
      : "";

    detectados.push({
      nomeOriginal: original,
      nomeCatalogo: m.match,
      solicitante: solicOk || undefined,
      confianca: m.confianca,
    });
  }

  return new Response(
    JSON.stringify({
      data: {
        exames: detectados,
        totalLidos: lista.length,
        forasDoCatalogo: detectados.filter((d) => !d.nomeCatalogo).length,
      },
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});