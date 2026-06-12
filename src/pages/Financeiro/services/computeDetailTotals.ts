// Totais derivados do detalhe de atendimento na tela Financeiro.
// Extraído de Financeiro.tsx (Fase 3 — Architectural Split).
// Comportamento idêntico: soma exames, soma pagamentos realizados, saldo = diff.
import type { MockAtendimento } from "@/data/types";
import type { DetailExameValor } from "./computeDetailExames";

export interface DetailTotals {
  totalExames: number;
  totalPago: number;
  saldo: number;
}

export function computeDetailTotals(
  detailExames: DetailExameValor[],
  detailAtendimento: MockAtendimento | null,
): DetailTotals {
  const totalExames = detailExames.reduce((s, e) => s + e.valor, 0);
  const totalPago = (detailAtendimento?.pagamentosRealizados ?? []).reduce(
    (s, p) => s + p.valor,
    0,
  );
  return { totalExames, totalPago, saldo: totalExames - totalPago };
}
