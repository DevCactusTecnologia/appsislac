// Filtra entradas "pagas" e ordena por data desc.
// Extraído de Financeiro.tsx > entradas useMemo (Fase 3).
// Regra preservada literalmente: status (lower) === "pago" || "pagamento efetuado".
import type { FinanceiroEntradaView } from "@/data/financeiroStore";
import type { FinanceiroEntry } from "../types";
import { entradaViewToEntry } from "../helpers";

export function filterEntradasPagas(
  entradasView: FinanceiroEntradaView[],
): FinanceiroEntry[] {
  return entradasView
    .map(entradaViewToEntry)
    .filter((e) => {
      const st = (e.statusPagamento || "").toLowerCase();
      return st === "pago" || st === "pagamento efetuado";
    })
    .sort((a, b) => b.data.localeCompare(a.data));
}
