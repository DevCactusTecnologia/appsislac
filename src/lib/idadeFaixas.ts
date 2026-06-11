/**
 * Helpers para conversão e análise de faixas etárias em DIAS.
 * Usado pela "Régua etária" e pela matriz de valores de referência.
 */

export type UnidadeIdade = "Anos" | "Meses" | "Dias";

export interface FaixaEtaria {
  id: string;
  label: string;
  deDias: number;
  ateDias: number; // inclusivo
}

const DIAS_ANO = 365;
const DIAS_MES = 30;
export const MAX_DIAS = 150 * DIAS_ANO; // 150 anos

export function toDias(valor: string | number, unidade: UnidadeIdade): number {
  const n = typeof valor === "number" ? valor : parseFloat(String(valor).replace(",", ".")) || 0;
  if (unidade === "Anos") return Math.round(n * DIAS_ANO);
  if (unidade === "Meses") return Math.round(n * DIAS_MES);
  return Math.round(n);
}

/** Escolhe a unidade mais legível para uma quantidade de dias. */
export function fromDias(dias: number): { valor: string; unidade: UnidadeIdade } {
  if (dias <= 0) return { valor: "0", unidade: "Dias" };
  if (dias % DIAS_ANO === 0 && dias >= DIAS_ANO) {
    return { valor: String(dias / DIAS_ANO), unidade: "Anos" };
  }
  if (dias % DIAS_MES === 0 && dias >= DIAS_MES) {
    return { valor: String(dias / DIAS_MES), unidade: "Meses" };
  }
  return { valor: String(dias), unidade: "Dias" };
}

/** Rótulo curto humano para uma faixa em dias (ex.: "0–3m", "2–4a", "12a+"). */
export function labelFaixa(deDias: number, ateDias: number): string {
  const fmt = (d: number, edge: "de" | "ate"): string => {
    if (edge === "de" && d === 0) return "0";
    if (edge === "ate" && d >= MAX_DIAS) return "+";
    if (d < DIAS_MES) return `${d}d`;
    if (d < DIAS_ANO) {
      const m = Math.round(d / DIAS_MES);
      return `${m}m`;
    }
    const anos = d / DIAS_ANO;
    return Number.isInteger(anos) ? `${anos}a` : `${anos.toFixed(1)}a`;
  };
  const a = fmt(deDias, "de");
  const b = fmt(ateDias, "ate");
  return b === "+" ? `${a === "0" ? "0" : a}+` : `${a}–${b}`;
}

/** Análise de cobertura de um conjunto de faixas (em dias) sobre 0..MAX_DIAS. */
export interface CoberturaResult {
  cobre0a150: boolean;
  gaps: Array<{ de: number; ate: number }>;
  overlaps: Array<{ a: FaixaEtaria; b: FaixaEtaria; de: number; ate: number }>;
}

export function analisarCobertura(faixas: FaixaEtaria[]): CoberturaResult {
  const ordered = [...faixas].sort((x, y) => x.deDias - y.deDias);
  const gaps: CoberturaResult["gaps"] = [];
  const overlaps: CoberturaResult["overlaps"] = [];

  let cursor = 0;
  for (let i = 0; i < ordered.length; i++) {
    const f = ordered[i];
    if (f.deDias > cursor) gaps.push({ de: cursor, ate: f.deDias - 1 });
    cursor = Math.max(cursor, f.ateDias + 1);
    for (let j = i + 1; j < ordered.length; j++) {
      const g = ordered[j];
      if (g.deDias > f.ateDias) break;
      overlaps.push({
        a: f, b: g,
        de: Math.max(f.deDias, g.deDias),
        ate: Math.min(f.ateDias, g.ateDias),
      });
    }
  }
  if (cursor < MAX_DIAS) gaps.push({ de: cursor, ate: MAX_DIAS });

  return {
    cobre0a150: gaps.length === 0,
    gaps,
    overlaps,
  };
}

/** True se uma VR (em dias) cabe inteiramente dentro de uma faixa da régua. */
export function vrCabeNaFaixa(
  vrDe: number, vrAte: number,
  faixaDe: number, faixaAte: number,
): boolean {
  return vrDe >= faixaDe && vrAte <= faixaAte;
}
