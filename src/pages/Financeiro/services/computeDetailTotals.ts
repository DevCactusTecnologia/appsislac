// Totais derivados do detalhe de atendimento na tela Financeiro.
// `totalExames` reflete o EFETIVO (já com desconto distribuído).
// `subtotalExames` é o preço cheio (antes do desconto).
// `descontoExames` = subtotal − total. Saldo = total − pago.
import type { MockAtendimento } from "@/data/types";
import type { DetailExameValor } from "./computeDetailExames";

export interface DetailTotals {
  /** Total efetivo (após desconto distribuído). */
  totalExames: number;
  /** Total cheio (antes do desconto). */
  subtotalExames: number;
  /** Desconto aplicado = subtotal − total. */
  descontoExames: number;
  totalPago: number;
  saldo: number;
}

export function computeDetailTotals(
  detailExames: DetailExameValor[],
  detailAtendimento: MockAtendimento | null,
): DetailTotals {
  const totalExames = detailExames.reduce((s, e) => s + e.valor, 0);
  const subtotalExames = detailExames.reduce((s, e) => s + e.valorOriginal, 0);
  const descontoExames = Math.max(0, Math.round((subtotalExames - totalExames) * 100) / 100);
  const totalPago = (detailAtendimento?.pagamentosRealizados ?? []).reduce(
    (s, p) => s + p.valor,
    0,
  );
  return {
    totalExames,
    subtotalExames,
    descontoExames,
    totalPago,
    saldo: totalExames - totalPago,
  };
}
