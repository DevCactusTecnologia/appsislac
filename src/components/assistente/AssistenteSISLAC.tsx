import { useCallback, useEffect, useRef, useState } from "react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, Loader2, MessageCircle, Send, Sparkles, Square, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { fetchAtendimentoByProtocolo, updateAtendimento } from "@/data/atendimentoStore";
import { printHtmlInHiddenFrame } from "@/lib/printHtml";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Resolve intervalo [ini, fim) a partir de uma palavra ou par de datas ISO. */
function resolvePeriodo(periodo?: string, data_inicio?: string, data_fim?: string): { ini?: Date; fim?: Date; label: string } {
  if (data_inicio || data_fim) {
    const ini = data_inicio ? new Date(data_inicio) : undefined;
    const fim = data_fim ? new Date(data_fim) : undefined;
    return { ini, fim, label: `${data_inicio ?? "início"} a ${data_fim ?? "hoje"}` };
  }
  const now = new Date();
  const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
  const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  switch ((periodo ?? "").toLowerCase()) {
    case "hoje": return { ini: startOfDay(now), label: "hoje" };
    case "ontem": { const i = startOfDay(addDays(now, -1)); return { ini: i, fim: startOfDay(now), label: "ontem" }; }
    case "semana": { const i = startOfDay(now); i.setDate(i.getDate() - i.getDay()); return { ini: i, label: "esta semana" }; }
    case "semana_passada": { const fim = startOfDay(now); fim.setDate(fim.getDate() - fim.getDay()); const ini = addDays(fim, -7); return { ini, fim, label: "semana passada" }; }
    case "mes": return { ini: new Date(now.getFullYear(), now.getMonth(), 1), label: "este mês" };
    case "mes_passado": { const ini = new Date(now.getFullYear(), now.getMonth() - 1, 1); const fim = new Date(now.getFullYear(), now.getMonth(), 1); return { ini, fim, label: "mês passado" }; }
    case "7dias": return { ini: addDays(now, -7), label: "últimos 7 dias" };
    case "30dias": return { ini: addDays(now, -30), label: "últimos 30 dias" };
    default: return { label: "no total" };
  }
}

const AGENT_ID = "agent_2801kw31qjftetpbefenctpfnm8n";

type AssistantMode = "voice" | "text";

type ChatMessage = {
  role: "user" | "agent";
  message: string;
};

type ElevenLabsCredentials = {
  token?: string;
  signedUrl?: string;
};

type MicrophoneCheck = {
  ok: boolean;
  reason?: "unsupported" | "not-found" | "permission-denied" | "busy" | "unavailable";
  error?: unknown;
};

const TOOL_LABELS: Record<string, string> = {
  navegar_para: "Navegando",
  abrir_atendimento: "Abrindo atendimento",
  abrir_resultado: "Abrindo resultado",
  contar_atendimentos: "Contando atendimentos",
  buscar_paciente: "Buscando paciente",
  resultado_set_valor: "Preenchendo resultado",
  resultado_set_varios: "Preenchendo resultados",
  resultado_salvar: "Salvando resultado",
  resultado_liberar: "Liberando resultado",
  resultado_imprimir: "Preparando impressão",
  criar_atendimento: "Criando atendimento",
  adicionar_exame: "Adicionando exame",
  cancelar_atendimento: "Cancelando atendimento",
  registrar_pagamento: "Registrando pagamento",
  atendimento_resumo: "Consultando atendimento",
  listar_atendimentos_por_protocolo: "Listando atendimentos",
  detalhes_atendimento_por_protocolo: "Consultando detalhes",
  imprimir_atendimento: "Abrindo impressão",
  liberar_resultado_atendimento: "Liberando resultado",
  registrar_observacao_atendimento: "Registrando observação",
  pacientes_com_dividas: "Consultando pendências",
  gerar_pdf_devedores_por_convenio: "Gerando relatório",
};

function normalizeErrorMessage(error: unknown): string {
  if (!error) return "Erro desconhecido";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && "message" in error) return String((error as { message?: unknown }).message);
  return String(error);
}

function getMicrophoneErrorMessage(check: MicrophoneCheck): string {
  switch (check.reason) {
    case "not-found":
      return "Microfone não encontrado. Abri o modo texto do Assistente SISLAC.";
    case "permission-denied":
      return "Permissão do microfone bloqueada. Abri o modo texto do Assistente SISLAC.";
    case "busy":
      return "Microfone em uso por outro aplicativo. Abri o modo texto do Assistente SISLAC.";
    case "unsupported":
      return "Este navegador não permite áudio aqui. Abri o modo texto do Assistente SISLAC.";
    default:
      return "Não foi possível usar o microfone. Abri o modo texto do Assistente SISLAC.";
  }
}

function isMicrophoneStartupError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("microphone")
    || normalized.includes("microfone")
    || normalized.includes("notfounderror")
    || normalized.includes("requested device not found")
    || normalized.includes("permission denied")
    || normalized.includes("notallowederror")
    || normalized.includes("device not found");
}

