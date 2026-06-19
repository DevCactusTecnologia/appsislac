// Helpers puros extraídos de Financeiro.tsx (Sprint 1 — slicing estrutural).
import type { FinanceiroSaida, FinanceiroEntradaView } from "@/data/financeiroStore";
import type { FinanceiroEntry } from "./types";

export function saidaToEntry(s: FinanceiroSaida): FinanceiroEntry {
  return {
    protocolo: s.protocolo,
    data: s.data,
    cliente: s.cliente,
    valorTotal: s.valorTotal,
    pagamento: s.pagamento,
    tipo: "saida",
    tipoDespesa: s.tipoDespesa,
    destinoPagamento: s.destinoPagamento,
    descricao: s.descricao,
    dataVencimento: s.dataVencimento,
    foiPago: s.foiPago,
    dataPagamento: s.dataPagamento,
    statusSaida: s.status,
    saidaId: s.id ?? null,
  };
}

export function entradaViewToEntry(e: FinanceiroEntradaView): FinanceiroEntry {
  return {
    protocolo: e.protocolo,
    data: e.data,
    cliente: e.cliente,
    valorTotal: e.valorTotal,
    pagamento: e.pagamento,
    tipo: "entrada",
    convenio: e.convenio,
    statusPagamento: e.statusPagamento,
    origem: e.origem,
    faturaId: e.faturaId,
    pagamentoId: e.pagamentoId,
  };
}

export const parseDate = (s: string): Date | null => {
  if (!s) return null;
  // Aceita "dd/mm/yyyy" ou "dd/mm/yyyy HH:mm:ss"
  const datePart = s.split(" ")[0];
  const parts = datePart.split("/");
  if (parts.length !== 3) return null;
  return new Date(+parts[2], +parts[1] - 1, +parts[0]);
};

// Máscara dd/mm/aaaa
export const maskDateBR = (raw: string): string => {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

// Valida formato + data real (dd/mm/aaaa). Vazio é permitido (opcional).
export const isValidDateBR = (s: string): boolean => {
  if (!s) return true;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) return false;
  const d = parseInt(m[1], 10), mo = parseInt(m[2], 10), y = parseInt(m[3], 10);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return false;
  const dt = new Date(y, mo - 1, d);
  return dt.getDate() === d && dt.getMonth() === mo - 1 && dt.getFullYear() === y;
};
