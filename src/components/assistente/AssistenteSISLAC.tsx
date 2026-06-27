import { useCallback, useEffect, useRef, useState } from "react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { useLocation, useNavigate } from "react-router-dom";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { fetchAtendimentoByProtocolo, updateAtendimento } from "@/data/atendimentoStore";

const AGENT_ID = "agent_2801kw31qjftetpbefenctpfnm8n";


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

function AssistenteSISLACInner() {
  const [connecting, setConnecting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const conversation = useConversation({
    clientTools: {
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

      /** Lista os últimos atendimentos com protocolo e status (falável). */
      listar_atendimentos_por_protocolo: async ({
        limite, status,
      }: { limite?: number; status?: string } = {}) => {
        const n = Math.max(1, Math.min(20, Number(limite) || 5));
        let q = supabase
          .from("atendimentos")
          .select("protocolo, status_atendimento, data_atendimento")
          .order("data_atendimento", { ascending: false })
          .limit(n);
        if (status) q = q.ilike("status_atendimento", `%${status}%`);
        const { data, error } = await q;
        if (error) return `Erro: ${error.message}`;
        if (!data?.length) return "Nenhum atendimento encontrado";
        return data
          .map((r: any) => `Protocolo ${r.protocolo}: ${r.status_atendimento ?? "sem status"}`)
          .join("; ");
      },

      /** Abre a tela de impressão do laudo pelo protocolo. */
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
        return `Impressão de ${data.protocolo} aberta`;
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
        // Aguarda a tela montar e a bridge ficar disponível.
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
    },


    onConnect: () => toast.success("Assistente SISLAC conectado"),
    onDisconnect: () => toast.message("Assistente SISLAC desconectado"),
    onError: (err) => {
      console.error("[AssistenteSISLAC]", err);
      toast.error("Falha na conexão com o Assistente SISLAC");
    },
  });

  const isConnected = conversation.status === "connected";
  const isSpeaking = conversation.isSpeaking;

  // Envia contexto da tela atual sempre que a rota muda durante a conversa.
  useEffect(() => {
    if (!isConnected) return;
    try {
      conversation.sendContextualUpdate(describeRoute(location.pathname));
    } catch (e) {
      console.warn("[AssistenteSISLAC] contextual update", e);
    }
  }, [isConnected, location.pathname, conversation]);

  const start = useCallback(async () => {
    if (connecting || isConnected) return;
    setConnecting(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      await conversation.startSession({
        agentId: AGENT_ID,
        connectionType: "webrtc",
      });
      // Contexto inicial logo após conectar.
      setTimeout(() => {
        try { conversation.sendContextualUpdate(describeRoute(location.pathname)); } catch {}
      }, 300);
    } catch (e) {
      console.error("[AssistenteSISLAC] start", e);
      toast.error("Permita o microfone para falar com o Assistente SISLAC");
    } finally {
      setConnecting(false);
    }
  }, [conversation, connecting, isConnected, location.pathname]);

  const stop = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  const onClick = isConnected ? stop : start;
  const label = isConnected ? "Encerrar Assistente SISLAC" : "Falar com o Assistente SISLAC";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "fixed bottom-4 left-4 z-40 h-10 w-10 rounded-lg",
        "flex items-center justify-center border border-border",
        "bg-background text-foreground shadow-sm hover:bg-accent transition-colors",
        isConnected && "bg-primary text-primary-foreground border-primary hover:bg-primary/90",
        isSpeaking && "animate-pulse",
      )}
    >
      {connecting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isConnected ? (
        <MicOff className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </button>
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
