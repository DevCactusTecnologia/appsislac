/**
 * SSOT — Regras de parâmetro de exame
 *
 * Inspirado no trait `new_parameter` do Coremas (Laravel).
 * Centraliza: tipo, máscara, obrigatoriedade, decimais, validação,
 * faixa crítica e bandas de referência.
 *
 * Hoje essas regras vivem dispersas em:
 *   - exame_parametros (DB)
 *   - valores_referencia (DB)
 *   - src/lib/criticoChecker.ts
 *   - src/lib/parseValorReferencia.ts
 *   - src/pages/ResultadoDetalhe/ParamTypedInput.tsx
 *
 * Este service é o destino canônico (Fase 3). A migração dos
 * consumidores será incremental em rodadas seguintes.
 *
 * Ver: docs/architecture/simplification-master-plan.md (Fase 3)
 *      docs/architecture/domain-services-plan.md
 */

export type ParameterType = "numeric" | "text" | "select" | "calculated";
export type InputMask = "decimal" | "integer" | "text" | "select" | "none";
export type Sexo = "M" | "F" | "I";

export interface ReferenceBand {
  sexo: Sexo;
  idadeMinMeses: number;
  idadeMaxMeses: number;
  minimo?: number | null;
  maximo?: number | null;
  textoLivre?: string | null;
}

export interface ParameterRules {
  paramId: string;
  exameId: string;
  type: ParameterType;
  mask: InputMask;
  required: boolean;
  decimals: number;
  unidade?: string | null;
  critical: { min?: number | null; max?: number | null };
  reference: ReferenceBand[];
  options?: string[];
}

export interface ValidationResult {
  ok: boolean;
  isCritical: boolean;
  outOfRange: boolean;
  message?: string;
}

export interface ParameterContext {
  sexo: Sexo;
  idadeMeses: number;
}

/**
 * Stub registrado. A implementação real consumirá:
 *   - exameParametrosStore (regras de input/crítico/decimais)
 *   - valoresReferenciaStore (bandas etárias)
 *
 * Mantido como contrato estável para que os consumidores
 * possam migrar progressivamente sem aguardar a implementação.
 */
export function getParameterRules(
  _exameId: string,
  _paramId: string,
  _ctx: ParameterContext,
): ParameterRules | null {
  // TODO(Fase 3.b): implementar resolver consumindo stores existentes.
  // Mantido como null para sinalizar aos consumidores que devem usar
  // o caminho legado até a migração ser concluída.
  return null;
}

/**
 * Valida um valor digitado contra as regras + bandas de referência
 * + faixa crítica do parâmetro. Funções puras, sem React/toast.
 */
export function validateValue(
  rules: ParameterRules,
  rawValue: string,
): ValidationResult {
  if (rules.required && !rawValue.trim()) {
    return { ok: false, isCritical: false, outOfRange: false, message: "Campo obrigatório" };
  }
  if (rules.type !== "numeric") {
    return { ok: true, isCritical: false, outOfRange: false };
  }
  const n = Number(rawValue.replace(",", "."));
  if (!Number.isFinite(n)) {
    return { ok: false, isCritical: false, outOfRange: false, message: "Valor inválido" };
  }
  const isCritical =
    (rules.critical.min != null && n < rules.critical.min) ||
    (rules.critical.max != null && n > rules.critical.max);
  const inAnyBand = rules.reference.some(
    (b) =>
      (b.minimo == null || n >= b.minimo) &&
      (b.maximo == null || n <= b.maximo),
  );
  const outOfRange = rules.reference.length > 0 && !inAnyBand;
  return { ok: true, isCritical, outOfRange };
}
