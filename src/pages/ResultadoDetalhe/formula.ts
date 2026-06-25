// Avaliação de fórmulas científicas para parâmetros do tipo "Formula".
// O texto da fórmula é gravado em `exame_parametros.valor_referencia` no formato
// `(##CHAVE_A##/##CHAVE_B##)*10`. Aqui resolvemos placeholders por chave a
// partir dos valores informados pelos demais parâmetros do mesmo exame e
// avaliamos a expressão de forma segura (apenas dígitos e operadores
// aritméticos básicos).
import type { Parametro } from "./types";

const upper = (s?: string) => (s ?? "").trim().toUpperCase();

/** Mapa CHAVE → valor digitado, varrendo todos os parâmetros do exame. */
export function buildValuesByChave(parametros: Parametro[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of parametros) {
    if (p.chave) out[upper(p.chave)] = p.valor ?? "";
    if (p.rotulo) out[upper(p.rotulo)] = p.valor ?? "";
  }
  return out;
}

/** Substitui ##CHAVE## por número e avalia.
 *
 * • `allowPartial = false` (padrão): se faltar QUALQUER valor referenciado,
 *   retorna "" — usado em fórmulas tipo V.C.M = (HCT/HEMA)*10, onde um
 *   resultado parcial não faz sentido.
 * • `allowPartial = true`: trata valores ausentes como 0 e sempre devolve o
 *   resultado parcial — usado no contador da série branca (CONT), que deve
 *   somar em tempo real conforme o usuário digita os diferenciais.
 *   Retorna "" apenas quando NENHUM valor foi preenchido ainda.
 */
export function evaluateFormula(
  formula: string | undefined | null,
  valuesByChave: Record<string, string>,
  casasDecimais = 2,
  allowPartial = false,
): string {
  if (!formula) return "";
  let missing = false;
  let anyFilled = false;
  const expr = formula.replace(/##([A-Za-z0-9_+\-.]+)##/g, (_, key: string) => {
    const raw = valuesByChave[key.toUpperCase()] ?? "";
    if (raw === "" || raw == null) {
      missing = true;
      return "0";
    }
    const n = parseFloat(String(raw).replace(",", "."));
    if (!isFinite(n)) {
      missing = true;
      return "0";
    }
    anyFilled = true;
    return String(n);
  });
  if (missing && !allowPartial) return "";
  if (allowPartial && !anyFilled) return "";
  // Allowlist seguro: dígitos, operadores, parênteses e pontos.
  if (!/^[0-9+\-*/().\s]+$/.test(expr)) return "";
  try {
    // eslint-disable-next-line no-new-func
    const v = Function(`"use strict"; return (${expr});`)();
    if (typeof v !== "number" || !isFinite(v)) return "";
    const casas = Math.max(0, casasDecimais);
    return v.toLocaleString("pt-BR", {
      maximumFractionDigits: casas,
      minimumFractionDigits: casas,
    });
  } catch {
    return "";
  }
}
