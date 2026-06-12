// Validação pura do diálogo de edição de Saída.
// Extraído de Financeiro.tsx > handleEditSave (Fase 3 — Architectural Split).
// Regra preservada literalmente: dataVencimento obrigatória/válida;
// quando foiPago === "Sim", dataPagamento obrigatória/válida.
import { isValidDateBR } from "../helpers";

export interface SaidaEditDraft {
  dataVencimento?: string;
  dataPagamento?: string;
  foiPago?: string;
}

export interface SaidaEditValidationError {
  title: string;
  description: string;
}

export function validateSaidaEdit(
  draft: SaidaEditDraft,
): SaidaEditValidationError | null {
  if (!isValidDateBR(draft.dataVencimento ?? "")) {
    return {
      title: "Vencimento inválido",
      description: "Use o formato dd/mm/aaaa.",
    };
  }
  if (draft.foiPago === "Sim" && !isValidDateBR(draft.dataPagamento ?? "")) {
    return {
      title: "Data de pagamento inválida",
      description: "Use o formato dd/mm/aaaa.",
    };
  }
  return null;
}
