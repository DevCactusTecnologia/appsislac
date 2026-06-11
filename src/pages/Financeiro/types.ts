// Tipos extraídos de Financeiro.tsx (Sprint 1 — slicing estrutural).
import type { LucideIcon } from "lucide-react";
import {
  ArrowDownCircle, ArrowUpCircle, BookOpen, Banknote, CreditCard, QrCode, Clock,
} from "lucide-react";

export type TabType = "entrada" | "a_receber" | "saida" | "caixa" | "integracoes";

export type SaidaStatusFilter = "todas" | "vencidas" | "vencendo7" | "pagas";

export interface FinanceiroEntry {
  protocolo: string;
  data: string;
  cliente: string;
  valorTotal: number;
  pagamento: string;
  tipo: TabType;
  convenio?: string;
  tipoDespesa?: string;
  destinoPagamento?: string;
  descricao?: string;
  dataVencimento?: string;
  foiPago?: string;
  dataPagamento?: string;
  statusPagamento?: string;
  /** "pagamento" (avulso) | "fatura_convenio" (entrada agregada de fatura). */
  origem?: "pagamento" | "fatura_convenio";
  faturaId?: number | null;
}

export const baseTabs: { key: TabType; label: string; icon: LucideIcon }[] = [
  { key: "entrada", label: "Entradas", icon: ArrowDownCircle },
  { key: "a_receber", label: "A Receber", icon: Clock },
  { key: "saida", label: "Saídas", icon: ArrowUpCircle },
  { key: "caixa", label: "Caixa", icon: BookOpen },
];

export const paymentIcons: Record<string, LucideIcon> = {
  Dinheiro: Banknote,
  Crédito: CreditCard,
  Débito: CreditCard,
  PIX: QrCode,
};
