import { useState, useMemo, useEffect, useRef, lazy, Suspense } from "react";
import {
  Search, Plus, Printer, FileText,
  Banknote, CreditCard, QrCode, Building2, CircleDollarSign,
  ArrowDownCircle, ArrowUpCircle, BookOpen, Calendar as CalendarIcon,
  Filter, ChevronLeft, ChevronRight, ChevronDown, Pencil, Trash2, X, Eye,
  AlertOctagon, Clock, CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn, fmtBRL, searchNormalize } from "@/lib/utils";
import { printHtmlInHiddenFrame } from "@/lib/printHtml";
import { getAtendimentos, subscribe as subscribeAtendimentos, updateAtendimento } from "@/data/atendimentoStore";

import type { MockAtendimento, ExameCobrancaInfo } from "@/data/types";
import { getConvenios } from "@/data/convenioStore";
import {
  getSaidas, subscribeFinanceiro, removeSaida, updateSaida,
  fetchEntradasView, type FinanceiroSaida, type FinanceiroEntradaView,
} from "@/data/financeiroStore";
import {
  createItem, deleteItem,
  type ListaItem,
} from "@/data/financeiroListasStore";
import { useDicionario } from "@/hooks/useDicionario";
import { useQueryClient } from "@tanstack/react-query";
// Dialogs lazy-loaded — cada um vira chunk separado e só baixa quando abre.
const CriarItemDialog = lazy(() => import("@/components/financeiro/CriarItemDialog"));
const FecharFaturaDialog = lazy(() => import("@/components/financeiro/FecharFaturaDialog"));
const FaturaDetalheDialog = lazy(() => import("@/components/financeiro/FaturaDetalheDialog"));
import { useEnsureStore } from "@/hooks/useEnsureStore";
// fetchSaldoEmAbertoPorConvenio removido (Fase 1 V2 — substituído por useAReceberConvenios)
import { useFeatureFlag } from "@/lib/featureFlags";
import { useAReceberPacientes, useFinanceiroResumo, useAReceberConvenios } from "@/hooks/useAReceberPacientes";
import { toast } from "@/hooks/use-toast";
import type { NovaEntradaSaidaData } from "@/components/NovaEntradaSaidaDialog";
const NovaEntradaSaidaDialog = lazy(() => import("@/components/NovaEntradaSaidaDialog"));
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import SearchableSelect from "@/components/financeiro/SearchableSelect";
import { CheckCircle, Wallet, Receipt, Plug } from "lucide-react";

import IntegracoesWebhookPanel from "@/components/financeiro/IntegracoesWebhookPanel";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/shared/PageHeader";

// Types, helpers e service puros extraídos para ./Financeiro/* (Architectural Split).
// Comportamento idêntico, apenas reorganização.
import type {
  TabType, SaidaStatusFilter, FinanceiroEntry,
  AReceberRow, AReceberConvenioRow, CaixaMov,
} from "./Financeiro/types";
import { baseTabs, paymentIcons } from "./Financeiro/types";
import {
  saidaToEntry,
  parseDate,
  maskDateBR,
  isValidDateBR,
} from "./Financeiro/helpers";
import {
  buildAReceberRowsFromAtendimentos,
  buildAReceberRowsFromRpc,
  buildAReceberConvenioRows,
  filterAReceberRows,
  applyFinanceiroFilters,
  computeEntradaCounts,
  computeAReceberCounts,
  computeSaidaCounts,
  buildCaixaMovimentos,
  filterCaixaMovimentos,
  computeCaixaSaldoInicial,
  applyCaixaSaldoAcumulado,
  computeCaixaTotais,
  buildLivroCaixaHtml,
  buildDetalhadoHtml,
} from "./Financeiro/services/FinanceiroService";
import { validateSaidaEdit } from "./Financeiro/services/validateSaidaEdit";
import { computeDetailExames } from "./Financeiro/services/computeDetailExames";
import { filterEntradasPagas } from "./Financeiro/services/filterEntradasPagas";
import { computeFinanceiroSummary } from "./Financeiro/services/computeFinanceiroSummary";
import { validatePayment } from "./Financeiro/services/validatePayment";
import { computeDetailTotals } from "./Financeiro/services/computeDetailTotals";
import { todayBR } from "./Financeiro/services/todayBR";
import CaixaTab from "./Financeiro/components/CaixaTab";
import EntradasTab from "./Financeiro/components/EntradasTab";
import SaidasTab from "./Financeiro/components/SaidasTab";
import AReceberTab from "./Financeiro/components/AReceberTab";
import { FinanceiroProvider, type FinanceiroContextValue } from "./Financeiro/FinanceiroContext";
import { computePeriodoRange } from "./Financeiro/services/periodoRapido";
import EditEntryDialog from "./Financeiro/components/dialogs/EditEntryDialog";
import DeleteEntryDialog from "./Financeiro/components/dialogs/DeleteEntryDialog";
import DetailEntryDialog from "./Financeiro/components/dialogs/DetailEntryDialog";
import PagarDespesaDialog from "./Financeiro/components/dialogs/PagarDespesaDialog";
import type { DictionaryHandlers } from "./Financeiro/components/dialogs/types";
import { useFinanceiroFilters } from "./Financeiro/hooks/useFinanceiroFilters";
import { useFinanceiroDialogs } from "./Financeiro/hooks/useFinanceiroDialogs";






