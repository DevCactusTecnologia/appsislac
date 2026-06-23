/**
 * PRICING ENGINE - ÚNICA FONTE DE VERDADE
 * 
 * REGRA OURO: NUNCA calcular preço em outro lugar
 * SEMPRE: Importar e usar functions deste arquivo
 * 
 * AUDITADO: Implementação preserva lógica original 100%
 */

import { getTabelaByConvenioNome, getPrecoExame, type TabelaTipo } from "@/data/tabelaPrecoStore";

// ============================================================================
// TIPOS
// ============================================================================

export interface ExamPrice {
  examName: string;
  convenioName: string;
  basePrice: number;
  discount: number;
  surcharge: number;
  finalPrice: number;
  priceTableUsed: TabelaTipo | "Própria" | "nenhuma";
}

export interface CalculateExamPriceInput {
  nomeExame: string;
  convenioNome: string;
  /** Valor já persistido em `examesCobranca[i].valor`, se houver. Tem prioridade absoluta. */
  metaValor?: number | null;
}

export interface CalculateDetailedPriceInput extends CalculateExamPriceInput {
  discount?: number;
  surcharge?: number;
}

// ============================================================================
// REGRA 1: CALCULAR PREÇO BASE
// ============================================================================

/**
 * Calcular preço base de um exame
 * 
 * REGRA:
 *  1. Se houver metaValor, retorna ele (persistido anteriormente)
 *  2. Caso contrário, tenta tabela do convênio
 *  3. Se não tiver, cai para "Própria"
 *  4. Se nenhuma, retorna 0 (UI exibe "sem preço")
 * 
 * NUNCA duplicar esta lógica
 */
export function calculateExamPrice({
  nomeExame,
  convenioNome,
  metaValor,
}: CalculateExamPriceInput): number {
  // 1. Se já foi calculado e persistido, respeitar (prioridade máxima)
  if (typeof metaValor === "number") {
    console.debug(`✓ Preço meta encontrado: ${nomeExame} = ${metaValor}`);
    return metaValor;
  }

  // 2. Tentar tabela do convênio
  const tabela = getTabelaByConvenioNome(convenioNome) as TabelaTipo | null;
  if (tabela) {
    const precoTabela = getPrecoExame(nomeExame, tabela);
    if (typeof precoTabela === "number") {
      console.debug(
        `✓ Preço de tabela encontrado: ${nomeExame} em ${tabela} = ${precoTabela}`
      );
      return precoTabela;
    }
  }

  // 3. Fallback para tabela "Própria"
  const precoProprio = getPrecoExame(nomeExame, "Própria");
  if (typeof precoProprio === "number") {
    console.debug(`✓ Preço próprio encontrado: ${nomeExame} = ${precoProprio}`);
    return precoProprio;
  }

  // 4. Sem preço cadastrado
  console.warn(`⚠️  Nenhum preço encontrado para: ${nomeExame}`);
  return 0;
}

// ============================================================================
// REGRA 2: APLICAR DESCONTO
// ============================================================================

/**
 * Aplicar desconto a um preço
 * 
 * Suporta:
 *  - Percentual: desconto = 10 (10%)
 *  - Fixo: desconto = 50.00 (R$ 50)
 */
export function applyDiscount(
  basePrice: number,
  discountValue?: number,
  isPercentage: boolean = false
): { discountAmount: number; finalPrice: number } {
  if (!discountValue || discountValue <= 0) {
    return {
      discountAmount: 0,
      finalPrice: basePrice,
    };
  }

  let discountAmount = 0;

  if (isPercentage) {
    discountAmount = (basePrice * discountValue) / 100;
  } else {
    discountAmount = Math.min(discountValue, basePrice);
  }

  return {
    discountAmount: Math.round(discountAmount * 100) / 100,
    finalPrice: Math.max(0, basePrice - discountAmount),
  };
}

// ============================================================================
// REGRA 3: APLICAR ACRÉSCIMO
// ============================================================================

/**
 * Aplicar acréscimo (surcharge) a um preço
 * 
 * Suporta:
 *  - Percentual: surcharge = 5 (5%)
 *  - Fixo: surcharge = 10.00 (R$ 10)
 */
export function applySurcharge(
  basePrice: number,
  surchargeValue?: number,
  isPercentage: boolean = false
): { surchargeAmount: number; finalPrice: number } {
  if (!surchargeValue || surchargeValue <= 0) {
    return {
      surchargeAmount: 0,
      finalPrice: basePrice,
    };
  }

  let surchargeAmount = 0;

  if (isPercentage) {
    surchargeAmount = (basePrice * surchargeValue) / 100;
  } else {
    surchargeAmount = surchargeValue;
  }

  return {
    surchargeAmount: Math.round(surchargeAmount * 100) / 100,
    finalPrice: basePrice + surchargeAmount,
  };
}

