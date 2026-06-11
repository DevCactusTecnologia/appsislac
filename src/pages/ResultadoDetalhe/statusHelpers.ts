// Helpers puros de status — extraídos de ResultadoDetalhe.tsx.
// Fase 1 (Architectural Split Program). Sem mudança comportamental.
import type { ExameStatus } from "./types";

export const statusAnaliseLabel = (status: ExameStatus): string => {
  switch (status) {
    case "Pendente": return "Análise Pendente";
    case "Digitado": return "Digitado";
    case "Cancelado": return "Cancelado";
    case "Impresso": return "Impresso";
    case "Resultado salvo": return "Resultado salvo";
    case "Em retificação": return "Em retificação";
    case "Retificado": return "Retificado";
  }
};

export const isExameLiberadoStatus = (status: ExameStatus): boolean =>
  status === "Digitado" || status === "Impresso" || status === "Retificado";

export const isExameBloqueadoStatus = (status: ExameStatus): boolean =>
  status === "Resultado salvo" || isExameLiberadoStatus(status);

export const statusGeralType = (status: string): "success" | "warning" | "danger" | "info" => {
  if (status === "Cancelado") return "danger";
  if (status === "Retificado") return "info";
  if (status === "Finalizado") return "success";
  return "warning";
};
