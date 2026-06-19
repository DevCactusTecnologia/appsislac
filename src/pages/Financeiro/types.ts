// Tipos extraídos de Financeiro.tsx (Sprint 1 — slicing estrutural).
import type { LucideIcon } from "lucide-react";
import {
  ArrowDownCircle, ArrowUpCircle, BookOpen, Banknote, CreditCard, QrCode, Clock, LayoutDashboard, Building2,
} from "lucide-react";
import type { MockAtendimento } from "@/data/types";

export type TabType = "painel" | "entrada" | "a_receber" | "convenios" | "saida" | "caixa" | "integracoes";

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
  /** Fase 6 V2 — status oficial da saída ("aberta" | "paga" | "cancelada"). */
  statusSaida?: "aberta" | "paga" | "cancelada";
}

// ── Tipos do dataflow "A Receber" e "Caixa" (Fase 3 — Architectural Split) ──
// Antes declarados inline dentro de Financeiro.tsx. Movidos para cá apenas
// para permitir que o FinanceiroService consuma/retorne com tipagem forte.
// Semântica preservada literalmente.

export type AReceberRow = {
  protocolo: string;
  data: string;
  cliente: string;        // Paciente (sub-aba pacientes) ou "Convênio\nPaciente" agregado
  convenio: string;
  valorTotal: number;
  valorPago: number;
  saldo: number;
  status: "parcial" | "pendente";
  atendimento: MockAtendimento;
};

export type AReceberConvenioRow = {
  convenioId: number;
  convenioNome: string;
  saldo: number;
  qtdExames: number;
  qtdPacientes: number;
  /** Data do atendimento mais antigo com exame em aberto (Fase 5 V2). */
  desde: string | null;
};

export type CaixaMov = {
  data: string;             // dd/mm/yyyy
  dataObj: Date;
  tipo: "entrada" | "saida";
  protocolo: string;
  descricao: string;
  categoria: string;        // convênio (entrada) ou tipoDespesa (saída)
  pagamento: string;
  valor: number;            // sempre positivo
};

export type CaixaLinhaComSaldo = CaixaMov & { saldoAcumulado: number };

export const baseTabs: { key: TabType; label: string; icon: LucideIcon }[] = [
  { key: "painel", label: "Painel", icon: LayoutDashboard },
  { key: "entrada", label: "Recebimentos", icon: ArrowDownCircle },
  { key: "a_receber", label: "A Receber", icon: Clock },
  { key: "convenios", label: "Convênios", icon: Building2 },
  { key: "saida", label: "Saídas", icon: ArrowUpCircle },
  { key: "caixa", label: "Caixa", icon: BookOpen },
];

export const paymentIcons: Record<string, LucideIcon> = {
  Dinheiro: Banknote,
  Crédito: CreditCard,
  Débito: CreditCard,
  PIX: QrCode,
};
