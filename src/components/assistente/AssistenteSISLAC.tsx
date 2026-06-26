import { useCallback, useEffect, useRef, useState } from "react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { useLocation, useNavigate } from "react-router-dom";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

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

export function AssistenteSISLAC() {
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

export default AssistenteSISLAC;
