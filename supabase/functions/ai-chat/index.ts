// ai-chat — única Edge Function operacional do Assistente do SISLAC.
// Responsabilidades: contexto, registry, streaming, tool calling, auditoria.
// Bootstrap (JWT, tenant, permissões) é delegado ao _shared/aiAuth.ts.
// NUNCA: SQL direto, lógica de negócio, tenant vindo do frontend.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { convertToModelMessages, streamText, stepCountIs, type UIMessage } from "npm:ai@5.0.206";
import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible@1.0.41";
import { aiCorsHeaders, authenticate, jsonResponse, resolveAllowedCapabilities } from "../_shared/aiAuth.ts";
import { buildPacienteTools } from "./skills/paciente.ts";
import { buildAtendimentoTools } from "./skills/atendimento.ts";
import { buildResultadoTools } from "./skills/resultado.ts";

interface AIContext {
  module?: string;
  route?: { path?: string; params?: Record<string, string> };
  focus?: Record<string, string | undefined>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: aiCorsHeaders });

  const started = Date.now();
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return jsonResponse({ error: "missing_lovable_api_key" }, 500);

  const auth = await authenticate(req);
  if (!auth.ok) return auth.response;
  const { admin, userClient, userId, tenantId } = auth;

  let body: { messages?: UIMessage[]; context?: AIContext; threadId?: string };
  try { body = await req.json(); } catch { body = {}; }
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const ctx = body.context ?? {};

  const allowed = await resolveAllowedCapabilities(admin, userId);

  // Tools (apenas as autorizadas)
  const allTools = { ...buildPacienteTools(userClient), ...buildAtendimentoTools(userClient), ...buildResultadoTools(userClient) };
  const toolMap: Record<string, unknown> = {};
  for (const cap of allowed) {
    const key = cap.id.replace(".", "_");
    if (key in allTools) toolMap[key] = (allTools as Record<string, unknown>)[key];
  }

  const systemPrompt =
    `Você é o Assistente do SISLAC, colaborador experiente do laboratório. ` +
    `Profissional, claro, acolhedor e humano. Nunca se identifique como IA. ` +
    `Frases curtas e naturais — suas respostas podem ser lidas em voz alta. ` +
    `\n\nREGRAS DE FERRAMENTAS (OBRIGATÓRIO — nunca responda apenas com texto quando uma ferramenta couber):\n` +
    `1) ABRIR/LANÇAR/ACESSAR atendimento, paciente, resultado ou exame → chame resultado_open imediatamente.\n` +
    `2) Ditar UM valor para UM parâmetro (ex.: "4,5 em Hemácias", "Hemoglobina 13,8", "VCM 88") → chame resultado_set_valor com _confirmed: true.\n` +
    `3) Ditar VÁRIOS valores na mesma frase → chame resultado_set_varios com _confirmed: true (UMA única chamada com todos).\n` +
    `4) Contar/resumir atendimentos → atendimento_count / atendimento_summary. Exames de um paciente → paciente_exames. Criar paciente → paciente_create.\n` +
    `5) Se faltar paciente/exame, use o último mencionado nesta conversa. Só pergunte se realmente não houver contexto.\n` +
    `6) PT-BR: aceite vírgula decimal ("4,5" = 4,5). Repasse o valor exato falado pelo usuário.\n` +
    `7) APÓS executar uma tool, responda SEMPRE em UMA frase curta confirmando (ex.: "Pronto, gravei 4,5 em Hemácias."). Jamais fique em silêncio.\n` +
    `8) Para perguntas conceituais/livres sem dados reais, responda naturalmente.\n\n` +
    `Contexto atual: ${JSON.stringify(ctx)}. ` +
    `Capacidades autorizadas: ${allowed.map((c) => `${c.id} (${c.title})`).join(", ") || "nenhuma"}.`;

  const gateway = createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": LOVABLE_API_KEY,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });

  try {
    const result = streamText({
      model: gateway("google/gemini-2.5-flash"),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      tools: toolMap as never,
      stopWhen: stepCountIs(5),
      maxOutputTokens: 2048,
      onFinish: async ({ text, usage, finishReason }) => {
        await admin.from("ai_audit").insert({
          tenant_id: tenantId,
          user_id: userId,
          thread_id: body.threadId ?? null,
          skill: "router",
          capability: null,
          action: null,
          status: finishReason === "error" ? "error" : "ok",
          duration_ms: Date.now() - started,
          needs_approval: false,
          origin: "ai-chat",
          metadata: { usage, finishReason, text_len: text?.length ?? 0 },
        });
      },
    });

    return result.toUIMessageStreamResponse({ headers: aiCorsHeaders });
  } catch (e) {
    const msg = (e as Error)?.message ?? String(e);
    await admin.from("ai_audit").insert({
      tenant_id: tenantId, user_id: userId, skill: "router",
      status: "error", duration_ms: Date.now() - started,
      origin: "ai-chat", error_code: "STREAM_FAIL", metadata: { message: msg },
    });
    return jsonResponse({ error: "stream_failed", message: msg }, 500);
  }
});
