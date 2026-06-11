/**
 * Motor de detecção de Resultados Críticos.
 *
 * Movido de src/lib/criticoChecker.ts (Fase: domain slicing).
 * Mantemos um re-export em src/lib/criticoChecker.ts para retro-compat.
 *
 * Um resultado é considerado CRÍTICO quando ultrapassa as faixas de pânico
 * definidas no parâmetro do exame (critico_min / critico_max). Estas faixas
 * são MAIS amplas do que a referência clínica normal e indicam valores que
 * podem representar risco à vida do paciente OU erro no equipamento.
 *
 * Regra: o critico_min é o limite INFERIOR (abaixo = crítico baixo / pânico baixo)
 *        o critico_max é o limite SUPERIOR (acima = crítico alto / pânico alto)
 */

export type NivelCritico = "normal" | "critico_baixo" | "critico_alto";

const parseNumeric = (val: string): number | null => {
  if (!val) return null;
  const cleaned = String(val).replace(/[<>]/g, "").replace(",", ".").trim();
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
};

/**
 * Avalia o nível crítico de um valor contra as faixas configuradas.
 * Retorna "normal" se nenhuma faixa estiver definida ou se o valor estiver dentro.
 */
export function avaliarCritico(
  valor: string,
  criticoMin: string,
  criticoMax: string,
): NivelCritico {
  const v = parseNumeric(valor);
  if (v === null) return "normal";
  const min = parseNumeric(criticoMin);
  const max = parseNumeric(criticoMax);
  if (min !== null && v < min) return "critico_baixo";
  if (max !== null && v > max) return "critico_alto";
  return "normal";
}

export const isCritico = (
  valor: string,
  criticoMin: string,
  criticoMax: string,
): boolean => avaliarCritico(valor, criticoMin, criticoMax) !== "normal";
