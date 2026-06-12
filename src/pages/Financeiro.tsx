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
import { cn, fmtBRL, fmtBRLNumber, searchNormalize } from "@/lib/utils";
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
import { fetchSaldoEmAbertoPorConvenio } from "@/data/convenioFaturasStore";
import { useFeatureFlag } from "@/lib/featureFlags";
import { useAReceberPacientes, useFinanceiroResumo } from "@/hooks/useAReceberPacientes";
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
import StandardDialog from "@/components/ui/standard-dialog";
import SearchableSelect from "@/components/financeiro/SearchableSelect";
import { AlertTriangle, CheckCircle, Wallet, Receipt, Plug } from "lucide-react";
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
import { computePeriodoRange } from "./Financeiro/services/periodoRapido";




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
  const [activeTab, setActiveTab] = useState<TabType>("entrada");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [periodoRapido, setPeriodoRapido] = useState<"hoje" | "7d" | "mes" | "30d" | "ano" | "tudo" | "custom">("tudo");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTipo, setDialogTipo] = useState<"entrada" | "saida">("entrada");
  const [saidasList, setSaidasList] = useState<FinanceiroEntry[]>(() => getSaidas().map(saidaToEntry));
  const [entradasView, setEntradasView] = useState<FinanceiroEntradaView[]>([]);
  const [convenioFilter, setConvenioFilter] = useState<string>("all");
  const [tipoDespesaFilter, setTipoDespesaFilter] = useState<string>("all");
  const [destinoPagamentoFilter, setDestinoPagamentoFilter] = useState<string>("all");
  const [saidaStatusFilter, setSaidaStatusFilter] = useState<SaidaStatusFilter>("todas");
  const [aReceberStatusFilter, setAReceberStatusFilter] = useState<"todas" | "parciais" | "pendentes">("todas");
  const [aReceberSubTab, setAReceberSubTab] = useState<"pacientes" | "convenios">("pacientes");
  // Saldo em aberto por convênio (somente cobrancaDestino=convenio, não-faturados)
  const [saldoConvenios, setSaldoConvenios] = useState<Map<number, { saldo: number; exames: number; pacientes: Set<string> }>>(new Map());
  // Fechar fatura
  const [fecharFaturaOpen, setFecharFaturaOpen] = useState(false);
  const [fecharFaturaAlvo, setFecharFaturaAlvo] = useState<{ convenioId: number; convenioNome: string } | null>(null);
  // Drill-down de fatura nas Entradas
  const [faturaDetalheOpen, setFaturaDetalheOpen] = useState(false);
  const [faturaDetalheAlvo, setFaturaDetalheAlvo] = useState<{ id: number; codigo: string; convenio: string; total: number } | null>(null);
  const [saidasSelecionadas, setSaidasSelecionadas] = useState<Set<string>>(new Set());
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FinanceiroEntry | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingProtocolo, setDeletingProtocolo] = useState<string>("");
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailEntry, setDetailEntry] = useState<FinanceiroEntry | null>(null);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<FinanceiroEntry | null>(null);
  const [payForma, setPayForma] = useState<string>("PIX");
  const [payData, setPayData] = useState<string>("");
  

  // ─── Receber pagamento (A Receber) ───
  // Reusa o NovaEntradaSaidaDialog (idêntico ao "Entrada de pagamento"), pré-selecionando o protocolo.
  const [receberDialogOpen, setReceberDialogOpen] = useState(false);
  const [receberInitial, setReceberInitial] = useState<{
    tipo: "paciente" | "convenio" | "protocolo";
    protocolo?: string;
  } | null>(null);
  
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

  // Mini modal "Criar item"
  const [criarOpen, setCriarOpen] = useState(false);
  const [criarCategoria, setCriarCategoria] = useState<"tipo_despesa" | "destino_pagamento" | "forma_pagamento">("tipo_despesa");
  const [criarInitialValue, setCriarInitialValue] = useState("");
  const [criarOnSuccess, setCriarOnSuccess] = useState<((nome: string) => void) | null>(null);

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

  // ─── A Receber (pacientes — fonte legacy via cache de atendimentos) ───
  const aReceberRows: AReceberRow[] = useMemo(() => {
    if (activeTab !== "a_receber") return [];
    return buildAReceberRowsFromAtendimentos(getAtendimentos());
  }, [activeTab]);


  // ─── C-2 Financeiro: branch RPC (paginated_atendimentos ON & USE_LEGACY_STORE OFF) ───
  // Quando ativo, "A Receber (pacientes)" e o resumo agregado vêm direto do banco,
  // sem depender de getAtendimentos() (que está limitado a 100 registros no boot otimizado).
  // IMPORTANTE: chamar ambos os hooks SEM short-circuit para preservar a ordem de hooks
  // entre renders (regra react-hooks/rules-of-hooks). Combinar somente os resultados.
  const ffPaginated = useFeatureFlag("paginated_atendimentos");
  const ffLegacy = useFeatureFlag("USE_LEGACY_STORE");
  const useRpc = ffPaginated && !ffLegacy;
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
  } = useAReceberPacientes(useRpc && activeTab === "a_receber", {
    search: searchQuery || undefined,
    dateFrom,
    dateTo,
    status: aReceberStatusRpc,
    pageSize: 50,
  });
  const { resumo: financeiroResumoRpc } = useFinanceiroResumo(useRpc, {
    dateFrom,
    dateTo,
    convenio: convenioFilter !== "all" ? convenioFilter : null,
  });

  // Adapta AReceberRowDTO → AReceberRow preservando o template existente
  // (template lê row.atendimento.convenio; criamos um stub leve com os campos lidos).
  const aReceberRowsRpc: AReceberRow[] = useMemo(() => {
    if (!useRpc || activeTab !== "a_receber") return [];
    return buildAReceberRowsFromRpc(rpcRows);
  }, [useRpc, activeTab, rpcRows]);


  // Fonte efetiva de A Receber (RPC quando flag ON; legacy caso contrário)
  const aReceberSource: AReceberRow[] = useRpc ? aReceberRowsRpc : aReceberRows;

  // Após mutações no atendimentoStore, refresca o RPC (não confiar no cache).
  useEffect(() => {
    if (!useRpc) return;
    const unsub = subscribeAtendimentos(() => { rpcRefresh(); });
    return unsub;
  }, [useRpc, rpcRefresh]);

  // Saldo agregado por convênio (cobrancaDestino=convenio, não-faturados)
  useEffect(() => {
    if (activeTab !== "a_receber") return;
    void fetchSaldoEmAbertoPorConvenio().then(setSaldoConvenios);
  }, [activeTab]);

  const aReceberConvenioRows: AReceberConvenioRow[] = useMemo(
    () => buildAReceberConvenioRows(saldoConvenios, getConvenios()),
    [saldoConvenios],
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


  return (
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

          {/* ─── Cards de status (Saídas) ─── */}
          {activeTab === "saida" && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {([
                { key: "todas", label: "Total", count: saidaCounts.todas, value: saidaCounts.totalPendentes + saidaCounts.totalPagas, icon: CircleDollarSign, tone: "neutral" },
                { key: "vencidas", label: "Vencidas", count: saidaCounts.vencidas, value: saidaCounts.totalVencidas, icon: AlertOctagon, tone: "bad" },
                { key: "vencendo7", label: "Vencem em 7 dias", count: saidaCounts.vencendo7, value: saidaCounts.totalVencendo7, icon: Clock, tone: "warn" },
                { key: "pagas", label: "Pagas", count: saidaCounts.pagas, value: saidaCounts.totalPagas, icon: CheckCircle2, tone: "good" },
              ] as const).map(card => {
                const Icon = card.icon;
                const active = saidaStatusFilter === card.key;
                const toneStyles = {
                  neutral: { icon: "text-muted-foreground", accent: "bg-foreground" },
                  bad: { icon: "text-destructive", accent: "bg-destructive" },
                  warn: { icon: "text-status-warning", accent: "bg-status-warning" },
                  good: { icon: "text-status-success", accent: "bg-status-success" },
                }[card.tone];
                return (
                  <button
                    key={card.key}
                    onClick={() => { setSaidaStatusFilter(card.key); setCurrentPage(1); setSaidasSelecionadas(new Set()); }}
                    className={cn(
                      "relative rounded-lg border bg-card px-3 py-2.5 text-left transition-colors overflow-hidden",
                      active ? "border-primary/40 bg-muted/30" : "border-border/60 hover:bg-muted/20",
                    )}
                  >
                    {active && (<span className={cn("absolute left-0 top-0 bottom-0 w-0.5", toneStyles.accent)} />)}
                    <div className="flex items-center gap-2 mb-1.5">
                      <Icon className={cn("h-3.5 w-3.5 shrink-0", toneStyles.icon)} />
                      <span className="text-[11px] font-medium text-muted-foreground truncate">{card.label}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2">
                      <p className="text-lg sm:text-base font-semibold text-foreground tabular-nums leading-none">{card.count}</p>
                      <p className="text-[11px] text-muted-foreground tabular-nums truncate">{fmtBRL(card.value)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* ─── Card de resumo (Entradas — regime de caixa) ─── */}
          {activeTab === "entrada" && (
            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="relative rounded-lg border border-border/60 bg-card px-3 py-2.5 overflow-hidden">
                  <div className="flex items-center gap-2 mb-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-status-success" />
                    <span className="text-[11px] font-medium text-muted-foreground truncate">Total recebido (pagamentos efetivados)</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2">
                    <p className="text-lg sm:text-base font-semibold text-foreground tabular-nums leading-none">{entradaCounts.todas}</p>
                    <p className="text-[11px] text-muted-foreground tabular-nums truncate">{fmtBRL(entradaCounts.totalRecebido)}</p>
                  </div>
                </div>
                <button
                  onClick={() => { setActiveTab("a_receber"); setCurrentPage(1); }}
                  className="relative rounded-lg border border-border/60 bg-card px-3 py-2.5 text-left transition-colors overflow-hidden hover:bg-muted/20"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Clock className="h-3.5 w-3.5 shrink-0 text-status-warning" />
                    <span className="text-[11px] font-medium text-muted-foreground truncate">A receber (parcial + pendente)</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2">
                    <p className="text-lg sm:text-base font-semibold text-foreground tabular-nums leading-none">{aReceberCounts.todas}</p>
                    <p className="text-[11px] text-muted-foreground tabular-nums truncate">{fmtBRL(aReceberCounts.totalGeral)}</p>
                  </div>
                </button>
              </div>

              {/* ─── Breakdown por forma de pagamento (período/convênio filtrado) ─── */}
              {entradaCounts.byPagamento.length > 0 && (
                <div className="rounded-lg border border-border/60 bg-card px-3 py-2.5">
                  <div className="flex items-center gap-2 mb-2">
                    <Wallet className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="text-[11px] font-medium text-muted-foreground truncate">
                      Recebido por forma de pagamento
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {entradaCounts.byPagamento.map(fp => {
                      const pct = entradaCounts.totalRecebido > 0
                        ? (fp.total / entradaCounts.totalRecebido) * 100
                        : 0;
                      const Icon = (() => {
                        const n = fp.nome.toLowerCase();
                        if (n.includes("pix")) return QrCode;
                        if (n.includes("dinheiro")) return Banknote;
                        if (n.includes("crédito") || n.includes("credito") || n.includes("débito") || n.includes("debito") || n.includes("cartão") || n.includes("cartao")) return CreditCard;
                        if (n.includes("boleto") || n.includes("transfer")) return Building2;
                        return CircleDollarSign;
                      })();
                      return (
                        <div
                          key={fp.nome}
                          className="relative flex-1 min-w-[140px] rounded-lg border border-border/60 bg-background px-2.5 py-2 overflow-hidden"
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
                            <span className="text-[10px] font-medium text-muted-foreground truncate">{fp.nome}</span>
                          </div>
                          <p className="text-sm font-semibold text-foreground tabular-nums leading-tight">
                            {fmtBRL(fp.total)}
                          </p>
                          <p className="text-[10px] text-muted-foreground tabular-nums">
                            {fp.count} {fp.count === 1 ? "pagamento" : "pagamentos"} · {pct.toFixed(1)}%
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── Cards de status (A Receber) ─── */}
          {activeTab === "a_receber" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {([
                { key: "todas", label: "Total a receber", count: aReceberCounts.todas, value: aReceberCounts.totalGeral, icon: CircleDollarSign, tone: "neutral" },
                { key: "parciais", label: "Parciais", count: aReceberCounts.parciais, value: aReceberCounts.totalParciais, icon: Clock, tone: "warn" },
                { key: "pendentes", label: "Pendentes", count: aReceberCounts.pendentes, value: aReceberCounts.totalPendentes, icon: AlertOctagon, tone: "bad" },
              ] as const).map(card => {
                const Icon = card.icon;
                const active = aReceberStatusFilter === card.key;
                const toneStyles = {
                  neutral: { icon: "text-muted-foreground", accent: "bg-foreground" },
                  bad: { icon: "text-destructive", accent: "bg-destructive" },
                  warn: { icon: "text-status-warning", accent: "bg-status-warning" },
                  good: { icon: "text-status-success", accent: "bg-status-success" },
                }[card.tone];
                return (
                  <button
                    key={card.key}
                    onClick={() => { setAReceberStatusFilter(card.key); setCurrentPage(1); }}
                    className={cn(
                      "relative rounded-lg border bg-card px-3 py-2.5 text-left transition-colors overflow-hidden",
                      active ? "border-primary/40 bg-muted/30" : "border-border/60 hover:bg-muted/20",
                    )}
                  >
                    {active && (<span className={cn("absolute left-0 top-0 bottom-0 w-0.5", toneStyles.accent)} />)}
                    <div className="flex items-center gap-2 mb-1.5">
                      <Icon className={cn("h-3.5 w-3.5 shrink-0", toneStyles.icon)} />
                      <span className="text-[11px] font-medium text-muted-foreground truncate">{card.label}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2">
                      <p className="text-lg sm:text-base font-semibold text-foreground tabular-nums leading-none">{card.count}</p>
                      <p className="text-[11px] text-muted-foreground tabular-nums truncate">{fmtBRL(card.value)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* (Barra de ações em lote removida — seleção múltipla foi descontinuada) */}

          <div className="rounded-3xl border border-border/60 bg-card p-5 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="text" placeholder="Pesquisar por nome, protocolo..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} className="w-full pl-11 pr-4 py-2.5 rounded-2xl border border-border/60 bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all" />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {(activeTab === "entrada" || activeTab === "a_receber") && (
                  <SearchableSelect
                    value={convenioFilter === "all" ? "Todos convênios" : convenioFilter}
                    onChange={v => {
                      const val = !v || v === "Todos convênios" ? "all" : v;
                      setConvenioFilter(val);
                      setCurrentPage(1);
                    }}
                    options={["Todos convênios", ...conveniosDisponiveis]}
                    placeholder="Convênio"
                    size="sm"
                    className="w-48"
                  />
                )}
                {activeTab === "saida" && (
                  <>
                    <SearchableSelect
                      value={tipoDespesaFilter === "all" ? "Todos" : tipoDespesaFilter}
                      onChange={v => {
                        const val = !v || v === "Todos" ? "all" : v;
                        setTipoDespesaFilter(val);
                        setCurrentPage(1);
                      }}
                      onCreateRequest={(typed) => openCriar("tipo_despesa", typed, (nome) => { setTipoDespesaFilter(nome); setCurrentPage(1); })}
                      options={["Todos", ...tiposDespesa]}
                      placeholder="Tipo despesa"
                      allowCreate
                      size="sm"
                      className="w-44"
                      deletableOptions={deletableTipos}
                      onDelete={(v) => void handleDeleteItem("tipo_despesa", v)}
                    />
                    <SearchableSelect
                      value={destinoPagamentoFilter === "all" ? "Todos" : destinoPagamentoFilter}
                      onChange={v => {
                        const val = !v || v === "Todos" ? "all" : v;
                        setDestinoPagamentoFilter(val);
                        setCurrentPage(1);
                      }}
                      onCreateRequest={(typed) => openCriar("destino_pagamento", typed, (nome) => { setDestinoPagamentoFilter(nome); setCurrentPage(1); })}
                      options={["Todos", ...destinosPagamento]}
                      placeholder="Destino"
                      allowCreate
                      size="sm"
                      className="w-44"
                      deletableOptions={deletableDestinos}
                      onDelete={(v) => void handleDeleteItem("destino_pagamento", v)}
                    />
                  </>
                )}
                {activeTab !== "caixa" && activeTab !== "a_receber" && (
                  <Button onClick={() => { setDialogTipo(activeTab === "saida" ? "saida" : "entrada"); setDialogOpen(true); }} className="rounded-2xl h-10 gap-2 text-xs font-semibold px-5">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Nova {activeTab === "saida" ? "saída" : "entrada"}</span>
                    <span className="sm:hidden">Adicionar</span>
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* ─── Data Table (Entradas / Saídas) ─── */}
          {activeTab !== "a_receber" && activeTab !== "caixa" && (
          <div className="rounded-3xl border border-border/60 bg-card overflow-hidden">
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/20">
                    {activeTab === "saida" ? (
                      <>
                        <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Protocolo</th>
                        <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Descrição</th>
                        <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vencimento</th>
                        <th className="text-center px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                        <th className="text-center px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
                      </>
                    ) : (
                      <>
                        <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Protocolo</th>
                        <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cliente</th>
                        <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recebimento</th>
                        <th className="text-center px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                        <th className="text-center px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-16 text-sm text-muted-foreground">Nenhum registro encontrado</td></tr>
                  ) : paginatedData.map((entry, idx) => {
                    const today = new Date(); today.setHours(0, 0, 0, 0);
                    const venc = entry.dataVencimento ? parseDate(entry.dataVencimento) : null;
                    const paga = entry.foiPago === "Sim";
                    const vencida = !paga && venc !== null && venc < today;
                    const diasVenc = venc ? Math.round((venc.getTime() - today.getTime()) / 86400000) : null;
                    const vencendo = !paga && diasVenc !== null && diasVenc >= 0 && diasVenc <= 7;
                    const sel = saidasSelecionadas.has(entry.protocolo);
                    const statusEntrada = entry.statusPagamento || (entry.tipo === "entrada" ? "Pago" : "");
                    const entradaPago = statusEntrada === "Pago" || statusEntrada === "Pagamento efetuado";
                    const entradaParcial = statusEntrada === "Parcial" || statusEntrada === "Pagamento parcial";
                    return (
                      <tr key={idx} className={cn("border-b border-border/20 last:border-0 hover:bg-muted/15 transition-colors group", sel && "bg-primary/5")}>
                        {activeTab === "saida" ? (
                          <>
                            <td className="px-5 py-4">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-sm font-semibold text-foreground tabular-nums">{entry.protocolo}</span>
                                <span className="text-[11px] text-muted-foreground tabular-nums">{entry.data}</span>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-foreground max-w-[260px]">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-sm font-medium text-foreground">{entry.tipoDespesa || "—"}</span>
                                {(entry.descricao || entry.cliente) && (
                                  <span className="text-[11px] text-muted-foreground truncate">
                                    {entry.descricao || entry.cliente}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-sm font-bold text-destructive tabular-nums">- {fmtBRL(entry.valorTotal)}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-muted-foreground">{entry.dataVencimento || "—"}</span>
                                  {vencida && diasVenc !== null && (
                                    <span className="text-[11px] font-semibold text-destructive">há {Math.abs(diasVenc)}d</span>
                                  )}
                                  {vencendo && diasVenc !== null && (
                                    <span className="text-[11px] font-semibold text-amber-600">em {diasVenc}d</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <button
                                type="button"
                                onClick={() => handleDetailClick(entry)}
                                className={cn(
                                  "text-xs font-semibold px-3 py-1 rounded-full transition-all hover:ring-2 hover:ring-offset-1 hover:ring-offset-background cursor-pointer",
                                  paga ? "bg-status-success/10 text-status-success hover:ring-status-success/30"
                                    : vencida ? "bg-destructive/10 text-destructive hover:ring-destructive/30"
                                    : vencendo ? "bg-amber-500/10 text-amber-700 hover:ring-amber-500/30"
                                    : "bg-muted/60 text-muted-foreground hover:ring-border",
                                )}
                                title="Ver detalhes"
                              >
                                {paga ? "Pago" : vencida ? "Vencida" : vencendo ? "Vence em breve" : "Pendente"}
                              </button>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center justify-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEditClick(entry)} className="p-2 rounded-xl hover:bg-muted transition-colors"><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></button>
                                <button onClick={() => handleDeleteClick(entry.protocolo)} className="p-2 rounded-xl hover:bg-destructive/10 transition-colors"><Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" /></button>
                                <button onClick={() => handleDetailClick(entry)} className="p-2 rounded-xl hover:bg-muted transition-colors"><Eye className="h-3.5 w-3.5 text-muted-foreground" /></button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-5 py-4">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-sm font-semibold text-foreground tabular-nums flex items-center gap-1.5">
                                  {entry.protocolo}
                                  {entry.origem === "fatura_convenio" && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-bold uppercase tracking-wider">Fatura</span>
                                  )}
                                </span>
                                <span className="text-[11px] text-muted-foreground tabular-nums">{entry.data}</span>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-foreground max-w-[260px]">
                              <div className="flex flex-col gap-0.5">
                                {entry.origem === "fatura_convenio" ? (
                                  <>
                                    <span className="text-sm font-medium text-foreground truncate">{entry.convenio || entry.cliente}</span>
                                    <span className="text-[11px] text-muted-foreground truncate">Pagamento agregado de fatura</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-sm font-medium text-foreground truncate">{entry.cliente}</span>
                                    {entry.convenio && (
                                      <span className="text-[11px] text-muted-foreground truncate">{entry.convenio}</span>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-sm font-bold text-status-success tabular-nums">+ {fmtBRL(entry.valorTotal)}</span>
                                <span className="text-[11px] text-muted-foreground">{entry.pagamento || "—"}</span>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <button
                                type="button"
                                onClick={() => handleDetailClick(entry)}
                                className={cn(
                                  "text-xs font-semibold px-3 py-1 rounded-full transition-all hover:ring-2 hover:ring-offset-1 hover:ring-offset-background cursor-pointer",
                                  entradaPago ? "bg-status-success/10 text-status-success hover:ring-status-success/30"
                                    : entradaParcial ? "bg-amber-500/10 text-amber-700 hover:ring-amber-500/30"
                                    : "bg-muted/60 text-muted-foreground hover:ring-border",
                                )}
                                title="Ver detalhes"
                              >
                                {entradaPago ? "Pago" : entradaParcial ? "Parcial" : (statusEntrada || "Pendente")}
                              </button>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center justify-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                {entry.origem === "fatura_convenio" && entry.faturaId ? (
                                  <button
                                    onClick={() => {
                                      setFaturaDetalheAlvo({
                                        id: entry.faturaId!,
                                        codigo: entry.protocolo,
                                        convenio: entry.convenio || entry.cliente,
                                        total: entry.valorTotal,
                                      });
                                      setFaturaDetalheOpen(true);
                                    }}
                                    className="px-2.5 py-1 rounded-xl hover:bg-muted transition-colors text-[11px] font-medium text-primary flex items-center gap-1"
                                    title="Ver atendimentos da fatura"
                                  >
                                    <Receipt className="h-3.5 w-3.5" />
                                    Ver itens
                                  </button>
                                ) : (
                                  <button onClick={() => handleDetailClick(entry)} className="p-2 rounded-xl hover:bg-muted transition-colors"><Eye className="h-3.5 w-3.5 text-muted-foreground" /></button>
                                )}
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden divide-y divide-border/30">
              {paginatedData.length === 0 ? (
                <div className="p-16 text-center text-sm text-muted-foreground">Nenhum registro encontrado</div>
              ) : paginatedData.map((entry, idx) => {
                const today = new Date(); today.setHours(0, 0, 0, 0);
                const venc = entry.dataVencimento ? parseDate(entry.dataVencimento) : null;
                const paga = entry.foiPago === "Sim";
                const vencida = !paga && venc !== null && venc < today;
                const diasVenc = venc ? Math.round((venc.getTime() - today.getTime()) / 86400000) : null;
                const vencendo = !paga && diasVenc !== null && diasVenc >= 0 && diasVenc <= 7;
                const sel = saidasSelecionadas.has(entry.protocolo);
                return (
                  <div key={idx} className={cn("p-4 space-y-3", sel && "bg-primary/5")}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">{activeTab === "saida" ? (entry.descricao || entry.cliente) : entry.cliente}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">{entry.protocolo} · {entry.data}</p>
                      </div>
                      <p className={cn("text-sm font-bold shrink-0 tabular-nums", entry.tipo === "saida" ? "text-destructive" : "text-status-success")}>
                        {entry.tipo === "saida" ? "- " : "+ "}{fmtBRL(entry.valorTotal)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground font-medium">{entry.pagamento}</span>
                      {activeTab === "saida" && entry.tipoDespesa && <span className="text-[11px] px-2 py-0.5 rounded-md bg-accent/60 text-accent-foreground font-medium">{entry.tipoDespesa}</span>}
                      {activeTab === "saida" && (
                        <button
                          type="button"
                          onClick={() => handleDetailClick(entry)}
                          className={cn(
                            "text-[11px] px-2 py-0.5 rounded-md font-semibold transition-all hover:opacity-80",
                            paga ? "bg-status-success/10 text-status-success"
                              : vencida ? "bg-destructive/10 text-destructive"
                              : vencendo ? "bg-amber-500/10 text-amber-700"
                              : "bg-muted/60 text-muted-foreground",
                          )}
                        >
                          {paga ? "Pago" : vencida && diasVenc !== null ? `Vencida há ${Math.abs(diasVenc)}d` : vencendo && diasVenc !== null ? `Vence em ${diasVenc}d` : "Pendente"}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-border/20">
                      {activeTab === "saida" && (
                        <>
                          <button onClick={() => handleEditClick(entry)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"><Pencil className="h-3.5 w-3.5" />Editar</button>
                          <button onClick={() => handleDeleteClick(entry.protocolo)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="h-3.5 w-3.5" />Excluir</button>
                        </>
                      )}
                      <button onClick={() => handleDetailClick(entry)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"><Eye className="h-3.5 w-3.5" />Detalhes</button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-border/30">
                <span className="text-xs text-muted-foreground">{((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, filtered.length)} de {filtered.length}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-xl hover:bg-muted transition-colors disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(page => (
                    <button key={page} onClick={() => setCurrentPage(page)} className={cn("h-8 w-8 rounded-xl text-xs font-semibold transition-all", currentPage === page ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>{page}</button>
                  ))}
                  {totalPages > 5 && <span className="text-xs text-muted-foreground px-1">…</span>}
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-xl hover:bg-muted transition-colors disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
                </div>
              </div>
            )}
          </div>
          )}

          {/* ─── A Receber: sub-abas Pacientes/Convênios ─── */}
          {activeTab === "a_receber" && (
            <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-2xl border border-border/30 w-fit">
              {([
                { key: "pacientes", label: `Pacientes (${aReceberSource.length})` },
                { key: "convenios", label: `Convênios (${aReceberConvenioRows.length})` },
              ] as const).map(t => {
                const active = aReceberSubTab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => { setAReceberSubTab(t.key); setCurrentPage(1); }}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap",
                      active ? "bg-card text-foreground shadow-sm border border-border/40" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* ─── A Receber: tabela dedicada ─── */}
          {activeTab === "a_receber" && aReceberSubTab === "convenios" && (
            <div className="rounded-3xl border border-border/60 bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/20">
                      <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Convênio</th>
                      <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Exames em aberto</th>
                      <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Saldo a faturar</th>
                      <th className="text-center px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aReceberConvenioRows.length === 0 ? (
                      <tr><td colSpan={4} className="text-center py-16 text-sm text-muted-foreground">Nenhum convênio com saldo em aberto</td></tr>
                    ) : aReceberConvenioRows.map(row => (
                      <tr key={row.convenioId} className="border-b border-border/20 last:border-0 hover:bg-muted/15 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-semibold text-foreground">{row.convenioNome}</span>
                            <span className="text-[11px] text-muted-foreground">{row.qtdPacientes} paciente(s)</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm text-foreground tabular-nums">{row.qtdExames}</td>
                        <td className="px-5 py-4">
                          <span className="text-sm font-bold text-status-warning tabular-nums">{fmtBRL(row.saldo)}</span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-center">
                            <Button
                              size="sm"
                              onClick={() => {
                                setFecharFaturaAlvo({ convenioId: row.convenioId, convenioNome: row.convenioNome });
                                setFecharFaturaOpen(true);
                              }}
                              className="rounded-xl h-8 text-xs gap-1.5"
                            >
                              <Receipt className="h-3.5 w-3.5" />
                              Fechar fatura
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "a_receber" && aReceberSubTab === "pacientes" && (
            <div className="rounded-3xl border border-border/60 bg-card overflow-hidden">
              {/* Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/20">
                      <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Protocolo</th>
                      <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cliente</th>
                      <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Saldo</th>
                      <th className="text-center px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="text-center px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aReceberPaginated.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-16 text-sm text-muted-foreground">Nenhum atendimento com saldo pendente</td></tr>
                    ) : aReceberPaginated.map((row, idx) => (
                      <tr key={idx} className="border-b border-border/20 last:border-0 hover:bg-muted/15 transition-colors group">
                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-semibold text-foreground tabular-nums">{row.protocolo}</span>
                            <span className="text-[11px] text-muted-foreground tabular-nums">{row.data}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 max-w-[260px]">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium text-foreground truncate">{row.cliente}</span>
                            {row.atendimento.convenio !== "Particular" && (
                              <span className="text-[11px] text-muted-foreground truncate">{row.convenio}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-bold text-status-warning tabular-nums">{fmtBRL(row.saldo)}</span>
                            <span className="text-[11px] text-muted-foreground tabular-nums">de {fmtBRL(row.valorTotal)}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className={cn(
                            "text-xs font-semibold px-3 py-1 rounded-full",
                            row.status === "parcial" ? "bg-status-warning/10 text-status-warning" : "bg-destructive/10 text-destructive",
                          )}>
                            {row.status === "parcial" ? "Parcial" : "Pendente"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-center">
                            <Button size="sm" onClick={() => handleAReceberPagar(row)} className="rounded-xl h-8 text-xs gap-1.5">
                              <Wallet className="h-3.5 w-3.5" />
                              Receber
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="md:hidden divide-y divide-border/30">
                {aReceberPaginated.length === 0 ? (
                  <div className="p-16 text-center text-sm text-muted-foreground">Nenhum atendimento com saldo pendente</div>
                ) : aReceberPaginated.map((row, idx) => (
                  <div key={idx} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">{row.cliente}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">{row.protocolo} · {row.data}</p>
                      </div>
                      <p className="text-sm font-bold text-status-warning shrink-0 tabular-nums">{fmtBRL(row.saldo)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground font-medium">{row.convenio}</span>
                      <span className={cn(
                        "text-[11px] px-2 py-0.5 rounded-md font-semibold",
                        row.status === "parcial" ? "bg-status-warning/10 text-status-warning" : "bg-destructive/10 text-destructive",
                      )}>
                        {row.status === "parcial" ? "Parcial" : "Pendente"}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-muted/40 text-muted-foreground tabular-nums">de {fmtBRL(row.valorTotal)}</span>
                    </div>
                    <Button size="sm" onClick={() => handleAReceberPagar(row)} className="w-full rounded-xl h-9 text-xs gap-1.5">
                      <Wallet className="h-3.5 w-3.5" />
                      Receber pagamento
                    </Button>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {aReceberTotalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-4 border-t border-border/30">
                  <span className="text-xs text-muted-foreground">{((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, aReceberFiltered.length)} de {aReceberFiltered.length}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-xl hover:bg-muted transition-colors disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
                    {Array.from({ length: Math.min(aReceberTotalPages, 5) }, (_, i) => i + 1).map(page => (
                      <button key={page} onClick={() => setCurrentPage(page)} className={cn("h-8 w-8 rounded-xl text-xs font-semibold transition-all", currentPage === page ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>{page}</button>
                    ))}
                    {aReceberTotalPages > 5 && <span className="text-xs text-muted-foreground px-1">…</span>}
                    <button onClick={() => setCurrentPage(p => Math.min(aReceberTotalPages, p + 1))} disabled={currentPage === aReceberTotalPages} className="p-2 rounded-xl hover:bg-muted transition-colors disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── Livro-Caixa ─── */}
          {activeTab === "caixa" && (
            <CaixaTab
              caixaTotais={caixaTotais}
              caixaSaldoInicial={caixaSaldoInicial}
              caixaPaginated={caixaPaginated}
              caixaLinhasComSaldo={caixaLinhasComSaldo}
              caixaTotalPages={caixaTotalPages}
              currentPage={currentPage}
              setCurrentPage={(updater) => setCurrentPage(updater)}
              setCurrentPageDirect={(page) => setCurrentPage(page)}
              dateFrom={dateFrom}
              itemsPerPage={itemsPerPage}
              imprimirLivroCaixa={imprimirLivroCaixa}
            />
          )}
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

      <StandardDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        icon={<ArrowUpCircle className="h-5 w-5 text-destructive" />}
        title="Editar saída"
        subtitle={editingEntry ? `Protocolo ${editingEntry.protocolo}` : "Altere os dados da despesa"}
        maxWidth="2xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="rounded-2xl">Cancelar</Button>
            <Button onClick={handleEditSave} className="rounded-2xl">Salvar alterações</Button>
          </>
        }
      >
        {editingEntry && (
          <div className="px-6 py-5 space-y-4">
            {/* Card: Classificação */}
            <div className="rounded-2xl border border-border/50 bg-muted/15 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Classificação</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Tipo de despesa <span className="text-destructive">*</span></Label>
                  <SearchableSelect
                    value={editingEntry.tipoDespesa || ""}
                    onChange={v => setEditingEntry({ ...editingEntry, tipoDespesa: v })}
                    onCreateRequest={(typed) => openCriar("tipo_despesa", typed, (nome) => setEditingEntry((prev) => prev ? { ...prev, tipoDespesa: nome } : prev))}
                    options={tiposDespesa}
                    placeholder="Digite ou selecione..."
                    allowCreate
                    deletableOptions={deletableTipos}
                    onDelete={v => {
                      void handleDeleteItem("tipo_despesa", v);
                      if (editingEntry.tipoDespesa === v) setEditingEntry({ ...editingEntry, tipoDespesa: "" });
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Destino do pagamento</Label>
                  <SearchableSelect
                    value={editingEntry.destinoPagamento || ""}
                    onChange={v => setEditingEntry({ ...editingEntry, destinoPagamento: v })}
                    onCreateRequest={(typed) => openCriar("destino_pagamento", typed, (nome) => setEditingEntry((prev) => prev ? { ...prev, destinoPagamento: nome } : prev))}
                    options={destinosPagamento}
                    placeholder="Digite ou selecione..."
                    allowCreate
                    deletableOptions={deletableDestinos}
                    onDelete={v => {
                      void handleDeleteItem("destino_pagamento", v);
                      if (editingEntry.destinoPagamento === v) setEditingEntry({ ...editingEntry, destinoPagamento: "" });
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Card: Detalhes */}
            <div className="rounded-2xl border border-border/50 bg-muted/15 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" />
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Detalhes</span>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-cliente" className="text-xs font-medium text-muted-foreground">Cliente / Fornecedor</Label>
                <Input
                  id="edit-cliente"
                  value={editingEntry.cliente}
                  maxLength={120}
                  onChange={e => setEditingEntry({ ...editingEntry, cliente: e.target.value })}
                  className="rounded-xl h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-descricao" className="text-xs font-medium text-muted-foreground">Descrição</Label>
                <Input
                  id="edit-descricao"
                  value={editingEntry.descricao || ""}
                  maxLength={200}
                  placeholder="Ex. Conta de luz — Janeiro/2026"
                  onChange={e => setEditingEntry({ ...editingEntry, descricao: e.target.value })}
                  className="rounded-xl h-10"
                />
              </div>
            </div>

            {/* Card: Valores e Datas */}
            <div className="rounded-2xl border border-border/50 bg-muted/15 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" />
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Valores e Datas</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-valor" className="text-xs font-medium text-muted-foreground">Valor (R$)</Label>
                  <Input
                    id="edit-valor"
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingEntry.valorTotal}
                    onChange={e => setEditingEntry({ ...editingEntry, valorTotal: parseFloat(e.target.value) || 0 })}
                    className="rounded-xl h-10 font-semibold"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-vencimento" className="text-xs font-medium text-muted-foreground">Vencimento</Label>
                  <Input
                    id="edit-vencimento"
                    inputMode="numeric"
                    placeholder="dd/mm/aaaa"
                    maxLength={10}
                    value={editingEntry.dataVencimento || ""}
                    onChange={e => setEditingEntry({ ...editingEntry, dataVencimento: maskDateBR(e.target.value) })}
                    aria-invalid={!isValidDateBR(editingEntry.dataVencimento || "")}
                    className={cn("rounded-xl h-10", !isValidDateBR(editingEntry.dataVencimento || "") && "border-destructive focus-visible:ring-destructive")}
                  />
                  {!isValidDateBR(editingEntry.dataVencimento || "") && (
                    <p className="text-[11px] text-destructive">Data inválida. Use dd/mm/aaaa.</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Forma de pagamento</Label>
                  <SearchableSelect
                    value={editingEntry.pagamento === "—" ? "" : editingEntry.pagamento}
                    onChange={v => setEditingEntry({ ...editingEntry, pagamento: v })}
                    onCreateRequest={(typed) => openCriar("forma_pagamento", typed, (nome) => setEditingEntry((prev) => prev ? { ...prev, pagamento: nome } : prev))}
                    options={formasPagamento}
                    placeholder="Selecione"
                    allowCreate
                    deletableOptions={deletableFormas}
                    onDelete={v => void handleDeleteItem("forma_pagamento", v)}
                  />
                </div>
              </div>
            </div>

            {/* Card: Status do pagamento */}
            <div className="rounded-2xl border border-border/50 bg-muted/15 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status do pagamento</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Foi pago?</Label>
                  <div className="flex gap-2">
                    {(["Sim", "Não"] as const).map(opt => {
                      const active = (editingEntry.foiPago || "Não") === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            const today = new Date();
                            const hoje = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;
                            setEditingEntry({
                              ...editingEntry,
                              foiPago: opt,
                              dataPagamento: opt === "Não" ? "" : (editingEntry.dataPagamento || hoje),
                            });
                          }}
                          className={cn(
                            "flex-1 h-10 rounded-xl border text-sm font-medium transition-all",
                            active
                              ? opt === "Sim"
                                ? "bg-status-success/10 border-status-success/40 text-status-success"
                                : "bg-muted/60 border-border text-foreground"
                              : "bg-background border-border text-muted-foreground hover:bg-muted/30",
                          )}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {editingEntry.foiPago === "Sim" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-data-pgto" className="text-xs font-medium text-muted-foreground">Data do pagamento</Label>
                    <Input
                      id="edit-data-pgto"
                      inputMode="numeric"
                      placeholder="dd/mm/aaaa"
                      maxLength={10}
                      value={editingEntry.dataPagamento || ""}
                      onChange={e => setEditingEntry({ ...editingEntry, dataPagamento: maskDateBR(e.target.value) })}
                      aria-invalid={!isValidDateBR(editingEntry.dataPagamento || "")}
                      className={cn("rounded-xl h-10", !isValidDateBR(editingEntry.dataPagamento || "") && "border-destructive focus-visible:ring-destructive")}
                    />
                    {!isValidDateBR(editingEntry.dataPagamento || "") && (
                      <p className="text-[11px] text-destructive">Data inválida. Use dd/mm/aaaa.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </StandardDialog>

      <StandardDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        icon={<AlertTriangle className="h-5 w-5 text-destructive" />}
        title="Excluir registro"
        subtitle={`Protocolo ${deletingProtocolo}`}
        maxWidth="sm"
        footer={
          <>
            <Button variant="outline" className="rounded-2xl" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-2xl">Excluir</Button>
          </>
        }
      >
        <div className="px-6 py-5 text-sm text-muted-foreground">
          Tem certeza que deseja excluir <span className="font-semibold text-foreground">{deletingProtocolo}</span>? Esta ação não pode ser desfeita.
        </div>
      </StandardDialog>

      <StandardDialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        icon={detailEntry?.tipo === "saida"
          ? <ArrowUpCircle className="h-5 w-5 text-destructive" />
          : <FileText className="h-5 w-5 text-primary" />}
        title={detailEntry?.tipo === "saida" ? "Detalhes da despesa" : "Detalhes da entrada"}
        subtitle={detailEntry?.protocolo}
        maxWidth="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)} className="rounded-2xl">Fechar</Button>
            <Button variant="outline" className="rounded-2xl gap-2" onClick={() => {
              if (!detailEntry) return;
              const examesHtml = detailAtendimento ? detailExames.map(e => `<div class="line"><span>${e.nome}</span><span>R$ ${fmtBRLNumber(e.valor)}</span></div>`).join("") : "";
              const pagsHtml = detailAtendimento ? (detailAtendimento.pagamentosRealizados ?? []).map(p => `<div class="line"><span>${p.tipo} — ${p.data}</span><span>R$ ${fmtBRLNumber(p.valor)}</span></div>`).join("") : `<div class="line"><span>${detailEntry.pagamento}</span><span>R$ ${fmtBRLNumber(detailEntry.valorTotal)}</span></div>`;
              const html = `<html><head><title>Comprovante</title><style>body{font-family:Arial,sans-serif;padding:24px;font-size:13px;color:#222}h2{text-align:center;margin-bottom:4px}.sub{text-align:center;color:#888;font-size:11px;margin-bottom:16px}.line{display:flex;justify-content:space-between;padding:4px 0}.divider{border-top:1px dashed #ccc;margin:12px 0}.bold{font-weight:bold}</style></head><body><h2>Comprovante de Pagamento</h2><p class="sub">${detailEntry.data}</p><div class="divider"></div><div class="line"><span>Protocolo:</span><span class="bold">${detailEntry.protocolo}</span></div><div class="line"><span>Cliente:</span><span class="bold">${detailEntry.cliente}</span></div><div class="line"><span>Convênio:</span><span>${detailEntry.convenio ?? "—"}</span></div>${examesHtml ? `<div class="divider"></div><div class="line bold"><span>Exames:</span></div>${examesHtml}<div class="divider"></div><div class="line bold"><span>Total exames:</span><span>R$ ${fmtBRLNumber(detailTotalExames)}</span></div>` : ""}<div class="divider"></div><div class="line bold"><span>Pagamentos:</span></div>${pagsHtml}<div class="divider"></div><div class="line bold"><span>Valor:</span><span>R$ ${fmtBRLNumber(detailEntry.valorTotal)}</span></div>${detailAtendimento ? `<div class="line"><span>Total pago:</span><span>R$ ${fmtBRLNumber(detailTotalPago)}</span></div><div class="line bold"><span>Saldo devedor:</span><span style="color:${detailSaldo > 0.01 ? '#dc2626' : '#16a34a'}">R$ ${fmtBRLNumber(Math.max(0,detailSaldo))}</span></div>` : ""}</body></html>`;
              printHtmlInHiddenFrame({ html, frameId: "financeiro-comprovante-print-frame" });
            }}><Printer className="h-4 w-4" />Imprimir</Button>
            {detailEntry?.tipo === "saida" && detailEntry.foiPago !== "Sim" && (
              <>
                <Button variant="outline" className="rounded-2xl gap-2" onClick={handleEditFromDetail}>
                  <Pencil className="h-4 w-4" />Editar
                </Button>
                <Button className="rounded-2xl gap-2 bg-status-success text-white hover:bg-status-success/90" onClick={handlePagarFromDetail}>
                  <CheckCircle className="h-4 w-4" />Pagar agora
                </Button>
              </>
            )}
          </>
        }
      >
        {detailEntry && (
          <div className="px-6 py-5 space-y-4">
            <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">{detailEntry.tipo === "saida" ? "Descrição" : "Cliente"}</span><span className="font-bold text-foreground">{detailEntry.tipo === "saida" ? (detailEntry.descricao || detailEntry.cliente) : detailEntry.cliente}</span></div>
              {detailEntry.tipo === "saida" ? (
                <>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Tipo despesa</span><span className="text-foreground">{detailEntry.tipoDespesa ?? "—"}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Destino</span><span className="text-foreground">{detailEntry.destinoPagamento ?? "—"}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Vencimento</span><span className="text-foreground">{detailEntry.dataVencimento ?? "—"}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Pago?</span><span className={cn("font-semibold", detailEntry.foiPago === "Sim" ? "text-status-success" : "text-destructive")}>{detailEntry.foiPago ?? "—"}</span></div>
                  {detailEntry.foiPago === "Sim" && (
                    <>
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Data pgto</span><span className="text-foreground">{detailEntry.dataPagamento ?? "—"}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Forma pgto</span><span className="font-medium text-foreground">{detailEntry.pagamento}</span></div>
                    </>
                  )}
                </>
              ) : (
                <>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Data</span><span className="text-foreground">{detailEntry.data}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Convênio</span><span className="text-foreground">{detailEntry.convenio ?? "—"}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Forma pgto</span><span className="font-medium text-foreground">{detailEntry.pagamento}</span></div>
                </>
              )}
              <div className="h-px bg-border/40" />
              <div className="flex justify-between text-sm font-bold"><span>Valor</span><span className={detailEntry.tipo === "saida" ? "text-destructive" : "text-foreground"}>{detailEntry.tipo === "saida" ? "- " : ""}{fmtBRL(detailEntry.valorTotal)}</span></div>
            </div>

            {detailAtendimento && (
              <>
                <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider">Exames</p>
                  {detailExames.map((e, i) => <div key={i} className="flex justify-between text-sm"><span className="text-muted-foreground">{e.nome}</span><span className="font-medium text-foreground">{fmtBRL(e.valor)}</span></div>)}
                  <div className="h-px bg-border/40" />
                  <div className="flex justify-between text-sm font-bold"><span>Total exames</span><span>{fmtBRL(detailTotalExames)}</span></div>
                </div>
                <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider">Pagamentos</p>
                  {(detailAtendimento.pagamentosRealizados ?? []).map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        {p.tipo === "PIX" && <QrCode className="h-3.5 w-3.5" />}
                        {p.tipo === "Dinheiro" && <Banknote className="h-3.5 w-3.5" />}
                        {(p.tipo === "Crédito" || p.tipo === "Débito" || p.tipo.includes("crédito") || p.tipo.includes("débito") || p.tipo.includes("Cartão")) && <CreditCard className="h-3.5 w-3.5" />}
                        {p.tipo} — {p.data}
                      </span>
                      <span className="font-medium text-foreground">{fmtBRL(p.valor)}</span>
                    </div>
                  ))}
                  <div className="h-px bg-border/40" />
                  <div className="flex justify-between text-sm font-bold"><span>Total pago</span><span className="text-status-success">{fmtBRL(detailTotalPago)}</span></div>
                </div>
                <div className="rounded-2xl bg-muted/30 p-4 space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Status atendimento</span><span className="font-medium">{detailAtendimento.statusAtendimento.label}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Status pagamento</span><span className="font-medium">{detailAtendimento.statusPagamento.label}</span></div>
                  <div className="h-px bg-border/40" />
                  <div className="flex justify-between text-sm font-bold"><span>Saldo devedor</span><span className={detailSaldo > 0.01 ? "text-destructive" : "text-status-success"}>{fmtBRL(Math.max(0, detailSaldo))}</span></div>
                </div>
              </>
            )}
          </div>
        )}
      </StandardDialog>

      {/* Confirmar pagamento (Pagar agora) */}
      <StandardDialog
        open={payDialogOpen}
        onClose={() => { setPayDialogOpen(false); setPayTarget(null); }}
        icon={<CheckCircle className="h-5 w-5 text-status-success" />}
        title="Confirmar pagamento"
        subtitle={payTarget ? `Protocolo ${payTarget.protocolo}` : undefined}
        maxWidth="lg"
        footer={
          <>
            <Button variant="outline" className="rounded-2xl" onClick={() => { setPayDialogOpen(false); setPayTarget(null); }}>Cancelar</Button>
            <Button className="rounded-2xl gap-2 bg-status-success text-white hover:bg-status-success/90" onClick={handleConfirmPay}>
              <CheckCircle className="h-4 w-4" />Confirmar pagamento
            </Button>
          </>
        }
      >
        {payTarget && (
          <div className="px-6 py-5 space-y-4">
            {/* Resumo */}
            <div className="rounded-2xl border border-border/50 bg-muted/15 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" />
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Despesa</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Descrição</span>
                  <span className="font-semibold text-foreground truncate ml-3">{payTarget.descricao || payTarget.cliente}</span>
                </div>
                {payTarget.tipoDespesa && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tipo</span>
                    <span className="text-foreground">{payTarget.tipoDespesa}</span>
                  </div>
                )}
                {payTarget.destinoPagamento && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Destino</span>
                    <span className="text-foreground">{payTarget.destinoPagamento}</span>
                  </div>
                )}
                {payTarget.dataVencimento && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Vencimento</span>
                    <span className="text-foreground">{payTarget.dataVencimento}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm pt-1 border-t border-border/50">
                  <span className="text-muted-foreground">Valor</span>
                  <span className="font-bold text-foreground tabular-nums">{fmtBRL(payTarget.valorTotal)}</span>
                </div>
              </div>
            </div>

            {/* Forma e data de pagamento */}
            <div className="rounded-2xl border border-border/50 bg-muted/15 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" />
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Pagamento</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Forma de pagamento <span className="text-destructive">*</span></Label>
                  <SearchableSelect
                    value={payForma}
                    onChange={setPayForma}
                    onCreateRequest={(typed) => openCriar("forma_pagamento", typed, (nome) => setPayForma(nome))}
                    options={formasPagamento}
                    placeholder="Selecione"
                    allowCreate
                    deletableOptions={deletableFormas}
                    onDelete={v => void handleDeleteItem("forma_pagamento", v)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pay-data" className="text-xs font-medium text-muted-foreground">Data do pagamento <span className="text-destructive">*</span></Label>
                  <Input
                    id="pay-data"
                    inputMode="numeric"
                    placeholder="dd/mm/aaaa"
                    maxLength={10}
                    value={payData}
                    onChange={e => setPayData(maskDateBR(e.target.value))}
                    aria-invalid={!isValidDateBR(payData)}
                    className={cn("rounded-xl h-10", !isValidDateBR(payData) && "border-destructive focus-visible:ring-destructive")}
                  />
                  {!isValidDateBR(payData) && (
                    <p className="text-[11px] text-destructive">Data inválida. Use dd/mm/aaaa.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </StandardDialog>

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
            void fetchSaldoEmAbertoPorConvenio().then(setSaldoConvenios);
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
  );
};

export default Financeiro;
