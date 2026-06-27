// ai-chat — única Edge Function operacional do Assistente SISLAC.
// Caminho oficial: Usuário → AssistenteSISLAC → ai-chat → Skills → Tools → Banco.
// Sem Manifest, sem Discovery, sem Quick Actions. Sem RPCs redundantes.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { convertToModelMessages, streamText, stepCountIs, type UIMessage } from "npm:ai@5.0.206";
import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible@1.0.41";
import { aiCorsHeaders, authenticate, jsonResponse, resolveAllowedCapabilities } from "../_shared/aiAuth.ts";
import { findCapabilityByTool } from "../_shared/registry.ts";
import { buildPacienteTools } from "./skills/paciente.ts";
import { buildAtendimentoTools } from "./skills/atendimento.ts";
import { buildResultadoTools } from "./skills/resultado.ts";

interface AIContext {
  mode?: "text" | "voice";
  route?: { path?: string; params?: Record<string, string> };
  focus?: Record<string, string | undefined>;
}

const SHARED_RULES = [
  `# ASSISTENTE SISLAC`,
  `Colaborador operacional do laboratório. Nunca chatbot, nunca IA genérica.`,
  `Princípio da verdade: nunca invente. Use exclusivamente as ferramentas disponíveis.`,
  `Confirmações: ações simples (pesquisar, abrir, listar) executam direto. Mutações (gravar resultado, cadastrar) são confirmadas pela interface — você apenas chama a tool.`,
  `Idioma: PT-BR. Vírgula decimal ("4,5" = 4,5).`,
  `Capabilities ausentes: diga "Essa operação ainda não está disponível."`,
].join("\n");

const PROMPT_TEXT = [
  SHARED_RULES,
  ``,
  `## Estilo (texto)`,
  `Respostas curtas e informativas. Markdown leve quando útil (listas, negrito).`,
  `Resuma resultados de forma operacional. Após executar uma tool, confirme em 1 frase.`,
].join("\n");

const PROMPT_VOICE = [
  SHARED_RULES,
  ``,
  `## Estilo (voz)`,
  `Será lido em voz alta. Frases curtas, ≤ 8 palavras quando possível.`,
  `Nunca use markdown, listas, asteriscos ou emojis.`,
  `Pós-execução: "Pronto.", "Salvo.", "Localizei três.", "Hemácias gravado."`,
  `Em ditado de múltiplos parâmetros, repita só o nome do parâmetro confirmado.`,
].join("\n");

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
  const mode: "text" | "voice" = ctx.mode === "voice" ? "voice" : "text";

  const allowed = await resolveAllowedCapabilities(admin, userId);
  const allowedToolKeys = new Set(allowed.map((c) => c.tool));

  const allTools = {
    ...buildPacienteTools(userClient),
    ...buildAtendimentoTools(userClient),
    ...buildResultadoTools(userClient),
  };
  const toolMap: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(allTools)) {
    if (allowedToolKeys.has(k)) toolMap[k] = v;
  }

  const systemPrompt = [
    mode === "voice" ? PROMPT_VOICE : PROMPT_TEXT,
    ``,
    `## Contexto atual`,
    JSON.stringify({ route: ctx.route, focus: ctx.focus, mode }),
    ``,
    `## Capabilities autorizadas`,
    allowed.map((c) => `- ${c.id} → ${c.tool}${c.needsApproval ? " (needs_approval)" : ""}`).join("\n") || "- nenhuma",
  ].join("\n");

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
      onStepFinish: async (step) => {
        // Auditoria estruturada por execução de Tool (Etapa 9).
        const calls = step.toolCalls ?? [];
        const results = step.toolResults ?? [];
        for (const call of calls) {
          const cap = findCapabilityByTool(call.toolName);
          const res = results.find((r) => r.toolCallId === call.toolCallId);
          const okOut = res?.output as { ok?: boolean; error?: { code?: string; message?: string } } | undefined;
          const status = okOut?.ok === false ? "error" : "ok";
          await admin.from("ai_audit").insert({
            tenant_id: tenantId,
            user_id: userId,
            thread_id: body.threadId ?? null,
            skill: cap?.category ?? "router",
            capability: cap?.id ?? call.toolName,
            action: call.toolName,
            status,
            duration_ms: Date.now() - started,
            needs_approval: cap?.needsApproval ?? false,
            origin: "ai-chat",
            error_code: okOut?.error?.code ?? null,
            metadata: { mode, input: call.input, summary: okOut?.error?.message ?? "ok" },
          });
        }
      },
      onFinish: async ({ finishReason, usage }) => {
        // Apenas marcador final de turno; auditoria de execução está em onStepFinish.
        if (finishReason === "error") {
          await admin.from("ai_audit").insert({
            tenant_id: tenantId, user_id: userId,
            skill: "router", status: "error",
            duration_ms: Date.now() - started, needs_approval: false,
            origin: "ai-chat", metadata: { mode, usage, finishReason },
          });
        }
      },
    });

    return result.toUIMessageStreamResponse({ headers: aiCorsHeaders });
  } catch (e) {
    const msg = (e as Error)?.message ?? String(e);
    await admin.from("ai_audit").insert({
      tenant_id: tenantId, user_id: userId, skill: "router",
      status: "error", duration_ms: Date.now() - started,
      needs_approval: false, origin: "ai-chat", error_code: "STREAM_FAIL",
      metadata: { message: msg, mode },
    });
    return jsonResponse({ error: "stream_failed", message: msg }, 500);
  }
});
