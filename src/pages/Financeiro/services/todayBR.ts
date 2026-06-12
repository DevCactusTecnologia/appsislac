// Helper puro: data de hoje em formato dd/mm/yyyy (timezone local).
// Extraído de Financeiro.tsx (Fase 3 — usado em handlePagarFromDetail e
// marcarSaidasComoPagas). Comportamento idêntico ao inline anterior.
export function todayBR(now: Date = new Date()): string {
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
