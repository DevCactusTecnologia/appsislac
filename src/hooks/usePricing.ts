/**
 * HOOK PARA CÁLCULOS DE PREÇO
 * 
 * USE SEMPRE: const { calculatePrice, formatPrice } = usePricing();
 * NUNCA: Calcule preço inline ou em outro arquivo
 */

import { useCallback, useMemo } from "react";
import {
  calculateExamPrice,
  calculateDetailedPrice,
  applyDiscount,
  applySurcharge,
  formatPrice as formatPriceLib,
  sumExamPrices,
  sumDiscounts,
  sumSurcharges,
  type CalculateExamPriceInput,
  type CalculateDetailedPriceInput,
  type ExamPrice,
} from "@/lib/pricingEngine";

export interface UsePricingOptions {
  discountIsPercentage?: boolean;
  surchargeIsPercentage?: boolean;
}

/**
 * Hook para operações de preço
 */
export function usePricing(options: UsePricingOptions = {}) {
  const { discountIsPercentage = false, surchargeIsPercentage = false } = options;

  /**
   * Calcular preço de um exame
   */
  const calculatePrice = useCallback(
    (input: CalculateExamPriceInput): number => {
      return calculateExamPrice(input);
    },
    []
  );

  /**
   * Calcular preço com detalhes (desconto, acréscimo)
   */
  const calculateDetailedPriceFunc = useCallback(
    (input: CalculateDetailedPriceInput): ExamPrice => {
      return calculateDetailedPrice(
        input,
        discountIsPercentage,
        surchargeIsPercentage
      );
    },
    [discountIsPercentage, surchargeIsPercentage]
  );

  /**
   * Aplicar desconto
   */
  const applyDiscountFunc = useCallback(
    (basePrice: number, discountValue?: number) => {
      return applyDiscount(basePrice, discountValue, discountIsPercentage);
    },
    [discountIsPercentage]
  );

  /**
   * Aplicar acréscimo
   */
  const applySurchargeFunc = useCallback(
    (basePrice: number, surchargeValue?: number) => {
      return applySurcharge(basePrice, surchargeValue, surchargeIsPercentage);
    },
    [surchargeIsPercentage]
  );

  /**
   * Formatar preço para display
   */
  const formatPrice = useCallback((price: number): string => {
    return formatPriceLib(price);
  }, []);

  /**
   * Somar múltiplos preços
   */
  const sum = useCallback((examPrices: ExamPrice[]): number => {
    return sumExamPrices(examPrices);
  }, []);

  /**
   * Somar descontos
   */
  const sumDiscountsFunc = useCallback((examPrices: ExamPrice[]): number => {
    return sumDiscounts(examPrices);
  }, []);

  /**
   * Somar acréscimos
   */
  const sumSurchargesFunc = useCallback((examPrices: ExamPrice[]): number => {
    return sumSurcharges(examPrices);
  }, []);

  return useMemo(
    () => ({
      calculatePrice,
      calculateDetailedPrice: calculateDetailedPriceFunc,
      applyDiscount: applyDiscountFunc,
      applySurcharge: applySurchargeFunc,
      formatPrice,
      sum,
      sumDiscounts: sumDiscountsFunc,
      sumSurcharges: sumSurchargesFunc,
    }),
    [
      calculatePrice,
      calculateDetailedPriceFunc,
      applyDiscountFunc,
      applySurchargeFunc,
      formatPrice,
      sum,
      sumDiscountsFunc,
      sumSurchargesFunc,
    ]
  );
}