function isRealtimeSignalStartupError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("could not establish signal connection")
    || normalized.includes("abort handler called")
    || normalized.includes("signal connection")
    || normalized.includes("livekit")
    || normalized.includes("serverunreachable");
}

async function checkMicrophone(): Promise<MicrophoneCheck> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return { ok: false, reason: "unsupported" };
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices?.();
    if (devices?.length && !devices.some((device) => device.kind === "audioinput")) {
      return { ok: false, reason: "not-found" };
    }
  } catch (error) {
    console.warn("[AssistenteSISLAC] enumerateDevices", error);
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return { ok: true };
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return { ok: false, reason: "not-found", error };
    }
    if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
      return { ok: false, reason: "permission-denied", error };
    }
    if (name === "NotReadableError" || name === "TrackStartError") {
      return { ok: false, reason: "busy", error };
    }
    return { ok: false, reason: "unavailable", error };
  }
}

function getToolName(event: unknown): string {
  if (!event || typeof event !== "object") return "ferramenta";
  const value = event as Record<string, unknown>;
  return String(value.tool_name ?? value.name ?? value.toolName ?? "ferramenta");
}

function withToolFeedback<T extends Record<string, (parameters: any) => any>>(tools: T): T {
  return Object.fromEntries(
    Object.entries(tools).map(([name, handler]) => [
      name,
      async (parameters: any) => {
        const label = TOOL_LABELS[name] ?? `Executando ${name}`;
        const id = toast.loading(`${label}...`);
        console.info("[AssistenteSISLAC] tool:start", name, parameters);
        try {
          const result = await handler(parameters);
          toast.success("Concluído", { id, description: label });
          console.info("[AssistenteSISLAC] tool:success", name, result);
          return result;
        } catch (error) {
          const message = normalizeErrorMessage(error);
          toast.error("Falha ao executar", { id, description: `${label}: ${message}` });
          console.error("[AssistenteSISLAC] tool:error", name, error);
          throw error;
        }
      },
    ]),
  ) as T;
}


/**
 * Mapa de rotas amigáveis -> caminho real.
 * Mantenha curto e estável; o agente recebe estas chaves no system prompt.
 */
const ROUTE_MAP: Record<string, string> = {
  dashboard: "/dashboard",
  atendimentos: "/atendimentos",
  novo_atendimento: "/atendimentos/novo",
  coleta: "/registrar-coleta",
  analise: "/analisar-amostra",
  resultados: "/resultados",
  pacientes: "/pacientes",
  orcamentos: "/orcamentos",
  lab_apoio: "/lab-apoio",
  auditoria: "/auditoria",
  especialistas: "/especialistas",
  producao: "/relatorios/producao",
  impressao: "/relatorios/impressao",
};

const ASSISTANT_RUNTIME_INSTRUCTIONS = [
  "Você é o Assistente SISLAC. Estilo: direto, objetivo, executor.",
  "Execute comandos imediatamente usando ferramentas. Não peça confirmação para navegação, abrir telas, listar ou consultar dados.",
  "Pergunte apenas se faltar dado obrigatório, como protocolo ou nome do paciente.",
  "Após executar, responda em até 6 palavras: Pronto, Aberto ou Feito.",
  "Destinos: dashboard, atendimentos, novo_atendimento, coleta, analise, resultados, pacientes, orcamentos, lab_apoio, auditoria, especialistas, producao, impressao.",
].join(" ");

/** Descreve a tela atual em uma linha curta para o agente. */
function describeRoute(pathname: string): string {
  if (pathname.startsWith("/atendimentos/novo")) return "Tela: novo atendimento (cadastro)";
  if (pathname.startsWith("/atendimentos")) return "Tela: lista de atendimentos";
  if (pathname.startsWith("/resultado/")) return `Tela: detalhe do resultado (${pathname})`;
  if (pathname.startsWith("/resultados")) return "Tela: lista de resultados";
  if (pathname.startsWith("/registrar-coleta")) return "Tela: registrar coleta";
  if (pathname.startsWith("/analisar-amostra")) return "Tela: análise de amostras";
  if (pathname.startsWith("/pacientes")) return "Tela: pacientes";
  if (pathname.startsWith("/orcamentos")) return "Tela: orçamentos";
  if (pathname.startsWith("/dashboard")) return "Tela: dashboard";
  return `Tela: ${pathname}`;
}

function buildAssistantContext(pathname: string): string {
  return `${ASSISTANT_RUNTIME_INSTRUCTIONS} ${describeRoute(pathname)}`;
}

function getDisconnectDescription(details: unknown): string {
  if (!details || typeof details !== "object") return "";
  const value = details as Record<string, unknown>;
  const context = value.context && typeof value.context === "object" ? value.context as Record<string, unknown> : undefined;
  return String(value.message ?? value.closeReason ?? context?.reason ?? value.reason ?? "");
}