const Financeiro = () => {
  // Lazy-load dos stores financeiros (Fase F): hidrata on-demand ao entrar na rota.
  useEnsureStore(["financeiro", "financeiroListas"]);
  const { hasPermission } = useAuth();
  const canSeeIntegracoes =
    hasPermission("gestao_financeira") || hasPermission("visualizar_financeiro");
  const tabs = useMemo(() => {
    return canSeeIntegracoes
      ? [...baseTabs, { key: "integracoes" as TabType, label: "Integrações", icon: Plug }]
      : baseTabs;
  }, [canSeeIntegracoes]);
  // Filtros e UI consolidados em hook (Fase 4 — passo 2).
  const filters = useFinanceiroFilters();
  const {
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
  } = filters;
  void filters;

  // Estado dos diálogos consolidado em hook (Fase 4 — passo 2).
  const dialogs = useFinanceiroDialogs();
  const {
    editDialogOpen, setEditDialogOpen,
    editingEntry, setEditingEntry,
    deleteDialogOpen, setDeleteDialogOpen,
    deletingProtocolo, setDeletingProtocolo,
    detailDialogOpen, setDetailDialogOpen,
    detailEntry, setDetailEntry,
    payDialogOpen, setPayDialogOpen,
    payTarget, setPayTarget,
    payForma, setPayForma,
    payData, setPayData,
    receberDialogOpen, setReceberDialogOpen,
    receberInitial, setReceberInitial,
    dialogOpen, setDialogOpen,
    dialogTipo, setDialogTipo,
    fecharFaturaOpen, setFecharFaturaOpen,
    fecharFaturaAlvo, setFecharFaturaAlvo,
    faturaDetalheOpen, setFaturaDetalheOpen,
    faturaDetalheAlvo, setFaturaDetalheAlvo,
    criarOpen, setCriarOpen,
    criarCategoria, setCriarCategoria,
    criarInitialValue, setCriarInitialValue,
    criarOnSuccess, setCriarOnSuccess,
    saidasSelecionadas, setSaidasSelecionadas,
  } = dialogs;
  void dialogs;

  // Estados ligados a effects (permanecem no orquestrador).
  const [saidasList, setSaidasList] = useState<FinanceiroEntry[]>(() => getSaidas().map(saidaToEntry));
  const [entradasView, setEntradasView] = useState<FinanceiroEntradaView[]>([]);
  const [saldoConvenios, setSaldoConvenios] = useState<Map<number, { saldo: number; exames: number; pacientes: Set<string> }>>(new Map());

  

  // (receberDialogOpen/receberInitial agora vêm de useFinanceiroDialogs)


  
  const itemsPerPage = 8;

  // Listas dinâmicas: leitura unificada via `select_options` (useDicionario).
  // Escrita continua nas tabelas legadas (financeiro_*) — triggers mantêm sync.
  const queryClient = useQueryClient();
  const { data: tiposDic = [] } = useDicionario("financeiro_tipo_despesa", { ativosOnly: true });
  const { data: destinosDic = [] } = useDicionario("financeiro_destino_pagamento", { ativosOnly: true });
  const { data: formasDic = [] } = useDicionario("financeiro_forma_pagamento", { ativosOnly: true });

  const toListaItem = (o: { id: string; legacyId: string | null; label: string; sistema: boolean; ativo: boolean; ordem: number }): ListaItem => ({
    id: o.legacyId ?? o.id,
    nome: o.label,
    sistema: o.sistema,
    ativo: o.ativo,
    ordem: o.ordem,
  });

  const tiposItems = useMemo<ListaItem[]>(() => tiposDic.map(toListaItem), [tiposDic]);
  const destinosItems = useMemo<ListaItem[]>(() => destinosDic.map(toListaItem), [destinosDic]);
  const formasItems = useMemo<ListaItem[]>(() => formasDic.map(toListaItem), [formasDic]);

  // Derivações usadas pelos dropdowns e dialogs
  const tiposDespesa = useMemo(() => tiposItems.map(i => i.nome), [tiposItems]);
  const destinosPagamento = useMemo(() => destinosItems.map(i => i.nome), [destinosItems]);
  const formasPagamento = useMemo(() => formasItems.map(i => i.nome), [formasItems]);
  const deletableTipos = useMemo(() => tiposItems.filter(i => !i.sistema).map(i => i.nome), [tiposItems]);
  const deletableDestinos = useMemo(() => destinosItems.filter(i => !i.sistema).map(i => i.nome), [destinosItems]);
  const deletableFormas = useMemo(() => formasItems.filter(i => !i.sistema).map(i => i.nome), [formasItems]);

  // (criar* agora vêm de useFinanceiroDialogs)


  const invalidateDicionarios = () => {
    queryClient.invalidateQueries({ queryKey: ["tenant"], predicate: (q) => {
      const k = q.queryKey as unknown[];
      return k.includes("dicionario") && (
        k.includes("financeiro_tipo_despesa") ||
        k.includes("financeiro_destino_pagamento") ||
        k.includes("financeiro_forma_pagamento")
      );
    }});
  };

  const normalizeNome = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  const nomeJaExisteLocal = (
    cat: "tipo_despesa" | "destino_pagamento" | "forma_pagamento",
    nome: string,
  ): boolean => {
    const list = cat === "tipo_despesa" ? tiposItems : cat === "destino_pagamento" ? destinosItems : formasItems;
    const n = normalizeNome(nome);
    return list.some((i) => normalizeNome(i.nome) === n);
  };

  // Subscribe ao financeiroStore para refletir adições/atualizações de saídas
  useEffect(() => {
    const unsub = subscribeFinanceiro(() => {
      setSaidasList(getSaidas().map(saidaToEntry));
    });
    return unsub;
  }, []);

  // Abre o mini modal de criação para a categoria informada.
  const openCriar = (
    cat: "tipo_despesa" | "destino_pagamento" | "forma_pagamento",
    initialValue: string,
    onSuccess?: (nome: string) => void,
  ) => {
    setCriarCategoria(cat);
    setCriarInitialValue(initialValue);
    setCriarOnSuccess(() => onSuccess ?? null);
    setCriarOpen(true);
  };

  const handleDeleteItem = async (cat: "tipo_despesa" | "destino_pagamento" | "forma_pagamento", nome: string) => {
    const list = cat === "tipo_despesa" ? tiposItems : cat === "destino_pagamento" ? destinosItems : formasItems;
    const item = list.find(i => i.nome === nome);
    if (!item) return;
    try {
      await deleteItem(cat, item.id);
      invalidateDicionarios();
      // Limpa filtros que apontavam para o item removido
      if (cat === "tipo_despesa" && tipoDespesaFilter === nome) setTipoDespesaFilter("all");
      if (cat === "destino_pagamento" && destinoPagamentoFilter === nome) setDestinoPagamentoFilter("all");
      toast({ title: `"${nome}" removido` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao remover";
      toast({ title: msg, variant: "destructive" });
    }
  };

  // Carrega entradas a partir da view financeiro_entradas
  const refreshEntradas = async () => {
    const rows = await fetchEntradasView();
    setEntradasView(rows);
  };
  useEffect(() => {
    void refreshEntradas();
  }, []);

  // Recarrega entradas quando o atendimentoStore mudar (cancelamento, edição de pagamentos, etc.)
  useEffect(() => {
    const unsub = subscribeAtendimentos(() => {
      void refreshEntradas();
    });
    return unsub;
  }, []);

  // Realtime de atendimentos/pagamentos é centralizado no atendimentoStore
  // (canal único "atendimentos-store"). O subscribeAtendimentos acima já é
  // disparado quando esses payloads chegam — não precisamos abrir um segundo
  // WebSocket subscription aqui (Fase G — eliminação de canais duplicados).

  // Entradas vêm exclusivamente da view financeiro_entradas (read-only, derivada de atendimento_pagamentos).
  // Regime de caixa: a aba Entradas exibe APENAS pagamentos efetivamente recebidos.
  // Pendências/parciais são gerenciadas na aba "A Receber".
  const entradas: FinanceiroEntry[] = useMemo(
    () => filterEntradasPagas(entradasView),
    [entradasView],
  );

  const saidas = useMemo(() => [...saidasList].sort((a, b) => b.data.localeCompare(a.data)), [saidasList]);

  // ─── A Receber — SSOT V2 (Fase 1) ────────────────────────────────────
  // Pacientes e Convênios consomem a mesma RPC `financeiro_a_receber_v2`.
  // Caminho legacy (cálculo client-side via getAtendimentos / fetchSaldoEm…)
  // foi removido para eliminar duplicidade. Ver docs/financeiro/ssot.md.
  const ffPaginated = useFeatureFlag("paginated_atendimentos");
  const ffLegacy = useFeatureFlag("USE_LEGACY_STORE");
  const useRpc = true; // SSOT V2: sempre RPC para A Receber
  const aReceberStatusRpc: "parcial" | "pendente" | null =
    aReceberStatusFilter === "parciais" ? "parcial"
    : aReceberStatusFilter === "pendentes" ? "pendente"
    : null;
  const {
    rows:    rpcRows,
    loading: rpcLoading,
    hasMore: rpcHasMore,
    loadMore: rpcLoadMore,
    refresh: rpcRefresh,
  } = useAReceberPacientes(activeTab === "a_receber", {
    search: searchQuery || undefined,
    dateFrom,
    dateTo,
    status: aReceberStatusRpc,
    pageSize: 50,
  });
  // Resumo agregado segue dependendo de `paginated_atendimentos` (não escopo da Fase 1).
  const { resumo: financeiroResumoRpc } = useFinanceiroResumo(ffPaginated && !ffLegacy, {
    dateFrom,
    dateTo,
    convenio: convenioFilter !== "all" ? convenioFilter : null,
  });

  const aReceberSource: AReceberRow[] = useMemo(() => {
    if (activeTab !== "a_receber") return [];
    return buildAReceberRowsFromRpc(rpcRows);
  }, [activeTab, rpcRows]);

  // Após mutações no atendimentoStore, refresca o RPC (não confiar em cache local).
  useEffect(() => {
    const unsub = subscribeAtendimentos(() => { rpcRefresh(); });
    return unsub;
  }, [rpcRefresh]);

  // Convênios — V2 (substitui fetchSaldoEmAbertoPorConvenio)
  const {
    rows: aReceberConvenioRowsV2,
    refresh: refreshConvenios,
  } = useAReceberConvenios(activeTab === "a_receber");
  const aReceberConvenioRows: AReceberConvenioRow[] = useMemo(
    () => aReceberConvenioRowsV2.map((r) => ({
      convenioId:    r.convenioId,
      convenioNome:  r.convenioNome,
      saldo:         Math.round(r.saldo * 100) / 100,
      qtdExames:     r.qtdExames,
      qtdPacientes:  r.qtdPacientes,
    })),
    [aReceberConvenioRowsV2],
  );


  const allEntries = useMemo(() => {
    if (activeTab === "entrada") return entradas;
    if (activeTab === "saida") return saidas;
    return [...entradas, ...saidas].sort((a, b) => b.data.localeCompare(a.data));
  }, [activeTab, entradas, saidas]);

  const filtered = useMemo(
    () => applyFinanceiroFilters(allEntries, {
      activeTab, searchQuery, dateFrom, dateTo,
      convenioFilter, tipoDespesaFilter, destinoPagamentoFilter, saidaStatusFilter,
    }),
    [allEntries, searchQuery, dateFrom, dateTo, convenioFilter, tipoDespesaFilter, destinoPagamentoFilter, saidaStatusFilter, activeTab],
  );

  // Lista de convênios disponíveis nas entradas atuais (origem dinâmica, não mock)
  const conveniosDisponiveis = useMemo(() => {
    const set = new Set<string>();
    entradas.forEach(e => { if (e.convenio) set.add(e.convenio); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [entradas]);

  // Contadores por aba (regime de caixa para Entradas; KPIs de A Receber e Saídas).
  const entradaCounts = useMemo(
    () => computeEntradaCounts(entradas, { convenioFilter, dateFrom, dateTo }),
    [entradas, convenioFilter, dateFrom, dateTo],
  );
  const aReceberCounts = useMemo(() => computeAReceberCounts(aReceberSource), [aReceberSource]);
  const saidaCounts = useMemo(() => computeSaidaCounts(saidas), [saidas]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const paginatedData = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // ─── A Receber: filtragem + paginação dedicada ───
  const aReceberFiltered = useMemo(
    () => filterAReceberRows(aReceberSource, {
      aReceberStatusFilter, convenioFilter, searchQuery, dateFrom, dateTo,
    }),
    [aReceberSource, aReceberStatusFilter, convenioFilter, searchQuery, dateFrom, dateTo],
  );



  const aReceberTotalPages = Math.max(1, Math.ceil(aReceberFiltered.length / itemsPerPage));
  const aReceberPaginated = aReceberFiltered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Handler: abrir o modal "Entrada de pagamento" pré-selecionado para o protocolo
  const handleAReceberPagar = (row: AReceberRow) => {
    setReceberInitial({ tipo: "protocolo", protocolo: row.protocolo });
    setReceberDialogOpen(true);
  };

  const summary = useMemo(
    () => computeFinanceiroSummary(activeTab, entradas, filtered),
    [filtered, entradas, activeTab],
  );

  // ─── Livro-Caixa: lançamentos cronológicos unificados (entradas + saídas pagas) ───
  // Apenas movimentos efetivamente realizados entram no caixa.
  // Saídas pendentes NÃO entram (não houve débito de caixa ainda).
  const caixaMovimentos: CaixaMov[] = useMemo(() => {
    if (activeTab !== "caixa") return [];
    return buildCaixaMovimentos(entradas, saidas);
  }, [activeTab, entradas, saidas]);

  const caixaMovFiltrados = useMemo(
    () => filterCaixaMovimentos(caixaMovimentos, { dateFrom, dateTo, searchQuery }),
    [caixaMovimentos, dateFrom, dateTo, searchQuery],
  );

  const caixaSaldoInicial = useMemo(
    () => computeCaixaSaldoInicial(caixaMovimentos, dateFrom),
    [caixaMovimentos, dateFrom],
  );

  const caixaLinhasComSaldo = useMemo(
    () => applyCaixaSaldoAcumulado(caixaMovFiltrados, caixaSaldoInicial),
    [caixaMovFiltrados, caixaSaldoInicial],
  );

  const caixaTotais = useMemo(
    () => computeCaixaTotais(caixaMovFiltrados, caixaSaldoInicial),
    [caixaMovFiltrados, caixaSaldoInicial],
  );

  const caixaTotalPages = Math.max(1, Math.ceil(caixaLinhasComSaldo.length / itemsPerPage));
  const caixaPaginated = caixaLinhasComSaldo.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const imprimirLivroCaixa = () => {
    const html = buildLivroCaixaHtml({
      linhas: caixaLinhasComSaldo,
      totais: caixaTotais,
      saldoInicial: caixaSaldoInicial,
      dateFrom,
      dateTo,
    });
    printHtmlInHiddenFrame({ html });
  };


  const handleNovaEntrada = (entry: NovaEntradaSaidaData) => {
    if (entry.tipo === "entrada") {
      // Pagamentos são persistidos em atendimento_pagamentos pelo dialog;
      // a view financeiro_entradas refletirá o novo registro.
      void refreshEntradas();
    } else {
      // Saída já é persistida pelo NovaEntradaSaidaDialog via addSaida();
      // o subscribe atualizará a saidasList automaticamente.
    }
  };

  const handleEditClick = (entry: FinanceiroEntry) => { setEditingEntry({ ...entry }); setEditDialogOpen(true); };
  const handleEditSave = () => {
    if (!editingEntry) return;
    const err = validateSaidaEdit({
      dataVencimento: editingEntry.dataVencimento ?? "",
      dataPagamento: editingEntry.dataPagamento ?? "",
      foiPago: editingEntry.foiPago,
    });
    if (err) {
      toast({ title: err.title, description: err.description, variant: "destructive" });
      return;
    }
    updateSaida(editingEntry.protocolo, {
      cliente: editingEntry.cliente,
      valorTotal: editingEntry.valorTotal,
      pagamento: editingEntry.pagamento,
      tipoDespesa: editingEntry.tipoDespesa ?? "",
      destinoPagamento: editingEntry.destinoPagamento ?? "",
      descricao: editingEntry.descricao ?? "",
      dataVencimento: editingEntry.dataVencimento ?? "",
      foiPago: editingEntry.foiPago ?? "Não",
      dataPagamento: editingEntry.dataPagamento ?? "",
    });
    setEditDialogOpen(false); setEditingEntry(null);
    toast({ title: "Saída atualizada", description: `Registro ${editingEntry.protocolo} foi atualizado com sucesso.` });
  };
  const handleDeleteClick = (protocolo: string) => { setDeletingProtocolo(protocolo); setDeleteDialogOpen(true); };
  const handleDeleteConfirm = () => {
    removeSaida(deletingProtocolo);
    setDeleteDialogOpen(false);
    toast({ title: "Saída excluída", description: `Registro ${deletingProtocolo} foi removido.` });
    setDeletingProtocolo("");
  };
  const handleDetailClick = (entry: FinanceiroEntry) => { setDetailEntry(entry); setDetailDialogOpen(true); };

  const handlePagarFromDetail = () => {
    if (!detailEntry) return;
    setPayTarget(detailEntry);
    setPayForma(detailEntry.pagamento && detailEntry.pagamento !== "—" ? detailEntry.pagamento : "PIX");
    setPayData(todayBR());
    setDetailDialogOpen(false);
    setPayDialogOpen(true);
  };

  const handleConfirmPay = () => {
    if (!payTarget) return;
    const err = validatePayment({ payData, payForma });
    if (err) {
      toast({ title: err.title, description: err.description, variant: "destructive" });
      return;
    }
    updateSaida(payTarget.protocolo, {
      foiPago: "Sim",
      dataPagamento: payData,
      pagamento: payForma,
    });
    toast({ title: "Despesa paga", description: `${payTarget.protocolo} marcada como paga.` });
    setPayDialogOpen(false);
    setPayTarget(null);
  };

  const handleEditFromDetail = () => {
    if (!detailEntry) return;
    setEditingEntry({ ...detailEntry });
    setDetailDialogOpen(false);
    setEditDialogOpen(true);
  };

  const toggleSaidaSel = (protocolo: string) => {
    setSaidasSelecionadas(prev => {
      const nv = new Set(prev);
      if (nv.has(protocolo)) nv.delete(protocolo); else nv.add(protocolo);
      return nv;
    });
  };

  const togglePageSelectAll = () => {
    const pageProtocolos = paginatedData
      .filter(e => e.tipo === "saida" && e.foiPago !== "Sim")
      .map(e => e.protocolo);
    const allSelected = pageProtocolos.length > 0 && pageProtocolos.every(p => saidasSelecionadas.has(p));
    setSaidasSelecionadas(prev => {
      const nv = new Set(prev);
      if (allSelected) pageProtocolos.forEach(p => nv.delete(p));
      else pageProtocolos.forEach(p => nv.add(p));
      return nv;
    });
  };

  const marcarSaidasComoPagas = () => {
    const dataHoje = todayBR();
    const protocolos = Array.from(saidasSelecionadas);
    protocolos.forEach(p => {
      const s = saidasList.find(x => x.protocolo === p);
      if (s && s.foiPago !== "Sim") {
        updateSaida(p, { foiPago: "Sim", dataPagamento: dataHoje });
      }
    });
    toast({ title: `${protocolos.length} conta(s) marcada(s) como paga(s)` });
    setSaidasSelecionadas(new Set());
  };

  const detailAtendimento = useMemo(() => {
    if (!detailEntry) return null;
    if (detailEntry.protocolo.startsWith("CONV-") || detailEntry.protocolo.startsWith("ENT-") || detailEntry.protocolo.startsWith("SAI-")) return null;
    return getAtendimentos().find(a => a.protocolo === detailEntry.protocolo) ?? null;
  }, [detailEntry]);

  const detailExames = useMemo(
    () => computeDetailExames(detailAtendimento),
    [detailAtendimento],
  );

  const { totalExames: detailTotalExames, totalPago: detailTotalPago, saldo: detailSaldo } =
    computeDetailTotals(detailExames, detailAtendimento);

  /* ─── Render helpers ─── */

  const hasActiveFilters = convenioFilter !== "all" || tipoDespesaFilter !== "all" || destinoPagamentoFilter !== "all" || !!dateFrom || !!dateTo;

  // Aplica intervalo de período rápido (lógica pura em services/periodoRapido.ts)
  const aplicarPeriodoRapido = (p: typeof periodoRapido) => {
    setPeriodoRapido(p);
    if (p !== "custom") {
      const { dateFrom: df, dateTo: dt } = computePeriodoRange(p);
      setDateFrom(df);
      setDateTo(dt);
    }
    setCurrentPage(1);
  };

  // Impressão detalhada respeitando filtros ativos
  const dictHandlers: DictionaryHandlers = {
    tiposDespesa, destinosPagamento, formasPagamento,
    deletableTipos, deletableDestinos, deletableFormas,
    openCriar, handleDeleteItem,
  };

  // Impressão detalhada respeitando filtros ativos
  const imprimirDetalhado = () => {

    const html = buildDetalhadoHtml({
      activeTab,
      filtered,
      dateFrom,
      dateTo,
      convenioFilter,
      tipoDespesaFilter,
      destinoPagamentoFilter,
      saidaStatusFilter,
      searchQuery,
    });
    printHtmlInHiddenFrame({ html });
  };


  // ─── Valor único do contexto consumido pelos Tabs (Fase 4 — Passo 3). ───
  const ctxValue: FinanceiroContextValue = {
    activeTab, setActiveTab,
    currentPage, setCurrentPage, itemsPerPage,
    searchQuery, setSearchQuery,
    convenioFilter, setConvenioFilter,
    tipoDespesaFilter, setTipoDespesaFilter,
    destinoPagamentoFilter, setDestinoPagamentoFilter,
    saidaStatusFilter, setSaidaStatusFilter,
    conveniosDisponiveis,
    tiposDespesa, destinosPagamento, formasPagamento,
    deletableTipos, deletableDestinos, deletableFormas,
    openCriar, handleDeleteItem,
    entradaCounts, aReceberCounts, saidaCounts,
    paginatedData,
    filteredLength: filtered.length,
    totalPages,
    saidasSelecionadas, setSaidasSelecionadas,
    handleEditClick, handleDeleteClick, handleDetailClick,
    setDialogOpen, setDialogTipo,
    setFaturaDetalheAlvo, setFaturaDetalheOpen,
    handleAReceberPagar,
    aReceberStatusFilter, setAReceberStatusFilter,
    aReceberSubTab, setAReceberSubTab,
    aReceberSource,
    aReceberConvenioRows,
    aReceberPaginated,
    aReceberFilteredLength: aReceberFiltered.length,
    aReceberTotalPages,
    setFecharFaturaAlvo, setFecharFaturaOpen,
    dateFrom,
    caixaTotais, caixaSaldoInicial, caixaPaginated, caixaLinhasComSaldo, caixaTotalPages,
    imprimirLivroCaixa,
  };

  return (
    <FinanceiroProvider value={ctxValue}>
    <div className="p-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto space-y-6">
      {/* ─── Header (design system unificado SA) ─── */}
      <PageHeader
        eyebrow="Financeiro"
        title="Financeiro"
        description="Controle de entradas, saídas e livro caixa."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={periodoRapido} onValueChange={(v) => aplicarPeriodoRapido(v as typeof periodoRapido)}>
              <SelectTrigger className="h-9 rounded-xl text-xs gap-1.5 w-auto min-w-[130px]">
                <CalendarIcon className="h-3.5 w-3.5" />
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tudo">Todos os períodos</SelectItem>
                <SelectItem value="hoje">Hoje</SelectItem>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="mes">Este mês</SelectItem>
                <SelectItem value="ano">Este ano</SelectItem>
                <SelectItem value="custom">Personalizado…</SelectItem>
              </SelectContent>
            </Select>
            {periodoRapido === "custom" && (
              <>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("rounded-xl text-xs gap-1.5 h-9", !dateFrom && "text-muted-foreground")}>
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {dateFrom ? format(dateFrom, "dd/MM/yy", { locale: ptBR }) : "De"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={dateFrom} onSelect={(d) => { setDateFrom(d); setCurrentPage(1); }} initialFocus locale={ptBR} className="p-3 pointer-events-auto" /></PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("rounded-xl text-xs gap-1.5 h-9", !dateTo && "text-muted-foreground")}>
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {dateTo ? format(dateTo, "dd/MM/yy", { locale: ptBR }) : "Até"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={dateTo} onSelect={(d) => { setDateTo(d); setCurrentPage(1); }} initialFocus locale={ptBR} className="p-3 pointer-events-auto" /></PopoverContent>
                </Popover>
                {(dateFrom || dateTo) && (
                  <Button variant="ghost" size="sm" className="h-9 rounded-xl text-xs text-muted-foreground" onClick={() => { setDateFrom(undefined); setDateTo(undefined); setCurrentPage(1); }}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl h-9 w-9 p-0"
              onClick={imprimirDetalhado}
              title="Imprimir relatório detalhado conforme filtros"
            >
              <Printer className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {/* ─── Tab Navigation ─── */}
      <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-2xl border border-border/30 overflow-x-auto no-scrollbar">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => { setActiveTab(tab.key); setCurrentPage(1); }} className={cn("flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0", isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-card/60")}>
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <>

          {/* ─── Aba Integrações: histórico de webhooks dos gateways ─── */}
          {activeTab === "integracoes" && canSeeIntegracoes && (
            <IntegracoesWebhookPanel />
          )}

          {/* ─── Tabs Entradas e Saídas (Fase 4 — Passo 3): consomem FinanceiroContext ─── */}
          {activeTab === "saida" && <SaidasTab />}
          {activeTab === "entrada" && <EntradasTab />}

          {/* ─── Tab A Receber (Fase 4 — Passo 4): consome FinanceiroContext ─── */}
          {activeTab === "a_receber" && <AReceberTab />}



          {/* ─── Livro-Caixa (Fase 4 — Passo 5): consome FinanceiroContext ─── */}
          {activeTab === "caixa" && <CaixaTab />}
        </>


      {/* Dialogs (lazy + conditional render para não baixar chunks no boot) */}
      <Suspense fallback={null}>
      {dialogOpen && (
      <NovaEntradaSaidaDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        tipo={activeTab === "caixa" ? dialogTipo : (activeTab === "saida" ? "saida" : "entrada")}
        onConfirm={handleNovaEntrada}
        tiposDespesa={tiposDespesa}
        destinosPagamento={destinosPagamento}
        formasPagamento={formasPagamento}
        deletableTipos={deletableTipos}
        deletableDestinos={deletableDestinos}
        deletableFormas={deletableFormas}
        onDeleteTipo={(v: any) => void handleDeleteItem("tipo_despesa", v)}
        onDeleteDestino={(v: any) => void handleDeleteItem("destino_pagamento", v)}
        onDeleteForma={(v: any) => void handleDeleteItem("forma_pagamento", v)}
        onCreateTipoRequest={(typed: any, cb: any) => openCriar("tipo_despesa", typed, cb)}
        onCreateDestinoRequest={(typed: any, cb: any) => openCriar("destino_pagamento", typed, cb)}
        onCreateFormaRequest={(typed: any, cb: any) => openCriar("forma_pagamento", typed, cb)}
      />
      )}
      </Suspense>

      <EditEntryDialog
        open={editDialogOpen}
        editingEntry={editingEntry}
        setEditingEntry={setEditingEntry}
        onClose={() => setEditDialogOpen(false)}
        onSave={handleEditSave}
        dict={dictHandlers}
      />

      <DeleteEntryDialog
        open={deleteDialogOpen}
        protocolo={deletingProtocolo}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
      />

      <DetailEntryDialog
        open={detailDialogOpen}
        detailEntry={detailEntry}
        detailAtendimento={detailAtendimento}
        detailExames={detailExames}
        detailTotalExames={detailTotalExames}
        detailTotalPago={detailTotalPago}
        detailSaldo={detailSaldo}
        onClose={() => setDetailDialogOpen(false)}
        onPagar={handlePagarFromDetail}
        onEdit={handleEditFromDetail}
      />

      <PagarDespesaDialog
        open={payDialogOpen}
        payTarget={payTarget}
        payForma={payForma}
        setPayForma={setPayForma}
        payData={payData}
        setPayData={setPayData}
        onClose={() => { setPayDialogOpen(false); setPayTarget(null); }}
        onConfirm={handleConfirmPay}
        dict={dictHandlers}
      />


      {/* Receber pagamento (A Receber) — usa o mesmo modal "Entrada de pagamento" */}
      <Suspense fallback={null}>
      {receberDialogOpen && (
      <NovaEntradaSaidaDialog
        open={receberDialogOpen}
        onClose={() => { setReceberDialogOpen(false); setReceberInitial(null); }}
        tipo="entrada"
        onConfirm={(entry) => {
          handleNovaEntrada(entry);
          setReceberDialogOpen(false);
          setReceberInitial(null);
        }}
        tiposDespesa={tiposDespesa}
        destinosPagamento={destinosPagamento}
        formasPagamento={formasPagamento}
        deletableTipos={deletableTipos}
        deletableDestinos={deletableDestinos}
        deletableFormas={deletableFormas}
        onDeleteTipo={(v: any) => void handleDeleteItem("tipo_despesa", v)}
        onDeleteDestino={(v: any) => void handleDeleteItem("destino_pagamento", v)}
        onDeleteForma={(v: any) => void handleDeleteItem("forma_pagamento", v)}
        onCreateTipoRequest={(typed: any, cb: any) => openCriar("tipo_despesa", typed, cb)}
        onCreateDestinoRequest={(typed: any, cb: any) => openCriar("destino_pagamento", typed, cb)}
        onCreateFormaRequest={(typed: any, cb: any) => openCriar("forma_pagamento", typed, cb)}
        initialEntrada={receberInitial}
      />
      )}
      </Suspense>

      {/* Mini modal: criar Tipo de despesa / Destino / Forma de pagamento */}
      <Suspense fallback={null}>
      {criarOpen && (
      <CriarItemDialog
        open={criarOpen}
        onClose={() => setCriarOpen(false)}
        entityLabel={
          criarCategoria === "tipo_despesa" ? "Tipo de despesa"
            : criarCategoria === "destino_pagamento" ? "Destino do pagamento"
            : "Forma de pagamento"
        }
        initialValue={criarInitialValue}
        existsCheck={(nome) => nomeJaExisteLocal(criarCategoria, nome)}
        onCreate={async (nome) => {
          const novo = await createItem(criarCategoria, nome);
          invalidateDicionarios();
          if (criarOnSuccess) criarOnSuccess(novo.nome);
          toast({ title: `"${novo.nome}" cadastrado com sucesso` });
        }}
      />
      )}
      </Suspense>

      {/* Fechar fatura de convênio (lote) */}
      {fecharFaturaAlvo && (
        <Suspense fallback={null}>
        <FecharFaturaDialog
          open={fecharFaturaOpen}
          onClose={() => { setFecharFaturaOpen(false); setFecharFaturaAlvo(null); }}
          convenioId={fecharFaturaAlvo.convenioId}
          convenioNome={fecharFaturaAlvo.convenioNome}
          formasPagamento={formasPagamento}
          onCreated={() => {
            void refreshEntradas();
            refreshConvenios();
          }}
        />
        </Suspense>
      )}

      {/* Drill-down de fatura paga (Entradas) */}
      {faturaDetalheAlvo && (
        <Suspense fallback={null}>
        <FaturaDetalheDialog
          open={faturaDetalheOpen}
          onClose={() => { setFaturaDetalheOpen(false); setFaturaDetalheAlvo(null); }}
          faturaId={faturaDetalheAlvo.id}
          faturaCodigo={faturaDetalheAlvo.codigo}
          convenioNome={faturaDetalheAlvo.convenio}
          total={faturaDetalheAlvo.total}
        />
        </Suspense>
      )}
    </div>
    </FinanceiroProvider>
  );
};

export default Financeiro;
