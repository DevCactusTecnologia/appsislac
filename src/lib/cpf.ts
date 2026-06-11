// Validação de CPF conforme algoritmo oficial da Receita Federal.
// Regras: 11 dígitos numéricos, não pode ser sequência repetida e os
// dois dígitos verificadores precisam bater com o cálculo modular 11.

export const sanitizeCPF = (raw: string): string => (raw || "").replace(/\D+/g, "");

export function isValidCPF(raw: string): boolean {
  const cpf = sanitizeCPF(raw);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const calcDigit = (slice: string, factorStart: number): number => {
    let sum = 0;
    for (let i = 0; i < slice.length; i++) {
      sum += Number(slice[i]) * (factorStart - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  const d1 = calcDigit(cpf.slice(0, 9), 10);
  if (d1 !== Number(cpf[9])) return false;
  const d2 = calcDigit(cpf.slice(0, 10), 11);
  if (d2 !== Number(cpf[10])) return false;
  return true;
}

/** Indica se o texto digitado se parece com um CPF (>= 11 dígitos). */
export const looksLikeCPF = (raw: string): boolean => sanitizeCPF(raw).length >= 11;
