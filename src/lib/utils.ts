import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formata um número como moeda brasileira (Real).
 * Usa separador de milhar "." e decimal ",".
 * Exemplos: 2980 → "R$ 2.980,00" | 20536.3 → "R$ 20.536,30"
 */
const _brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function fmtBRL(value: number | null | undefined): string {
  const n = typeof value === "number" && isFinite(value) ? value : 0;
  // Intl retorna "R$\u00A02.980,00"; normaliza o NBSP para espaço comum.
  return _brlFormatter.format(n).replace(/\u00A0/g, " ");
}

/** Versão sem o prefixo "R$ " (apenas o número formatado). */
export function fmtBRLNumber(value: number | null | undefined): string {
  return fmtBRL(value).replace(/^R\$\s?/, "");
}

/**
 * Normaliza uma string para busca: remove acentos (NFD + strip diacríticos),
 * faz lowercase e trim. Use SEMPRE em ambos os lados da comparação para
 * garantir busca case- e accent-insensitive ("SUMARIO" ≡ "Sumário").
 */
export function searchNormalize(value: string | null | undefined): string {
  if (!value) return "";
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/**
 * Helper para "haystack contém needle" com normalização (acento + caixa).
 */
export function matchesSearch(haystack: string | null | undefined, needle: string | null | undefined): boolean {
  const n = searchNormalize(needle);
  if (!n) return true;
  return searchNormalize(haystack).includes(n);
}
