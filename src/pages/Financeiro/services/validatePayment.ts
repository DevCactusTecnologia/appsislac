// Validação pura do diálogo "Pagar despesa" (handleConfirmPay).
// Extraído de Financeiro.tsx (Fase 3 — Architectural Split).
// Regra preservada literalmente.
import { isValidDateBR } from "../helpers";

export interface PaymentDraft {
  payData: string;
  payForma: string;
}

export interface PaymentValidationError {
  title: string;
  description: string;
}

export function validatePayment(draft: PaymentDraft): PaymentValidationError | null {
  if (!isValidDateBR(draft.payData) || !draft.payData) {
    return {
      title: "Data inválida",
      description: "Informe uma data de pagamento válida (dd/mm/aaaa).",
    };
  }
  if (!draft.payForma.trim()) {
    return {
      title: "Forma de pagamento obrigatória",
      description: "Selecione ou informe a forma de pagamento.",
    };
  }
  return null;
}
