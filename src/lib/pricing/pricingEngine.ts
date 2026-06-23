/**
 * MOTOR DE PREÇO CENTRALIZADO
 * Fonte única de verdade para TODOS os cálculos de preço
 */

import { getTabelaByConvenioNome } from "@/data/convenioStore";
import { getPrecoExame, type TabelaTipo } from "@/data/tabelaPrecoStore";

export interface ExamPrice {
  exameName: string;
  basePrice: number;
  convenioName?: string;
  convenioTable?: string;
  discount?: number;
  surcharge?: number;
  finalPrice: number;
  calculatedAt: Date;
  source: "persisted" | "convenio" | "proprietary" | "default";
}

export interface CalculatePriceInput {
  exameName: string;
  convenioName: string;
  metaValue?: number | null;
  discount?: number;
  surcharge?: number;
}

export function calculateBasePrice(input: CalculatePriceInput): ExamPrice {
  const { exameName, convenioName, metaValue } = input;
  
  if (typeof metaValue === "number" && metaValue >= 0) {
    return {
      exameName,
      basePrice: metaValue,
      convenioName,
      finalPrice: metaValue,
      calculatedAt: new Date(),
      source: "persisted",
    };
  }
  
  const convenioTable = getTabelaByConvenioNome(convenioName) as TabelaTipo;
  const convenioPrice = getPrecoExame(exameName, convenioTable);
  
  if (typeof convenioPrice === "number" && convenioPrice > 0) {
    return {
      exameName,
      basePrice: convenioPrice,
      convenioName,
      convenioTable: convenioTable,
      finalPrice: convenioPrice,
      calculatedAt: new Date(),
      source: "convenio",
    };
  }
  
  const ownPrice = getPrecoExame(exameName, "Própria");
  
  if (typeof ownPrice === "number" && ownPrice > 0) {
    return {
      exameName,
      basePrice: ownPrice,
      convenioName,
      convenioTable: "Própria",
      finalPrice: ownPrice,
      calculatedAt: new Date(),
      source: "proprietary",
    };
  }
  
  return {
    exameName,
    basePrice: 0,
    convenioName,
    finalPrice: 0,
    calculatedAt: new Date(),
    source: "default",
  };
}

export function calculateFinalPrice(
  basePrice: number,
  options?: {
    discount?: number;
    surcharge?: number;
  }
): number {
  let price = basePrice;
  
  if (options?.discount && options.discount > 0) {
    price -= (price * options.discount) / 100;
  }
  
  if (options?.surcharge && options.surcharge > 0) {
    price += (price * options.surcharge) / 100;
  }
  
  return Math.max(0, Math.round(price * 100) / 100);
}

export function calculateCompletePrice(input: CalculatePriceInput): ExamPrice {
  const basePrice = calculateBasePrice(input);
  const finalPrice = calculateFinalPrice(basePrice.basePrice, {
    discount: input.discount,
    surcharge: input.surcharge,
  });
  
  return { ...basePrice, finalPrice };
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(price);
}
