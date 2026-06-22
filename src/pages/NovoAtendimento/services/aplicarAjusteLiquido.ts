// Aplica ajuste líquido (positivo = acréscimo, negativo = desconto) distribuído
// proporcionalmente sobre `valorOriginal` dos exames cobrados do paciente
// (cobrancaDestino !== "convenio"). Função pura, comportamento idêntico ao
// inline original em NovoAtendimento.tsx (Fase 2A — slicing arquitetural).
//
// Regras (preservadas literalmente):
//  - Apenas exames cobrados do paciente entram no rateio.
//  - Base do rateio = `valorOriginal` (ou `valor`, se ausente).
//  - Desconto NÃO pode ultrapassar o subtotal (clamp em -baseTotal).
//  - Acréscimo não tem teto superior.
//  - Distribuição em centavos com sobra absorvida pelo último item.
import type { Exame } from "../types";

export function aplicarAjusteLiquidoNosExames(
  exames: Exame[],
  ajusteLiquido: number,
): Exame[] {
  const ajuste = Math.round((ajusteLiquido || 0) * 100) / 100;
  const pacienteIdxs = exames
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.cobrancaDestino !== "convenio");
  const bases = new Map<number, number>();
  pacienteIdxs.forEach(({ e, i }) => bases.set(i, e.valorOriginal ?? e.valor));
  const baseTotal = Array.from(bases.values()).reduce((sum, v) => sum + v, 0);
  if (baseTotal <= 0) return exames;
  const ajusteCents = ajuste < 0
    ? Math.max(Math.round(ajuste * 100), -Math.round(baseTotal * 100))
    : Math.round(ajuste * 100);
  let restante = ajusteCents;
  const novosValores = new Map<number, number>();
  pacienteIdxs.forEach(({ i }, idx) => {
    const base = bases.get(i) ?? 0;
    const baseCents = Math.round(base * 100);
    const isLast = idx === pacienteIdxs.length - 1;
    const share = isLast
      ? restante
      : Math.round((baseCents / Math.round(baseTotal * 100)) * ajusteCents);
    restante -= share;
    const novoCents = Math.max(0, baseCents + share);
    novosValores.set(i, novoCents / 100);
  });
  return exames.map((e, i) => {
    const base = bases.get(i);
    if (base == null) return e;
    return { ...e, valorOriginal: base, valor: novosValores.get(i) ?? base };
  });
}
