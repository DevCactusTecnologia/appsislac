// Contexto interno do módulo Financeiro (Fase 4 — Passos 3-5).
// Expõe estados/filtros/derivados/handlers para os Tabs sem props drilling.
//
// Comportamento idêntico — apenas reorganização. Nenhum hook novo aqui;
// o provider apenas recebe o `value` montado no orquestrador.
import { createContext, useContext, type ReactNode } from "react";
import type { FinanceiroEntry, AReceberRow, AReceberConvenioRow, CaixaLinhaComSaldo } from "./types";
import type { PainelKpis } from "./services/computePainelKpis";

type CategoriaDicionario = "tipo_despesa" | "destino_pagamento" | "forma_pagamento";

export interface FinanceiroContextValue {
  // Painel (Fase 3 V2)
  painelKpis: PainelKpis;

  // Tabs / navegação
  activeTab: string;
  setActiveTab: (t: any) => void;
  currentPage: number;
  setCurrentPage: (updater: number | ((p: number) => number)) => void;
  itemsPerPage: number;

  // Busca / filtros
  searchQuery: string;
  setSearchQuery: (s: string) => void;
  convenioFilter: string;
  setConvenioFilter: (v: string) => void;
  tipoDespesaFilter: string;
  setTipoDespesaFilter: (v: string) => void;
  destinoPagamentoFilter: string;
  setDestinoPagamentoFilter: (v: string) => void;
  saidaStatusFilter: string;
  setSaidaStatusFilter: (v: any) => void;
  conveniosDisponiveis: string[];

  // Dicionários + handlers
  tiposDespesa: string[];
  destinosPagamento: string[];
  formasPagamento: string[];
  deletableTipos: string[];
  deletableDestinos: string[];
  deletableFormas: string[];
  openCriar: (cat: CategoriaDicionario, initialValue: string, onSuccess?: (nome: string) => void) => void;
  handleDeleteItem: (cat: CategoriaDicionario, nome: string) => Promise<void>;

  // Dados/derivados das abas
  entradaCounts: any;
  aReceberCounts: any;
  saidaCounts: any;
  paginatedData: FinanceiroEntry[];
  filteredLength: number;
  totalPages: number;
  saidasSelecionadas: Set<string>;
  setSaidasSelecionadas: React.Dispatch<React.SetStateAction<Set<string>>>;

  // Handlers de ação (entradas/saidas table)
  handleEditClick: (entry: FinanceiroEntry) => void;
  handleDeleteClick: (protocolo: string) => void;
  handleDetailClick: (entry: FinanceiroEntry) => void;

  // Dialog: nova entrada/saída
  setDialogOpen: (open: boolean) => void;
  setDialogTipo: (t: "entrada" | "saida") => void;

  // Drill-down de fatura (Entradas)
  setFaturaDetalheAlvo: (v: any) => void;
  setFaturaDetalheOpen: (open: boolean) => void;

  // A Receber (handler usado por sub-tab pacientes)
  // A Receber
  aReceberStatusFilter: string;
  setAReceberStatusFilter: (v: any) => void;
  aReceberSubTab: "pacientes" | "convenios";
  setAReceberSubTab: (v: "pacientes" | "convenios") => void;
  aReceberSource: AReceberRow[];
  aReceberConvenioRows: AReceberConvenioRow[];
  aReceberPaginated: AReceberRow[];
  aReceberFilteredLength: number;
  aReceberTotalPages: number;
  handleAReceberPagar: (row: AReceberRow) => void;
  setFecharFaturaAlvo: (v: { convenioId: number; convenioNome: string } | null) => void;
  setFecharFaturaOpen: (open: boolean) => void;

  // Caixa (Fase 4 — Passo 5)
  dateFrom: Date | undefined;
  caixaTotais: { totalEntradas: number; totalSaidas: number; saldoFinal: number };
  caixaSaldoInicial: number;
  caixaPaginated: CaixaLinhaComSaldo[];
  caixaLinhasComSaldo: CaixaLinhaComSaldo[];
  caixaTotalPages: number;
  imprimirLivroCaixa: () => void;
}

const FinanceiroCtx = createContext<FinanceiroContextValue | null>(null);

export function FinanceiroProvider({
  value,
  children,
}: {
  value: FinanceiroContextValue;
  children: ReactNode;
}) {
  return <FinanceiroCtx.Provider value={value}>{children}</FinanceiroCtx.Provider>;
}

export function useFinanceiroContext(): FinanceiroContextValue {
  const ctx = useContext(FinanceiroCtx);
  if (!ctx) {
    throw new Error("useFinanceiroContext: provider ausente. Envolva a árvore em <FinanceiroProvider>.");
  }
  return ctx;
}