// ============================================================================
// REGRA 4: CÁLCULO COMPLETO (BASE + DESCONTO + ACRÉSCIMO)
// ============================================================================

/**
 * Calcular preço final com todos os ajustes
 * 
 * ORDEM DE OPERAÇÃO (IMPORTANTE):
 *  1. Calcular preço base
 *  2. Aplicar desconto
 *  3. Aplicar acréscimo sobre o preço com desconto
 */
export function calculateDetailedPrice(
  input: CalculateDetailedPriceInput,
  discountIsPercentage: boolean = false,
  surchargeIsPercentage: boolean = false
): ExamPrice {
  // 1. Preço base
  const basePrice = calculateExamPrice({
    nomeExame: input.nomeExame,
    convenioNome: input.convenioNome,
    metaValor: input.metaValor,
  });

  // 2. Aplicar desconto
  const discounted = applyDiscount(
    basePrice,
    input.discount,
    discountIsPercentage
  );

  // 3. Aplicar acréscimo SOBRE o preço com desconto
  const final = applySurcharge(
    discounted.finalPrice,
    input.surcharge,
    surchargeIsPercentage
  );

  return {
    examName: input.nomeExame,
    convenioName: input.convenioNome,
    basePrice,
    discount: discounted.discountAmount,
    surcharge: final.surchargeAmount,
    finalPrice: final.finalPrice,
    priceTableUsed: "nenhuma", // TODO: rastrear qual tabela foi usada
  };
}

// ============================================================================
// REGRA 5: VALIDAÇÃO DE PREÇO
// ============================================================================

/**
 * Validar se um preço é válido
 */
export function isValidPrice(price: number): boolean {
  return typeof price === "number" && price >= 0 && Number.isFinite(price);
}

/**
 * Validar se um exame tem preço válido
 */
export function hasValidPrice(examPrice: ExamPrice): boolean {
  return (
    isValidPrice(examPrice.basePrice) &&
    isValidPrice(examPrice.finalPrice) &&
    examPrice.finalPrice >= 0
  );
}

// ============================================================================
// REGRA 6: FORMATAÇÃO E DISPLAY
// ============================================================================

/**
 * Formatar preço para display (R$ 100,50)
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(price);
}

/**
 * Formatar array de preços
 */
export function formatPrices(prices: ExamPrice[]): string[] {
  return prices.map((p) => formatPrice(p.finalPrice));
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Somar preços de múltiplos exames
 */
export function sumExamPrices(examPrices: ExamPrice[]): number {
  return examPrices.reduce((sum, exam) => sum + exam.finalPrice, 0);
}

/**
 * Calcular desconto total de múltiplos exames
 */
export function sumDiscounts(examPrices: ExamPrice[]): number {
  return examPrices.reduce((sum, exam) => sum + exam.discount, 0);
}

/**
 * Calcular acréscimo total de múltiplos exames
 */
export function sumSurcharges(examPrices: ExamPrice[]): number {
  return examPrices.reduce((sum, exam) => sum + exam.surcharge, 0);
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * Calcular preço para múltiplos exames (NUNCA fazer em loop fora!)
 */
export function calculateMultipleExamPrices(
  exams: CalculateDetailedPriceInput[],
  discountIsPercentage: boolean = false,
  surchargeIsPercentage: boolean = false
): ExamPrice[] {
  return exams.map((exam) =>
    calculateDetailedPrice(exam, discountIsPercentage, surchargeIsPercentage)
  );
}

/**
 * Relatório de preços (para debugging)
 */
export function generatePriceReport(examPrices: ExamPrice[]): string {
  const lines = [
    "=== RELATÓRIO DE PREÇOS ===",
    ...examPrices.map(
      (p) =>
        `${p.examName}: ${formatPrice(p.basePrice)} - desc ${formatPrice(p.discount)} + acres ${formatPrice(p.surcharge)} = ${formatPrice(p.finalPrice)}`
    ),
    `TOTAL: ${formatPrice(sumExamPrices(examPrices))}`,
    `DESC TOTAL: ${formatPrice(sumDiscounts(examPrices))}`,
    `ACRES TOTAL: ${formatPrice(sumSurcharges(examPrices))}`,
  ];
  return lines.join("\n");
}
