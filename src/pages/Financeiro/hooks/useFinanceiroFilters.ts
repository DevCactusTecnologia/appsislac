// Estado de filtros e UI consolidado em um hook (Fase 4 — passo 2).
// Extraído de Financeiro.tsx — apenas colocação de useState.
// Zero mudança de comportamento. Setters retornados são os originais.
import { useState } from "react";
import type { TabType, SaidaStatusFilter } from "../types";

export type PeriodoRapido = "hoje" | "7d" | "mes" | "30d" | "ano" | "tudo" | "custom";
export type AReceberStatusFilter = "todas" | "parciais" | "pendentes";
export type AReceberSubTab = "pacientes" | "convenios";

export function useFinanceiroFilters() {
  const [activeTab, setActiveTab] = useState<TabType>("painel");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [periodoRapido, setPeriodoRapido] = useState<PeriodoRapido>("tudo");
  const [convenioFilter, setConvenioFilter] = useState<string>("all");
  const [tipoDespesaFilter, setTipoDespesaFilter] = useState<string>("all");
  const [destinoPagamentoFilter, setDestinoPagamentoFilter] = useState<string>("all");
  const [saidaStatusFilter, setSaidaStatusFilter] = useState<SaidaStatusFilter>("todas");
  const [aReceberStatusFilter, setAReceberStatusFilter] = useState<AReceberStatusFilter>("todas");
  const [aReceberSubTab, setAReceberSubTab] = useState<AReceberSubTab>("pacientes");

  return {
    activeTab, setActiveTab,
    searchQuery, setSearchQuery,
    currentPage, setCurrentPage,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    periodoRapido, setPeriodoRapido,
    convenioFilter, setConvenioFilter,
    tipoDespesaFilter, setTipoDespesaFilter,
    destinoPagamentoFilter, setDestinoPagamentoFilter,
    saidaStatusFilter, setSaidaStatusFilter,
    aReceberStatusFilter, setAReceberStatusFilter,
    aReceberSubTab, setAReceberSubTab,
  };
}

export type FinanceiroFiltersState = ReturnType<typeof useFinanceiroFilters>;
