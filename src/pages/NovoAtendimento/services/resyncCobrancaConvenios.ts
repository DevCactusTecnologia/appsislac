// Re-sincronização pura da cobrança ao mudar a lista de convênios do
// atendimento. Extraído de NovoAtendimento.tsx (Fase 2 — Architectural
// Split Program). Comportamento preservado literalmente.
//
// Regra: se um exame estava cobrado de um convênio que foi removido
// (ou cujo id não está mais no conjunto de convênios não-Particular
// selecionados), ele volta para cobrança do paciente. Caso contrário,
// o array original é retornado por referência (estável para React).
import type { Exame } from "../types";

export function resyncCobrancaConvenios(
  exames: Exame[],
  conveniosNaoParticularesIds: Set<number>,
): Exame[] {
  let mudou = false;
  const next = exames.map((e) => {
    if (
      e.cobrancaDestino === "convenio" &&
      (e.convenioCobrancaId == null ||
        !conveniosNaoParticularesIds.has(e.convenioCobrancaId))
    ) {
      mudou = true;
      return {
        ...e,
        cobrancaDestino: "paciente" as const,
        convenioCobrancaId: null,
      };
    }
    return e;
  });
  return mudou ? next : exames;
}
