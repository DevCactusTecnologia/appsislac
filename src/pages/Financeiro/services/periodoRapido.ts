// Extração mecânica de `aplicarPeriodoRapido` (Financeiro.tsx).
// Função pura: dado o preset de período, devolve {dateFrom, dateTo}.
// Regra preservada literalmente:
//  - "tudo"   → ambos undefined
//  - "hoje"   → [hoje, hoje]
//  - "7d"     → [hoje-6, hoje]
//  - "30d"    → [hoje-29, hoje]
//  - "mes"    → [1º dia do mês corrente, hoje]
//  - "ano"    → [1º dia do ano corrente, hoje]
//  - "custom" → não altera nada (retorna current as-is — caller decide)
export type PeriodoRapido = "hoje" | "7d" | "mes" | "30d" | "ano" | "tudo" | "custom";

export interface PeriodoRange {
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
}

export function computePeriodoRange(
  p: PeriodoRapido,
  current?: PeriodoRange,
): PeriodoRange {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (p === "tudo") return { dateFrom: undefined, dateTo: undefined };
  if (p === "hoje") return { dateFrom: today, dateTo: today };
  if (p === "7d") {
    const f = new Date(today); f.setDate(f.getDate() - 6);
    return { dateFrom: f, dateTo: today };
  }
  if (p === "30d") {
    const f = new Date(today); f.setDate(f.getDate() - 29);
    return { dateFrom: f, dateTo: today };
  }
  if (p === "mes") {
    return { dateFrom: new Date(today.getFullYear(), today.getMonth(), 1), dateTo: today };
  }
  if (p === "ano") {
    return { dateFrom: new Date(today.getFullYear(), 0, 1), dateTo: today };
  }
  // "custom" → preserva o estado atual
  return current ?? { dateFrom: undefined, dateTo: undefined };
}
