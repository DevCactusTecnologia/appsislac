// Máscaras de input reaproveitáveis (somente formatação, não validam regras de negócio).

/** Telefone BR: aceita apenas dígitos, máx 11. Formata (00) 0000-0000 ou (00) 00000-0000. */
export function maskPhoneBR(value: string): string {
  const digits = (value ?? "").replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** CNPJ: aceita apenas dígitos, máx 14. Formata 00.000.000/0000-00. */
export function maskCNPJ(value: string): string {
  const d = (value ?? "").replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export const onlyDigits = (s: string) => (s ?? "").replace(/\D/g, "");
