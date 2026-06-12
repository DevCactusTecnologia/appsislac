// Resumo de valores por forma de pagamento + total.
// Extraído de Financeiro.tsx > summary useMemo (Fase 3).
// Regra preservada literalmente:
//  - Quando activeTab === "caixa": soma apenas `entradas` (saídas ignoradas).
//  - Quando activeTab === "saida": soma apenas `filtered` (que já é a lista de saídas).
//  - Demais abas: soma `filtered` (entradas+saidas misturadas, mas com filtro
//    "se saida, return" preservado — i.e. somente entradas entram).
import type { FinanceiroEntry } from "../types";

export interface FinanceiroSummary {
  byMethod: Record<string, number>;
  total: number;
}

export function computeFinanceiroSummary(
  activeTab: string,
  entradas: FinanceiroEntry[],
  filtered: FinanceiroEntry[],
): FinanceiroSummary {
  const map: Record<string, number> = {};
  let total = 0;
  const data = activeTab === "caixa" ? entradas : filtered;
  data.forEach((e) => {
    if (activeTab === "saida") return;
    map[e.pagamento] = (map[e.pagamento] || 0) + e.valorTotal;
    total += e.valorTotal;
  });
  if (activeTab === "saida") {
    filtered.forEach((e) => {
      map[e.pagamento] = (map[e.pagamento] || 0) + e.valorTotal;
      total += e.valorTotal;
    });
  }
  return { byMethod: map, total };
}
