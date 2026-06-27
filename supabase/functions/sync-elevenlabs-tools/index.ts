// Sync ElevenLabs Agent tools via Management API.
// POST -> aplica catálogo de tools no agente. Idempotente.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const AGENT_ID = "agent_2801kw31qjftetpbefenctpfnm8n";
const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY")!;

type Param = {
  id: string;
  type: "string" | "number" | "boolean";
  description: string;
  required?: boolean;
  value_type?: "llm_prompt";
};

type ClientTool = {
  type: "client";
  name: string;
  description: string;
  expects_response: boolean;
  response_timeout_secs?: number;
  parameters: Param[];
};

const P = (id: string, type: Param["type"], description: string, required = true): Param => ({
  id, type, description, required, value_type: "llm_prompt",
});

const TOOLS: ClientTool[] = [
  // ============ Navegação & Consultas ============
  {
    type: "client",
    name: "navegar_para",
    description: "Navega o usuário para uma área do SISLAC. Use quando pedir abrir/ir/mostrar uma tela.",
    expects_response: true,
    response_timeout_secs: 5,
    parameters: [P("destino", "string",
      "Chave: dashboard, atendimentos, novo_atendimento, coleta, analise, resultados, pacientes, orcamentos, lab_apoio, auditoria, especialistas, producao, impressao")],
  },
  {
    type: "client",
    name: "abrir_atendimento",
    description: "Abre o detalhe de um atendimento pelo número de protocolo (ex.: 0000003).",
    expects_response: true,
    response_timeout_secs: 8,
    parameters: [P("protocolo", "string", "Número do protocolo do atendimento")],
  },
  {
    type: "client",
    name: "abrir_resultado",
    description: "Abre a tela de resultado/laudo pelo protocolo do atendimento.",
    expects_response: true,
    response_timeout_secs: 8,
    parameters: [P("protocolo", "string", "Número do protocolo do atendimento")],
  },
  {
    type: "client",
    name: "contar_atendimentos",
    description: "Conta atendimentos do tenant. Período opcional: hoje, semana ou mes.",
    expects_response: true,
    response_timeout_secs: 6,
    parameters: [P("periodo", "string", "Opcional: hoje | semana | mes", false)],
  },
  {
    type: "client",
    name: "buscar_paciente",
    description: "Localiza paciente por nome parcial ou CPF.",
    expects_response: true,
    response_timeout_secs: 6,
    parameters: [P("termo", "string", "Nome parcial ou CPF do paciente")],
  },

  // ============ FASE 1 — RESULTADO ============
  {
    type: "client",
    name: "resultado_set_valor",
    description:
      "Grava o valor de UM parâmetro no atendimento aberto na tela. Use quando o usuário ditar 'parâmetro X é Y'.",
    expects_response: true,
    response_timeout_secs: 8,
    parameters: [
      P("parametro", "string", "Chave ou rótulo do parâmetro (ex.: HEMOGLOBINA, GLICOSE)"),
      P("valor", "string", "Valor a gravar (texto ou número como string)"),
    ],
  },
  {
    type: "client",
    name: "resultado_set_varios",
    description:
      "Grava vários parâmetros de uma vez na tela de resultado. Use para ditados longos. Formato: 'PARAM=VALOR; PARAM=VALOR'.",
    expects_response: true,
    response_timeout_secs: 10,
    parameters: [P("pares", "string", "Lista 'CHAVE=VALOR' separada por ; ou nova linha")],
  },
  {
    type: "client",
    name: "resultado_salvar",
    description: "Salva o resultado atual (rascunho) sem liberar.",
    expects_response: true,
    response_timeout_secs: 8,
    parameters: [],
  },
  {
    type: "client",
    name: "resultado_liberar",
    description:
      "Libera o resultado para impressão/entrega. Ação irreversível — só execute após o usuário confirmar verbalmente.",
    expects_response: true,
    response_timeout_secs: 10,
    parameters: [P("confirmado", "boolean", "Passe true somente se o usuário confirmou explicitamente")],
  },
  {
    type: "client",
    name: "resultado_imprimir",
    description: "Aciona impressão/geração de PDF do resultado atual.",
    expects_response: true,
    response_timeout_secs: 8,
    parameters: [],
  },

  // ============ FASE 2 — ATENDIMENTO ============
  {
    type: "client",
    name: "criar_atendimento",
    description:
      "Abre o wizard de novo atendimento. Se o usuário citar um paciente, passe 'paciente_termo' (nome ou CPF) para pré-seleção.",
    expects_response: true,
    response_timeout_secs: 8,
    parameters: [P("paciente_termo", "string", "Opcional: nome parcial ou CPF do paciente", false)],
  },
  {
    type: "client",
    name: "adicionar_exame",
    description: "Adiciona um exame a um atendimento existente, identificado pelo protocolo.",
    expects_response: true,
    response_timeout_secs: 10,
    parameters: [
      P("protocolo", "string", "Protocolo do atendimento (ex.: 0000003)"),
      P("exame", "string", "Nome ou fragmento do nome do exame (ex.: hemograma, glicose)"),
    ],
  },
  {
    type: "client",
    name: "cancelar_atendimento",
    description:
      "Cancela um atendimento. Ação irreversível — só chame com confirmado=true após o usuário confirmar verbalmente.",
    expects_response: true,
    response_timeout_secs: 10,
    parameters: [
      P("protocolo", "string", "Protocolo do atendimento"),
      P("motivo", "string", "Motivo do cancelamento", false),
      P("confirmado", "boolean", "Passe true SOMENTE se o usuário confirmou explicitamente"),
    ],
  },
  {
    type: "client",
    name: "registrar_pagamento",
    description:
      "Registra um pagamento adicional em um atendimento. Acumula no histórico de pagamentos.",
    expects_response: true,
    response_timeout_secs: 10,
    parameters: [
      P("protocolo", "string", "Protocolo do atendimento"),
      P("valor", "number", "Valor pago em reais (use ponto como decimal)"),
      P("forma", "string", "Forma de pagamento: DINHEIRO, PIX, DEBITO, CREDITO", false),
    ],
  },
  {
    type: "client",
    name: "atendimento_resumo",
    description:
      "Lê em voz alta o resumo de um atendimento: protocolo, status atual e lista de exames. Use quando o usuário pedir 'me fale sobre', 'resumo', 'status' ou 'quais exames' de um protocolo.",
    expects_response: true,
    response_timeout_secs: 8,
    parameters: [P("protocolo", "string", "Protocolo do atendimento (ex.: 0000003)")],
  },
  {
    type: "client",
    name: "listar_atendimentos_por_protocolo",
    description:
      "Lista atendimentos com protocolo e status, podendo filtrar por período ('hoje', 'ontem', 'semana', 'semana_passada', 'mes', 'mes_passado', '7dias', '30dias') ou por intervalo data_inicio/data_fim (ISO). Use para 'mostre meus atendimentos de hoje', 'da semana passada' etc.",
    expects_response: true,
    response_timeout_secs: 10,
    parameters: [
      P("limite", "number", "Quantos atendimentos retornar (1 a 50). Padrão 10.", false),
      P("status", "string", "Filtro opcional por status (ex.: Aguardando, Liberado)", false),
      P("periodo", "string", "hoje | ontem | semana | semana_passada | mes | mes_passado | 7dias | 30dias", false),
      P("data_inicio", "string", "Data ISO opcional (YYYY-MM-DD) — sobrepõe 'periodo'", false),
      P("data_fim", "string", "Data ISO opcional (YYYY-MM-DD) — sobrepõe 'periodo'", false),
    ],
  },
  {
    type: "client",
    name: "detalhes_atendimento_por_protocolo",
    description:
      "Lê em voz alta os detalhes completos de um atendimento: protocolo, paciente, status e cada exame com seu status e valores principais. Use para 'mostre os exames do meu atendimento'.",
    expects_response: true,
    response_timeout_secs: 10,
    parameters: [P("protocolo", "string", "Protocolo do atendimento (ex.: 0000003)")],
  },
  {
    type: "client",
    name: "imprimir_atendimento",
    description:
      "Abre a tela de impressão do laudo do atendimento em nova aba (auto-print). O usuário pode escolher 'Salvar como PDF' no diálogo para baixar.",
    expects_response: true,
    response_timeout_secs: 8,
    parameters: [P("protocolo", "string", "Protocolo do atendimento")],
  },
  {
    type: "client",
    name: "liberar_resultado_atendimento",
    description:
      "Libera o resultado de um atendimento pelo protocolo. Ação irreversível — só chame com confirmado=true após o usuário confirmar verbalmente.",
    expects_response: true,
    response_timeout_secs: 15,
    parameters: [
      P("protocolo", "string", "Protocolo do atendimento"),
      P("confirmado", "boolean", "Passe true SOMENTE se o usuário confirmou explicitamente"),
    ],
  },
  {
    type: "client",
    name: "registrar_observacao_atendimento",
    description:
      "Registra uma observação falada no atendimento. Anexa ao histórico de observações com timestamp. Use para 'anote no protocolo X que ...'.",
    expects_response: true,
    response_timeout_secs: 10,
    parameters: [
      P("protocolo", "string", "Protocolo do atendimento"),
      P("observacao", "string", "Texto da observação a registrar"),
    ],
  },
  {
    type: "client",
    name: "pacientes_com_dividas",
    description:
      "Lista pacientes com pagamento pendente ou parcial. Use 'modo' para escolher: 'pendente', 'parcial' ou 'todos' (qualquer não-pago).",
    expects_response: true,
    response_timeout_secs: 10,
    parameters: [
      P("modo", "string", "pendente | parcial | todos. Padrão: todos.", false),
      P("convenio", "string", "Filtro opcional por nome de convênio", false),
      P("limite", "number", "Máximo de linhas (1 a 50). Padrão 10.", false),
    ],
  },
  {
    type: "client",
    name: "gerar_pdf_devedores_por_convenio",
    description:
      "Gera relatório de devedores agrupado por convênio e abre o diálogo de impressão para o usuário salvar como PDF. Filtro opcional por nome de convênio.",
    expects_response: true,
    response_timeout_secs: 15,
    parameters: [P("apenas_convenio", "string", "Opcional: limita a um único convênio", false)],
  },
];




async function patchAgent() {
  const url = `https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`;
  const body = {
    conversation_config: {
      agent: {
        prompt: {
          tools: TOOLS,
        },
      },
    },
  };
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, body: text };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!ELEVENLABS_API_KEY) {
    return new Response(JSON.stringify({ error: "ELEVENLABS_API_KEY ausente" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  try {
    const result = await patchAgent();
    return new Response(JSON.stringify({ tools_count: TOOLS.length, ...result }), {
      status: result.ok ? 200 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
