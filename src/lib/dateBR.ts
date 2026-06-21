// SSOT — formatação de datas no padrão brasileiro.
//
// Centraliza as 3 variantes que existiam dispersas em vários stores:
//   - formatDateBR(iso)      → "dd/mm/yyyy" (DATA pura, sem hora, sem drift UTC)
//   - formatDateTimeBR(iso)  → "dd/mm/yyyy HH:mm:ss" (com hora local)
//   - formatNowBR(d?)        → "dd/mm/yyyy HH:mm" (carimbo de impressão)
//
// IMPORTANTE: `formatDateBR` extrai os componentes Y-M-D diretamente do prefixo
// ISO. NUNCA converte para timezone local — datas de calendário (data do
// pagamento, nascimento, lançamento) NÃO podem deslizar ±1 dia por timezone.

const pad2 = (n: number): string => String(n).padStart(2, "0");

/**
 * Formata uma data (calendar date) no padrão "dd/mm/yyyy".
 * Aceita ISO completo ("2026-06-21T03:48:00Z") ou apenas "2026-06-21".
 * Sem conversão de timezone — preserva o dia literal do ISO.
 */
export function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  // Fallback (formato inesperado)
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * Formata um timestamp no padrão "dd/mm/yyyy HH:mm:ss" usando o timezone local
 * do navegador. Use SOMENTE para timestamps reais de eventos (created_at,
 * updated_at) — nunca para datas de calendário.
 */
export function formatDateTimeBR(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ` +
         `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/**
 * Carimbo "dd/mm/yyyy HH:mm" para impressão (cabeçalho de relatórios, mapa,
 * etiquetas). Sem segundos. Default: agora.
 */
export function formatNowBR(d: Date = new Date()): string {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ` +
         `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
