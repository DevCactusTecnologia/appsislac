// Context Engine — descoberta automática de contexto. O usuário nunca informa
// manualmente o que o sistema já conhece.
import { useLocation, useParams } from "react-router-dom";
import { useMemo } from "react";

export type AIModule =
  | "pacientes" | "atendimentos" | "exames" | "resultados"
  | "soroteca" | "financeiro" | "whatsapp" | "producao"
  | "configuracoes" | "dashboard" | "outro";

export interface AIContext {
  route: { path: string; params: Record<string, string> };
  module: AIModule;
  focus: {
    pacienteId?: string;
    atendimentoId?: string;
    exameId?: string;
    resultadoId?: string;
    amostraId?: string;
  };
}

function moduleFromPath(path: string): AIModule {
  if (path.startsWith("/pacientes")) return "pacientes";
  if (path.startsWith("/atendimento") || path.startsWith("/novo")) return "atendimentos";
  if (path.startsWith("/exames")) return "exames";
  if (path.startsWith("/resultado")) return "resultados";
  if (path.startsWith("/soroteca")) return "soroteca";
  if (path.startsWith("/financeiro")) return "financeiro";
  if (path.startsWith("/producao")) return "producao";
  if (path.startsWith("/dashboard")) return "dashboard";
  if (path.startsWith("/configuracoes")) return "configuracoes";
  return "outro";
}

export function useAIContext(): AIContext {
  const location = useLocation();
  const params = useParams();
  return useMemo<AIContext>(() => {
    const path = location.pathname;
    const mod = moduleFromPath(path);
    const focus: AIContext["focus"] = {};
    const id = params.id as string | undefined;
    if (id) {
      if (mod === "pacientes") focus.pacienteId = id;
      else if (mod === "atendimentos") focus.atendimentoId = id;
      else if (mod === "exames") focus.exameId = id;
      else if (mod === "resultados") focus.resultadoId = id;
      else if (mod === "soroteca") focus.amostraId = id;
    }
    return {
      route: { path, params: params as Record<string, string> },
      module: mod,
      focus,
    };
  }, [location.pathname, params]);
}

/** Sugestões contextuais baseadas no foco atual. */
export function getContextualSuggestions(ctx: AIContext): Array<{ id: string; label: string; prompt: string }> {
  const out: Array<{ id: string; label: string; prompt: string }> = [];
  if (ctx.focus.pacienteId) {
    out.push({
      id: "buscar-historico",
      label: "Pesquisar histórico deste paciente",
      prompt: `Pesquisar histórico do paciente ${ctx.focus.pacienteId}`,
    });
  }
  return out.slice(0, 3);
}