function getDisconnectReason(details: unknown): string {
  if (!details || typeof details !== "object") return "";
  return String((details as Record<string, unknown>).reason ?? "");
}

function AssistenteSISLACInner() {
  const [connecting, setConnecting] = useState(false);
  const [mode, setMode] = useState<AssistantMode>("voice");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const lastStartAttemptRef = useRef(0);
  const pendingTextMessageRef = useRef<string | null>(null);
  const intentionalStopRef = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const conversation = useConversation({
    clientTools: withToolFeedback({
      /** Navega para uma área do sistema. */
      navegar_para: ({ destino }: { destino: string }) => {
        const path = ROUTE_MAP[destino?.toLowerCase?.()] ?? destino;
        if (!path?.startsWith("/")) return `Destino desconhecido: ${destino}`;
        navigateRef.current(path);
        return `Navegado para ${path}`;
      },

      /** Abre o detalhe de um atendimento pelo número de protocolo. */
      abrir_atendimento: async ({ protocolo }: { protocolo: string }) => {
        if (!protocolo) return "Protocolo é obrigatório";
        const { data, error } = await supabase
          .from("atendimentos")
          .select("id, protocolo")
          .ilike("protocolo", `%${protocolo}%`)
          .limit(1)
          .maybeSingle();
        if (error || !data) return `Atendimento ${protocolo} não encontrado`;
        navigateRef.current(`/atendimentos/${data.protocolo}/editar`);
        return `Aberto atendimento ${data.protocolo}`;
      },

      /** Abre o resultado de um atendimento pelo protocolo. */
      abrir_resultado: async ({ protocolo }: { protocolo: string }) => {
        if (!protocolo) return "Protocolo é obrigatório";
        const { data, error } = await supabase
          .from("atendimentos")
          .select("id, protocolo")
          .ilike("protocolo", `%${protocolo}%`)
          .limit(1)
          .maybeSingle();
        if (error || !data) return `Resultado ${protocolo} não encontrado`;
        navigateRef.current(`/resultado/${data.id}`);
        return `Aberto resultado ${data.protocolo}`;
      },

      /** Conta atendimentos do tenant atual (RLS garante o escopo). */
      contar_atendimentos: async ({ periodo }: { periodo?: "hoje" | "semana" | "mes" } = {}) => {
        let q = supabase.from("atendimentos").select("id", { count: "exact", head: true });
        const now = new Date();
        if (periodo === "hoje") {
          const ini = new Date(now); ini.setHours(0, 0, 0, 0);
          q = q.gte("data_atendimento", ini.toISOString());
        } else if (periodo === "semana") {
          const ini = new Date(now); ini.setDate(now.getDate() - 7);
          q = q.gte("data_atendimento", ini.toISOString());
        } else if (periodo === "mes") {
          const ini = new Date(now.getFullYear(), now.getMonth(), 1);
          q = q.gte("data_atendimento", ini.toISOString());
        }
        const { count, error } = await q;
        if (error) return `Erro: ${error.message}`;
        return `${count ?? 0} atendimento(s) ${periodo ?? "no total"}`;
      },

      /** Busca paciente por nome ou CPF. */
      buscar_paciente: async ({ termo }: { termo: string }) => {
        if (!termo) return "Informe nome ou CPF";
        const { data, error } = await supabase
          .from("pacientes")
          .select("id, nome, cpf")
          .or(`nome.ilike.%${termo}%,cpf.ilike.%${termo}%`)
          .limit(5);
        if (error) return `Erro: ${error.message}`;
        if (!data?.length) return `Nenhum paciente para "${termo}"`;
        return data.map((p) => `${p.nome} (${p.cpf ?? "sem CPF"})`).join("; ");
      },

      // ============ FASE 1 — RESULTADO (bridge window.__sislacResultado) ============
      resultado_set_valor: ({ parametro, valor }: { parametro: string; valor: string }) => {
        const api = (window as any).__sislacResultado;
        if (!api) return "Abra um resultado primeiro";
        const r = api.setValor(parametro, valor);
        return r.msg;
      },
      resultado_set_varios: ({ pares }: { pares: string }) => {
        const api = (window as any).__sislacResultado;
        if (!api) return "Abra um resultado primeiro";
        const r = api.setVarios(pares);
        return r.msg;
      },
      resultado_salvar: () => {
        const api = (window as any).__sislacResultado;
        if (!api) return "Abra um resultado primeiro";
        return api.salvar().msg;
      },
      resultado_liberar: ({ confirmado }: { confirmado?: boolean } = {}) => {
        const api = (window as any).__sislacResultado;
        if (!api) return "Abra um resultado primeiro";
        if (!confirmado) return "Confirmação necessária — peça 'sim, liberar' ao usuário";
        return api.liberar().msg;
      },
      resultado_imprimir: () => {
        const api = (window as any).__sislacResultado;
        if (!api) return "Abra um resultado primeiro";
        return api.imprimir().msg;
      },

      // ============ FASE 2 — ATENDIMENTO ============
      /** Abre o wizard de novo atendimento; opcionalmente pré-seleciona paciente por nome/CPF. */
      criar_atendimento: async ({ paciente_termo }: { paciente_termo?: string } = {}) => {
        let qs = "";
        if (paciente_termo) {
          const { data } = await supabase
            .from("pacientes")
            .select("id, nome")
            .or(`nome.ilike.%${paciente_termo}%,cpf.ilike.%${paciente_termo}%`)
            .limit(1)
            .maybeSingle();
          if (data?.id) qs = `?paciente=${data.id}`;
        }
        navigateRef.current(`/atendimentos/novo${qs}`);
        return paciente_termo ? `Novo atendimento para ${paciente_termo}` : "Novo atendimento aberto";
      },

      /** Adiciona um exame a um atendimento existente (busca exato/parcial no catálogo). */
      adicionar_exame: async ({ protocolo, exame }: { protocolo: string; exame: string }) => {
        if (!protocolo || !exame) return "Informe protocolo e exame";
        const at = await fetchAtendimentoByProtocolo(protocolo);
        if (!at) return `Atendimento ${protocolo} não encontrado`;
        if (at.statusAtendimento?.label === "Cancelado") return "Atendimento cancelado";
        const { data: cat } = await supabase
          .from("exames_catalogo")
          .select("nome")
          .ilike("nome", `%${exame}%`)
          .limit(1)
          .maybeSingle();
        const nome = cat?.nome ?? exame.toUpperCase();
        if (at.exames?.includes(nome)) return `${nome} já está no atendimento`;
        await updateAtendimento(protocolo, { exames: [...(at.exames ?? []), nome] });
        return `Exame ${nome} adicionado`;
      },

      /** Cancela atendimento — exige confirmação verbal explícita. */
      cancelar_atendimento: async ({
        protocolo, motivo, confirmado,
      }: { protocolo: string; motivo?: string; confirmado?: boolean }) => {
        if (!protocolo) return "Informe o protocolo";
        if (!confirmado) return "Confirmação necessária — peça 'sim, cancelar' ao usuário";
        const at = await fetchAtendimentoByProtocolo(protocolo);
        if (!at) return `Atendimento ${protocolo} não encontrado`;
        if (at.statusAtendimento?.label === "Cancelado") return "Já estava cancelado";
        await updateAtendimento(protocolo, {
          statusAtendimento: { label: "Cancelado", type: "danger" },
          motivoCancelamento: motivo || "Cancelado via Assistente SISLAC",
        });
        return `Atendimento ${protocolo} cancelado`;
      },

      /** Registra pagamento adicional (acumula em pagamentosRealizados). */
      registrar_pagamento: async ({
        protocolo, valor, forma,
      }: { protocolo: string; valor: number | string; forma?: string }) => {
        if (!protocolo) return "Informe o protocolo";
        const v = typeof valor === "string" ? parseFloat(String(valor).replace(",", ".")) : Number(valor);
        if (!Number.isFinite(v) || v <= 0) return "Valor inválido";
        const at = await fetchAtendimentoByProtocolo(protocolo);
        if (!at) return `Atendimento ${protocolo} não encontrado`;
        if (at.statusAtendimento?.label === "Cancelado") return "Atendimento cancelado";
        const novo = { tipo: (forma || "DINHEIRO").toUpperCase(), valor: v, data: new Date().toISOString() };
        const pagamentos = [...(at.pagamentosRealizados ?? []), novo];
        await updateAtendimento(protocolo, { pagamentosRealizados: pagamentos });
        return `Pagamento de R$ ${v.toFixed(2)} (${novo.tipo}) registrado`;
      },

      /** Resumo falável: protocolo, status e lista de exames. */
      atendimento_resumo: async ({ protocolo }: { protocolo: string }) => {
        if (!protocolo) return "Informe o protocolo";
        const at = await fetchAtendimentoByProtocolo(protocolo);
        if (!at) return `Atendimento ${protocolo} não encontrado`;
        const status = at.statusAtendimento?.label ?? "sem status";
        const exames = at.exames?.length ? at.exames.join(", ") : "nenhum exame";
        const paciente = (at as any).pacienteNome ?? (at as any).paciente?.nome ?? "";
        return `Protocolo ${at.protocolo}${paciente ? ` — ${paciente}` : ""}. Status: ${status}. Exames: ${exames}.`;
      },

      /** Lista atendimentos por período, com filtro opcional por status. */
      listar_atendimentos_por_protocolo: async ({
        limite, status, periodo, data_inicio, data_fim,
      }: { limite?: number; status?: string; periodo?: string; data_inicio?: string; data_fim?: string } = {}) => {
        const n = Math.max(1, Math.min(50, Number(limite) || 10));
        const { ini, fim, label } = resolvePeriodo(periodo, data_inicio, data_fim);
        let q = supabase
          .from("atendimentos")
          .select("protocolo, status_atendimento, data, paciente_nome")
          .order("data", { ascending: false })
          .limit(n);
        if (ini) q = q.gte("data", ini.toISOString());
        if (fim) q = q.lt("data", fim.toISOString());
        if (status) q = q.ilike("status_atendimento", `%${status}%`);
        const { data, error } = await q;
        if (error) return `Erro: ${error.message}`;
        if (!data?.length) return `Nenhum atendimento ${label}`;
        const head = `${data.length} atendimento(s) ${label}: `;
        return head + data
          .map((r: any) => `${r.protocolo} — ${r.paciente_nome ?? ""} (${r.status_atendimento ?? "sem status"})`)
          .join("; ");
      },

      /** Detalhes falável: protocolo, status e exames com valores. */
      detalhes_atendimento_por_protocolo: async ({ protocolo }: { protocolo: string }) => {
        if (!protocolo) return "Informe o protocolo";
        const { data: at, error: e1 } = await supabase
          .from("atendimentos")
          .select("id, protocolo, status_atendimento, paciente_nome")
          .ilike("protocolo", `%${protocolo}%`)
          .limit(1)
          .maybeSingle();
        if (e1 || !at) return `Atendimento ${protocolo} não encontrado`;
        const { data: exs } = await supabase
          .from("atendimento_exames")
          .select("nome_exame, status, resultados")
          .eq("atendimento_id", at.id)
          .order("ordem", { ascending: true });
        const linhas = (exs ?? []).map((e: any) => {
          let valor = "sem resultado";
          const r = e.resultados;
          if (r && typeof r === "object") {
            const pares = Object.entries(r).slice(0, 4)
              .map(([k, v]: any) => `${k}=${typeof v === "object" ? v?.valor ?? "" : v}`)
              .join(", ");
            if (pares) valor = pares;
          }
          return `${e.nome_exame} [${e.status}]: ${valor}`;
        });
        return `Protocolo ${at.protocolo} — ${at.paciente_nome}. Status: ${at.status_atendimento}. Exames: ${linhas.join(" | ") || "nenhum"}`;
      },

      /** Abre impressão do laudo (auto-print → o usuário pode salvar como PDF). */
      imprimir_atendimento: async ({ protocolo }: { protocolo: string }) => {
        if (!protocolo) return "Informe o protocolo";
        const { data, error } = await supabase
          .from("atendimentos")
          .select("id, protocolo")
          .ilike("protocolo", `%${protocolo}%`)
          .limit(1)
          .maybeSingle();
        if (error || !data) return `Atendimento ${protocolo} não encontrado`;
        window.open(`/resultado/${data.id}/print`, "_blank", "noopener");
        return `Impressão de ${data.protocolo} aberta — use 'Salvar como PDF' no diálogo`;
      },

      /** Libera o resultado de um atendimento pelo protocolo (exige confirmação). */
      liberar_resultado_atendimento: async ({
        protocolo, confirmado,
      }: { protocolo: string; confirmado?: boolean }) => {
        if (!protocolo) return "Informe o protocolo";
        if (!confirmado) return "Confirmação necessária — peça 'sim, liberar' ao usuário";
        const { data, error } = await supabase
          .from("atendimentos")
          .select("id, protocolo")
          .ilike("protocolo", `%${protocolo}%`)
          .limit(1)
          .maybeSingle();
        if (error || !data) return `Atendimento ${protocolo} não encontrado`;
        navigateRef.current(`/resultado/${data.id}`);
        const ok = await new Promise<boolean>((resolve) => {
          const t0 = Date.now();
          const iv = setInterval(() => {
            if ((window as any).__sislacResultado) { clearInterval(iv); resolve(true); }
            else if (Date.now() - t0 > 5000) { clearInterval(iv); resolve(false); }
          }, 150);
        });
        if (!ok) return "Tela de resultado não carregou a tempo";
        const r = (window as any).__sislacResultado.liberar();
        return r?.msg ?? `Resultado ${data.protocolo} liberado`;
      },

      /** Registra observação falada no atendimento (append com timestamp). */
      registrar_observacao_atendimento: async ({
        protocolo, observacao,
      }: { protocolo: string; observacao: string }) => {
        if (!protocolo) return "Informe o protocolo";
        if (!observacao?.trim()) return "Diga o conteúdo da observação";
        const { data: at, error } = await supabase
          .from("atendimentos")
          .select("id, protocolo, observacoes_assistente")
          .ilike("protocolo", `%${protocolo}%`)
          .limit(1)
          .maybeSingle();
        if (error || !at) return `Atendimento ${protocolo} não encontrado`;
        const ts = new Date().toLocaleString("pt-BR");
        const novo = `${at.observacoes_assistente ? at.observacoes_assistente + "\n" : ""}[${ts}] ${observacao.trim()}`;
        const { error: e2 } = await supabase
          .from("atendimentos")
          .update({ observacoes_assistente: novo })
          .eq("id", at.id);
        if (e2) return `Erro ao salvar: ${e2.message}`;
        return `Observação registrada em ${at.protocolo}`;
      },

      /** Lista pacientes com dívidas (pagamento pendente/parcial), opcional por convênio. */
      pacientes_com_dividas: async ({
        modo, convenio, limite,
      }: { modo?: "pendente" | "parcial" | "todos"; convenio?: string; limite?: number } = {}) => {
        const n = Math.max(1, Math.min(50, Number(limite) || 10));
        let q = supabase
          .from("atendimentos")
          .select("protocolo, paciente_nome, convenio_nome, status_pagamento, total")
          .order("data", { ascending: false })
          .limit(n);
        if (modo === "parcial") q = q.ilike("status_pagamento", "%parcial%");
        else if (modo === "pendente") q = q.ilike("status_pagamento", "%pendente%");
        else q = q.not("status_pagamento", "ilike", "%pago%");
        if (convenio) q = q.ilike("convenio_nome", `%${convenio}%`);
        const { data, error } = await q;
        if (error) return `Erro: ${error.message}`;
        if (!data?.length) return "Nenhum paciente com pendência";
        return `${data.length} pendência(s): ` + data
          .map((r: any) => `${r.paciente_nome} (${r.convenio_nome}) — R$ ${Number(r.total ?? 0).toFixed(2)} [${r.status_pagamento}]`)
          .join("; ");
      },

      /** Gera relatório (PDF via diálogo de impressão) de devedores agrupados por convênio. */
      gerar_pdf_devedores_por_convenio: async ({ apenas_convenio }: { apenas_convenio?: string } = {}) => {
        let q = supabase
          .from("atendimentos")
          .select("protocolo, paciente_nome, paciente_cpf, convenio_nome, status_pagamento, total, data")
          .not("status_pagamento", "ilike", "%pago%")
          .order("convenio_nome", { ascending: true })
          .order("data", { ascending: false })
          .limit(1000);
        if (apenas_convenio) q = q.ilike("convenio_nome", `%${apenas_convenio}%`);
        const { data, error } = await q;
        if (error) return `Erro: ${error.message}`;
        if (!data?.length) return "Nenhum devedor encontrado";

        const grupos = new Map<string, any[]>();
        for (const r of data as any[]) {
          const k = r.convenio_nome ?? "Sem convênio";
          if (!grupos.has(k)) grupos.set(k, []);
          grupos.get(k)!.push(r);
        }
        const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        const hoje = new Date().toLocaleString("pt-BR");
        let totalGeral = 0;
        let html = `<!doctype html><html><head><meta charset="utf-8"><title>Devedores por convênio</title>
<style>body{font-family:Arial,sans-serif;padding:16px;color:#111}h1{font-size:18px;margin:0 0 4px}h2{font-size:14px;margin:18px 0 6px;border-bottom:1px solid #333;padding-bottom:2px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #ccc;padding:4px 6px;text-align:left}th{background:#f1f1f1}tfoot td{font-weight:bold;background:#fafafa}.right{text-align:right}.muted{color:#666;font-size:11px}@media print{@page{size:A4;margin:14mm}}</style>
</head><body><h1>Relatório de Devedores por Convênio</h1><div class="muted">Gerado em ${hoje}</div>`;
        for (const [conv, rows] of grupos) {
          const subtotal = rows.reduce((s, r) => s + Number(r.total ?? 0), 0);
          totalGeral += subtotal;
          html += `<h2>${conv} — ${rows.length} paciente(s) — ${fmt(subtotal)}</h2>
<table><thead><tr><th>Protocolo</th><th>Paciente</th><th>CPF</th><th>Data</th><th>Status</th><th class="right">Valor</th></tr></thead><tbody>`;
          for (const r of rows) {
            const dt = r.data ? new Date(r.data).toLocaleDateString("pt-BR") : "";
            html += `<tr><td>${r.protocolo}</td><td>${r.paciente_nome ?? ""}</td><td>${r.paciente_cpf ?? ""}</td><td>${dt}</td><td>${r.status_pagamento}</td><td class="right">${fmt(Number(r.total ?? 0))}</td></tr>`;
          }
          html += `</tbody><tfoot><tr><td colspan="5" class="right">Subtotal</td><td class="right">${fmt(subtotal)}</td></tr></tfoot></table>`;
        }
        html += `<h2>Total geral: ${fmt(totalGeral)}</h2></body></html>`;
        printHtmlInHiddenFrame({ html, documentTitle: "Devedores por convênio" });
        return `Relatório de ${data.length} devedor(es) gerado — use 'Salvar como PDF'`;
      },
    }),


    onConnect: () => {
      setConnecting(false);
      intentionalStopRef.current = false;
      toast.success(mode === "text" ? "Assistente SISLAC conectado em modo texto" : "Assistente SISLAC conectado");
    },
    onDisconnect: (details?: unknown) => {
      setConnecting(false);
      console.warn("[AssistenteSISLAC] disconnect details", details);
      const reason = getDisconnectReason(details);
      const description = getDisconnectDescription(details);
      if (intentionalStopRef.current || reason === "user") {
        intentionalStopRef.current = false;
        return;
      }
      if (mode === "text" && chatOpen) {
        toast.message("Modo texto em espera", { description: "Digite para reconectar o Assistente SISLAC." });
        return;
      }
      toast.message("Assistente SISLAC desconectado", description ? { description } : undefined);
    },
    onMessage: ({ role, message }) => {
      if (!message?.trim()) return;
      setChatMessages((current) => {
        const last = current[current.length - 1];
        if (last?.role === role && last.message === message) return current;
        return [...current.slice(-30), { role: role === "agent" ? "agent" : "user", message }];
      });
    },
    onStatusChange: ({ status }) => {
      if (status === "connected" || status === "disconnected") setConnecting(false);
    },
    onError: (err, context) => {
      const message = normalizeErrorMessage(err);
      console.error("[AssistenteSISLAC]", err, context);
      setConnecting(false);
      if (mode === "voice" && (isMicrophoneStartupError(message) || isRealtimeSignalStartupError(message))) {
        setTimeout(() => openTextMode("Conexão de voz indisponível. Use o modo texto."), 0);
        return;
      }
      if (mode === "text") {
        toast.error("Não consegui conectar o modo texto", { description: message });
        return;
      }
      toast.error(message.includes("Client tool") ? "Falha ao executar ação do assistente" : "Falha na conexão com o Assistente SISLAC", {
        description: message,
      });
    },
    onAgentToolRequest: (toolCall) => {
      const name = getToolName(toolCall);
      console.info("[AssistenteSISLAC] agent tool request", toolCall);
      toast.loading(`${TOOL_LABELS[name] ?? `Executando ${name}`}...`, { id: `assistant-tool-${name}` });
    },
    onAgentToolResponse: (toolCall) => {
      const name = getToolName(toolCall);
      console.info("[AssistenteSISLAC] agent tool response", toolCall);
      toast.success("Ação processada", { id: `assistant-tool-${name}`, description: TOOL_LABELS[name] ?? name });
    },
  });

  const isConnected = conversation.status === "connected";
  const isSpeaking = conversation.isSpeaking;

  // Envia contexto da tela atual sempre que a rota muda durante a conversa.
  useEffect(() => {
    if (!isConnected) return;
    try {
      conversation.sendContextualUpdate(buildAssistantContext(location.pathname));
      const pending = pendingTextMessageRef.current;
      if (pending) {
        pendingTextMessageRef.current = null;
        conversation.sendUserMessage(pending);
        conversation.sendUserActivity();
      }
    } catch (e) {
      console.warn("[AssistenteSISLAC] contextual update", e);
    }
  }, [isConnected, location.pathname, conversation]);

  // Keep-alive: previne timeout por inatividade especialmente em modo texto.
  useEffect(() => {
    if (!isConnected) return;
    const id = window.setInterval(() => {
      try { conversation.sendUserActivity(); } catch {}
    }, 12_000);
    return () => window.clearInterval(id);
  }, [isConnected, conversation]);

  useEffect(() => {
    if (conversation.status === "error") setConnecting(false);
  }, [conversation.status]);

  const getCredentials = useCallback(async (): Promise<ElevenLabsCredentials> => {
    const { data, error } = await supabase.functions.invoke("elevenlabs-conversation-token");
    if (error) throw error;
    return {
      token: typeof data?.token === "string" ? data.token : undefined,
      signedUrl: typeof data?.signed_url === "string" ? data.signed_url : undefined,
    };
  }, []);

  const sendCurrentContextSoon = useCallback(() => {
    setTimeout(() => {
      try { conversation.sendContextualUpdate(buildAssistantContext(location.pathname)); } catch {}
    }, 600);
  }, [conversation, location.pathname]);

  const openTextMode = useCallback((notice?: string) => {
    setMode("text");
    setChatOpen(true);
    setConnecting(false);
    if (notice) toast.warning(notice);
  }, []);

  const startTextSession = useCallback(async () => {
    if (conversation.status === "connected" || conversation.status === "connecting") return;
    setMode("text");
    setChatOpen(true);
    setConnecting(true);

    try {
      const credentials = await getCredentials();
      if (credentials.signedUrl) {
        conversation.startSession({
          signedUrl: credentials.signedUrl,
          connectionType: "websocket",
          textOnly: true,
        });
      } else {
        conversation.startSession({
          agentId: AGENT_ID,
          connectionType: "websocket",
          textOnly: true,
        });
      }
    } catch (error) {
      console.error("[AssistenteSISLAC] start text", error);
      setConnecting(false);
      toast.error("Não foi possível iniciar o Assistente SISLAC em modo texto", {
        description: normalizeErrorMessage(error),
      });
    }
  }, [conversation, getCredentials]);

  const start = useCallback(async () => {
    if (connecting || isConnected) return;
    const now = Date.now();
    if (now - lastStartAttemptRef.current < 800) return;
    lastStartAttemptRef.current = now;
    setConnecting(true);
    setMode("voice");
    try {
      const mic = await checkMicrophone();
      if (!mic.ok) {
        console.warn("[AssistenteSISLAC] microphone unavailable", mic);
        setConnecting(false);
        openTextMode(getMicrophoneErrorMessage(mic));
        return;
      }

      // Prioriza WebSocket para evitar falhas de sinalização WebRTC/LiveKit em redes restritivas.
      let started = false;
      try {
        const credentials = await getCredentials();
        if (credentials.signedUrl) {
          conversation.startSession({
            signedUrl: credentials.signedUrl,
            connectionType: "websocket",
          });
          started = true;
        } else if (credentials.token) {
          conversation.startSession({
            conversationToken: credentials.token,
            connectionType: "webrtc",
          });
          started = true;
        }
      } catch (e) {
        console.warn("[AssistenteSISLAC] token fn exceção, tentando agente público", e);
      }

      if (!started) {
        conversation.startSession({
          agentId: AGENT_ID,
          connectionType: "webrtc",
        });
      }
      sendCurrentContextSoon();
    } catch (e) {
      console.error("[AssistenteSISLAC] start", e);
      setConnecting(false);
      toast.error("Não foi possível iniciar o Assistente SISLAC. Verifique o microfone.", {
        description: normalizeErrorMessage(e),
      });
    }
  }, [connecting, getCredentials, isConnected, sendCurrentContextSoon, openTextMode, conversation]);

  const stop = useCallback(async () => {
    intentionalStopRef.current = true;
    pendingTextMessageRef.current = null;
    setConnecting(false);
    setChatOpen(false);
    await conversation.endSession();
  }, [conversation]);

  const sendTextMessage = useCallback(() => {
    const text = chatInput.trim();
    if (!text) return;
    setChatMessages((current) => [...current.slice(-30), { role: "user", message: text }]);
    setChatInput("");
    if (conversation.status !== "connected") {
      pendingTextMessageRef.current = text;
      void startTextSession();
      return;
    }
    try {
      conversation.sendUserMessage(text);
      conversation.sendUserActivity();
    } catch (error) {
      toast.error("Não consegui enviar a mensagem", { description: normalizeErrorMessage(error) });
    }
  }, [chatInput, conversation, startTextSession]);

  const onClick = isConnected ? stop : start;
  const label = isConnected ? "Encerrar Assistente SISLAC" : "Falar com o Assistente SISLAC";

  return (
    <>
      {chatOpen && mode === "text" && (
        <div className="fixed bottom-16 right-4 z-40 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-border/70 bg-background/95 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
              </span>
              <div>
                <p className="text-sm font-semibold leading-none">Assistente SISLAC</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {isConnected ? "Modo texto ativo" : connecting ? "Conectando..." : "Modo texto pronto"}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                setChatOpen(false);
                if (isConnected || connecting) void stop();
              }}
              aria-label="Fechar Assistente SISLAC"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="max-h-[360px] min-h-[220px] space-y-3 overflow-y-auto px-4 py-3">
            {!chatMessages.length && (
              <div className="rounded-xl border border-amber-200/70 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>Seu microfone não está disponível. Você pode digitar comandos aqui e o assistente continuará executando ações no sistema.</p>
                </div>
              </div>
            )}
            {chatMessages.map((item, index) => (
              <div key={`${item.role}-${index}-${item.message.slice(0, 12)}`} className={cn("flex", item.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[82%] rounded-2xl px-3 py-2 text-sm",
                  item.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                )}>
                  {item.message}
                </div>
              </div>
            ))}
          </div>

          <form
            className="flex gap-2 border-t border-border/70 p-3"
            onSubmit={(event) => {
              event.preventDefault();
              sendTextMessage();
            }}
          >
            <Input
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              placeholder={connecting ? "Conectando..." : "Digite um comando..."}
              disabled={connecting}
              className="h-10"
            />
            <Button type="submit" size="icon" disabled={connecting || !chatInput.trim()} aria-label="Enviar mensagem">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        title={label}
        className={cn(
          "fixed bottom-4 right-4 z-40 h-10 w-10 rounded-full",
          "flex items-center justify-center border border-border/60",
          "bg-muted/60 text-muted-foreground backdrop-blur-sm shadow-sm",
          "hover:bg-muted hover:text-foreground transition-all",
          isConnected && "bg-primary/10 text-primary border-primary/30 hover:bg-primary/15",
          isSpeaking && mode === "voice" && "ring-2 ring-primary/40 ring-offset-2 ring-offset-background animate-pulse",
        )}
      >
        {connecting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isConnected ? (
          mode === "text" ? <MessageCircle className="h-4 w-4" /> : <Square className="h-3.5 w-3.5 fill-current" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
      </button>
    </>
  );
}

export function AssistenteSISLAC() {
  return (
    <ConversationProvider>
      <AssistenteSISLACInner />
    </ConversationProvider>
  );
}

export default AssistenteSISLAC;
