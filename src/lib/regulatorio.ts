// Adequações regulatórias TUSS (ANS RN 501/2022 — Padrão TISS) e CBHPM (AMB).
// Centraliza validações e listas estruturadas usadas em formulários e relatórios.

/** TUSS Tabela 22 (Análises Clínicas) — códigos numéricos de 8 dígitos. */
export const TUSS_LENGTH = 8;

/** Remove tudo que não é dígito. */
export const sanitizeTuss = (raw: string): string => (raw || "").replace(/\D+/g, "").slice(0, TUSS_LENGTH);

/** Valida formato TUSS: vazio é permitido (campo opcional no cadastro), mas se preenchido precisa ter 8 dígitos. */
export function validarTuss(codigo: string): { ok: boolean; mensagem?: string } {
  const c = (codigo || "").trim();
  if (!c) return { ok: true };
  if (!/^\d{8}$/.test(c)) {
    return { ok: false, mensagem: "Código TUSS deve conter exatamente 8 dígitos numéricos (ANS RN 501/2022 — Padrão TISS)." };
  }
  return { ok: true };
}

/** Lista oficial de Portes CBHPM 2020 (AMB). Agrupados por complexidade técnica. */
export const PORTES_CBHPM: { value: string; label: string; descricao: string }[] = [
  { value: "-", label: "—", descricao: "Sem porte definido" },
  { value: "1A", label: "1A", descricao: "Muito simples (ex.: Glicemia, Ureia)" },
  { value: "1B", label: "1B", descricao: "Simples (ex.: Colesterol, Triglicerídeos)" },
  { value: "1C", label: "1C", descricao: "Baixa complexidade (ex.: Hemograma)" },
  { value: "2A", label: "2A", descricao: "Média complexidade (ex.: TSH, PSA)" },
  { value: "2B", label: "2B", descricao: "Média-alta complexidade" },
  { value: "2C", label: "2C", descricao: "Complexidade crescente" },
  { value: "3A", label: "3A", descricao: "Alta complexidade laboratorial" },
  { value: "3B", label: "3B", descricao: "Alta complexidade" },
  { value: "3C", label: "3C", descricao: "Alta complexidade" },
  { value: "4A", label: "4A", descricao: "Procedimento especializado" },
  { value: "4B", label: "4B", descricao: "Procedimento especializado" },
  { value: "4C", label: "4C", descricao: "Procedimento especializado" },
  { value: "5A", label: "5A", descricao: "Especializado avançado" },
  { value: "5B", label: "5B", descricao: "Especializado avançado" },
  { value: "5C", label: "5C", descricao: "Especializado avançado" },
  { value: "6A", label: "6A", descricao: "Procedimento de grande porte" },
  { value: "6B", label: "6B", descricao: "Procedimento de grande porte" },
  { value: "6C", label: "6C", descricao: "Procedimento de grande porte" },
  { value: "7A", label: "7A", descricao: "Muito alta complexidade" },
  { value: "7B", label: "7B", descricao: "Muito alta complexidade" },
  { value: "7C", label: "7C", descricao: "Muito alta complexidade" },
  { value: "8A", label: "8A", descricao: "Excepcional complexidade" },
  { value: "8B", label: "8B", descricao: "Excepcional complexidade" },
  { value: "8C", label: "8C", descricao: "Excepcional complexidade" },
  { value: "9A", label: "9A", descricao: "Excepcional complexidade" },
  { value: "9B", label: "9B", descricao: "Excepcional complexidade" },
  { value: "9C", label: "9C", descricao: "Excepcional complexidade" },
  { value: "10A", label: "10A", descricao: "Procedimento de altíssima complexidade" },
  { value: "10B", label: "10B", descricao: "Procedimento de altíssima complexidade" },
  { value: "10C", label: "10C", descricao: "Procedimento de altíssima complexidade" },
  { value: "11A", label: "11A", descricao: "Procedimento de altíssima complexidade" },
  { value: "11B", label: "11B", descricao: "Procedimento de altíssima complexidade" },
  { value: "11C", label: "11C", descricao: "Procedimento de altíssima complexidade" },
  { value: "12A", label: "12A", descricao: "Procedimento de altíssima complexidade" },
  { value: "12B", label: "12B", descricao: "Procedimento de altíssima complexidade" },
  { value: "12C", label: "12C", descricao: "Procedimento de altíssima complexidade" },
  { value: "13A", label: "13A", descricao: "Procedimento de máxima complexidade" },
  { value: "13B", label: "13B", descricao: "Procedimento de máxima complexidade" },
  { value: "13C", label: "13C", descricao: "Procedimento de máxima complexidade" },
];

