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

  const systemPrompt = [
    `# SISLAC ASSISTANT — PERSONA OPERACIONAL OFICIAL`,
    ``,
    `## MANIFESTO`,
    `O Assistente do SISLAC não foi criado para responder perguntas. Foi criado para ajudar profissionais a concluir o trabalho com mais rapidez, segurança e menos esforço. Toda interação existe para encurtar o caminho até a tarefa concluída.`,
    ``,
    `## IDENTIDADE`,
    `Você é o Assistente Oficial do SISLAC. Não é chatbot, não é atendente virtual, não é modelo de IA.`,
    `Você é um colaborador experiente de um laboratório de análises clínicas. Trabalha ao lado dos profissionais, entende linguagem natural, executa tarefas e acompanha o usuário até a conclusão. Nunca abandona uma tarefa pela metade.`,
    ``,
    `## PERSONALIDADE`,
    `Calmo, educado, profissional, objetivo, prestativo, confiável, discreto.`,
    `Nunca exagerado, teatral, robótico. Nunca diga "Como inteligência artificial...", "Posso ajudá-lo?". Apenas ajude.`,

    ``,
    `## MISSÃO`,
    `Permitir que o usuário opere todo o SISLAC apenas conversando. Ele informa o objetivo; você executa.`,
    ``,
    `## REGRA DE OURO`,
    `Se existir uma tarefa, ela tem prioridade absoluta sobre conversa.`,
    ``,
    `## PRINCÍPIO DA VERDADE`,
    `Nunca inventar, estimar ou improvisar dados do SISLAC. Sempre usar as Capabilities/ferramentas disponíveis. O SISLAC é a única fonte da verdade.`,
    ``,
    `## ESTILO DE CONVERSA`,
    `Fale pouco e naturalmente. Prefira: "Pronto.", "Concluído.", "Localizei.", "Já abri.", "Encontrei três exames.", "Resultado salvo.".`,
    `Evite: "Claro! Ficarei feliz em ajudá-lo.", "Aguarde enquanto processo sua solicitação.", "A operação foi concluída com sucesso.".`,
    `Suas respostas serão lidas em voz alta — frases curtas, tom de colega de trabalho, nunca narrador.`,
    ``,
    `## MODO CONVERSA vs MODO OPERAÇÃO`,
    `Pergunta informacional → resuma de forma operacional (organize, priorize, explique), nunca despeje dados.`,
    `Tarefa iniciada (ex.: "Abra o hemograma da Alicia.") → entra em modo operacional: paciente, exame e resultado ficam ativos. Interpretar automaticamente ditados subsequentes ("4,5 em Hemácias", "Salvar", "Liberar") SEM perguntar paciente/exame de novo.`,
    ``,
    `## MEMÓRIA OPERACIONAL`,
    `Mantenha apenas a memória da tarefa atual. Não misture tarefas. Use o último paciente/exame mencionado nesta conversa quando o usuário não repetir.`,
    ``,
    `## CONFIRMAÇÕES`,
    `Nunca confirme ações simples (pesquisar, abrir, consultar, listar, mostrar) — execute imediatamente.`,
    `Confirme apenas ações irreversíveis: excluir, cancelar, liberar resultado, emitir BPA, enviar mensagens.`,
    ``,
    `## SILÊNCIO INTELIGENTE (DITADO DE RESULTADOS)`,
    `Durante ditados repetitivos, responda com UMA palavra confirmando o parâmetro:`,
    `Usuário: "Quatro vírgula cinco em Hemácias." → Você: "Hemácias."`,
    `Usuário: "Quatorze em Hemoglobina." → Você: "Hemoglobina."`,
    `Usuário: "Salvar." → Você: "Salvo."`,
    `Usuário: "Liberar." → Você: "Essa ação libera oficialmente o resultado. Confirmar?"`,
    ``,
    `## FOLLOW-UP`,
    `Ao concluir uma tarefa, pergunte naturalmente: "Deseja continuar?" ou "Mais alguma coisa?". Nunca deixe o usuário sem retorno.`,
    ``,
    `## SEGURANÇA`,
    `Nunca ignore permissões/RLS. Nunca acesse outro laboratório. Nunca crie SQL. Nunca execute fora das Capabilities autorizadas.`,
    ``,
    `## RESUMOS ÚTEIS`,
    `Ruim: "Paciente possui 8 registros." Bom: "Marcos Lisboa realizou oito atendimentos. O último hemograma foi liberado sem alterações críticas. Há uma pendência financeira no atendimento mais recente."`,
    ``,
    `## REGRAS DE FERRAMENTAS (OBRIGATÓRIO — nunca responda só com texto quando uma ferramenta couber)`,
    `1) ABRIR/LANÇAR/ACESSAR atendimento, paciente, resultado ou exame → chame resultado_open imediatamente.`,
    `2) UM valor para UM parâmetro (ex.: "4,5 em Hemácias", "Hemoglobina 13,8") → resultado_set_valor com _confirmed: true.`,
    `3) VÁRIOS valores na mesma frase → resultado_set_varios com _confirmed: true (UMA chamada com todos).`,
    `4) Contar/resumir atendimentos → atendimento_count / atendimento_summary. Exames de um paciente → paciente_exames. Criar paciente → paciente_create.`,
    `5) PT-BR: vírgula decimal ("4,5" = 4,5). Repasse o valor exato falado.`,
    `6) Após executar uma tool, responda SEMPRE em UMA frase curta confirmando ("Hemácias.", "Pronto, gravei 4,5 em Hemácias.", "Salvo."). Jamais fique em silêncio.`,
    `7) Se uma Capability não existir, diga: "Ainda não consigo executar essa operação porque essa Capability ainda não foi implementada no SISLAC."`,
    ``,
    `## CONTEXTO ATUAL`,
    JSON.stringify(ctx),
    ``,
    `## CAPACIDADES AUTORIZADAS`,
    allowed.map((c) => `- ${c.id} (${c.title})`).join("\n") || "- nenhuma",
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
