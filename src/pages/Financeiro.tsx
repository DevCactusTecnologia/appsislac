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
import { getAtendimentos, subscribe as subscribeAtendimentos, updateAtendimento, fetchAtendimentoByProtocolo } from "@/data/atendimentoStore";
import { calculateExamPrice } from "@/domains/appointment/services/pricing";
import PagamentoDialog from "@/components/PagamentoDialog";

import type { MockAtendimento, PagamentoRealizado } from "@/data/types";
// getConvenios removido — A Receber/Convênios agora vem da RPC v2 (Fase 1).
import {
  getSaidas, subscribeFinanceiro, updateSaida,
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
  buildAReceberRowsFromRpc,
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
import { computePainelKpis } from "./Financeiro/services/computePainelKpis";
import { validatePayment } from "./Financeiro/services/validatePayment";
import { computeDetailTotals } from "./Financeiro/services/computeDetailTotals";
import { todayBR } from "./Financeiro/services/todayBR";
import CaixaTab from "./Financeiro/components/CaixaTab";
import EntradasTab from "./Financeiro/components/EntradasTab";
import SaidasTab from "./Financeiro/components/SaidasTab";
import AReceberTab from "./Financeiro/components/AReceberTab";
import ConveniosTab from "./Financeiro/components/ConveniosTab";
import PainelTab from "./Financeiro/components/PainelTab";
import { FinanceiroProvider, type FinanceiroContextValue } from "./Financeiro/FinanceiroContext";
import { computePeriodoRange } from "./Financeiro/services/periodoRapido";
import EditEntryDialog from "./Financeiro/components/dialogs/EditEntryDialog";
import EstornarDialog from "./Financeiro/components/dialogs/EstornarDialog";
import { estornarFinanceiro } from "./Financeiro/services/estornarFinanceiro";
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
  // saldoConvenios removido — agora servido por useAReceberConvenios (Fase 1 V2).

  

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
  // Painel também precisa dos dados de A Receber para o card "A Receber" e
  // para o card "Convênios Pendentes" — não basta carregar só na aba dedicada.
  const aReceberEnabled = activeTab === "a_receber" || activeTab === "painel";
  const {
    rows:    rpcRows,
    loading: rpcLoading,
    hasMore: rpcHasMore,
    loadMore: rpcLoadMore,
    refresh: rpcRefresh,
  } = useAReceberPacientes(aReceberEnabled, {
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
    if (!aReceberEnabled) return [];
    return buildAReceberRowsFromRpc(rpcRows);
  }, [aReceberEnabled, rpcRows]);

  // Após mutações no atendimentoStore, refresca o RPC (não confiar em cache local).
  useEffect(() => {
    const unsub = subscribeAtendimentos(() => { rpcRefresh(); });
    return unsub;
  }, [rpcRefresh]);

  // Convênios — V2 (substitui fetchSaldoEmAbertoPorConvenio)
  const {
    rows: aReceberConvenioRowsV2,
    refresh: refreshConvenios,
  } = useAReceberConvenios(aReceberEnabled);
  const aReceberConvenioRows: AReceberConvenioRow[] = useMemo(
    () => aReceberConvenioRowsV2.map((r) => ({
      convenioId:    r.convenioId,
      convenioNome:  r.convenioNome,
      saldo:         Math.round(r.saldo * 100) / 100,
      qtdExames:     r.qtdExames,
      qtdPacientes:  r.qtdPacientes,
      desde:         r.desde,
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

  // ─── Modal "Pagamento" padrão (mesmo de /atendimento) para A Receber ───
  const [pagModalOpen, setPagModalOpen] = useState(false);
  const [pagAtendimento, setPagAtendimento] = useState<MockAtendimento | null>(null);
  const [pagLocalPagamentos, setPagLocalPagamentos] = useState<PagamentoRealizado[]>([]);

  // Handler: abre o PagamentoDialog (modal padrão) hidratado com o atendimento.
  const handleAReceberPagar = async (row: AReceberRow) => {
    let at: MockAtendimento | null = getAtendimentos().find(a => a.protocolo === row.protocolo) ?? null;
    // Se não tem exames/pagamentos hidratados, busca do servidor.
    const hidratado = !!(at && ((at.exames?.length ?? 0) > 0 || (at.pagamentosRealizados?.length ?? 0) > 0));
    if (!at || !hidratado) {
      const fetched = await fetchAtendimentoByProtocolo(row.protocolo);
      if (fetched) at = fetched;
    }
    if (!at) {
      toast({ title: "Atendimento não encontrado", variant: "destructive" });
      return;
    }
    setPagAtendimento(at);
    setPagLocalPagamentos([...(at.pagamentosRealizados ?? [])]);
    setPagModalOpen(true);
  };

  const pagamentoData = useMemo(() => {
    if (!pagAtendimento) {
      return { itens: 0, subtotal: 0, desconto: 0, total: 0, valorPago: 0, saldoDevedor: 0,
               pagamentosRealizados: [] as PagamentoRealizado[], exames: [] as { nome: string; valor: number }[] };
    }
    const convenioNome = pagAtendimento.convenio ?? "Particular";
    const examesPaciente = (pagAtendimento.examesCobranca ?? pagAtendimento.exames.map(nome => ({
      nome, cobrancaDestino: "paciente" as const, valor: 0, valorOriginal: 0,
    })))
      .filter(c => c.cobrancaDestino !== "convenio")
      .map(e => {
        const valor = Number(e.valor) || 0;
        const valorTabela = calculateExamPrice({ nomeExame: e.nome, convenioNome });
        const valorOriginal = Math.max(Number(e.valorOriginal) || 0, valor, valorTabela);
        return { ...e, valor, valorOriginal };
      });
    const subtotal = examesPaciente.reduce((s, e) => s + e.valorOriginal, 0);
    const totalEfetivo = examesPaciente.reduce((s, e) => s + e.valor, 0);
    const ajusteCents = Math.round((totalEfetivo - subtotal) * 100);
    const descontoHistorico = ajusteCents < 0 ? Math.abs(ajusteCents) / 100 : 0;
    const acrescimoHistorico = ajusteCents > 0 ? ajusteCents / 100 : 0;
    const totalPago = (pagLocalPagamentos ?? []).reduce((s, p) => s + p.valor, 0);
    return {
      itens: examesPaciente.length,
      subtotal,
      desconto: descontoHistorico,
      acrescimo: acrescimoHistorico,
      total: totalEfetivo,
      valorPago: totalPago,
      saldoDevedor: Math.max(0, totalEfetivo - totalPago),
      pagamentosRealizados: pagLocalPagamentos ?? [],
      exames: examesPaciente.map(e => ({ nome: e.nome, valor: e.valorOriginal })),
    };
  }, [pagAtendimento, pagLocalPagamentos]);

  const handlePagamentoConfirm = async (resultado: { valorPago: number; desconto: number; acrescimo: number; novosPagamentos: PagamentoRealizado[] }) => {
    if (!pagAtendimento) return;
    const novos = resultado.novosPagamentos ?? [];
    const pagamentosFinais = [...(pagLocalPagamentos ?? []), ...novos];
    const acrescimo = Math.max(0, Math.round((resultado.acrescimo || 0) * 100) / 100);
    const desconto = Math.max(0, Math.round((resultado.desconto || 0) * 100) / 100);
    const totalAjustado = pagamentoData.subtotal - desconto + acrescimo;
    const totalPagoFinal = pagamentosFinais.reduce((s, p) => s + p.valor, 0);
    const statusPag = totalPagoFinal >= totalAjustado && totalAjustado > 0
      ? { label: "Pagamento efetuado", type: "success" as const }
      : totalPagoFinal > 0
        ? { label: "Pagamento parcial", type: "info" as const }
        : { label: "Pagamento pendente", type: "warning" as const };

    // Apenas os NOVOS pagamentos são enviados ao backend (RPC aditiva).
    const updates: Partial<MockAtendimento> = {
      pagamentosRealizados: novos,
      statusPagamento: statusPag,
    };
    const ajusteLiquidoCents = Math.round((acrescimo - desconto) * 100);
    const examesCobrancaAtuais = pagAtendimento.examesCobranca;
    if (ajusteLiquidoCents !== 0 && examesCobrancaAtuais && examesCobrancaAtuais.length > 0) {
      const pacienteIdxs = examesCobrancaAtuais
        .map((e, i) => ({ e, i }))
        .filter(({ e }) => e.cobrancaDestino !== "convenio");
      const baseOriginalPorIdx = new Map<number, number>();
      pacienteIdxs.forEach(({ e, i }) => {
        const orig = Number(e.valorOriginal) > 0 ? Number(e.valorOriginal) : (Number(e.valor) || 0);
        baseOriginalPorIdx.set(i, orig);
      });
      const subtotalOriginalCents = Array.from(baseOriginalPorIdx.values()).reduce((s, v) => s + Math.round(v * 100), 0);
      if (subtotalOriginalCents > 0) {
        const ajusteCentsClamped = ajusteLiquidoCents < 0
          ? Math.max(ajusteLiquidoCents, -subtotalOriginalCents)
          : ajusteLiquidoCents;
        let restante = ajusteCentsClamped;
        const novosValores = new Map<number, number>();
        pacienteIdxs.forEach(({ i }, idx) => {
          const origCents = Math.round((baseOriginalPorIdx.get(i) ?? 0) * 100);
          const isLast = idx === pacienteIdxs.length - 1;
          const share = isLast ? restante : Math.round((origCents / subtotalOriginalCents) * ajusteCentsClamped);
          restante -= share;
          const novoCents = Math.max(0, origCents + share);
          novosValores.set(i, novoCents / 100);
        });
        const novaCobranca = examesCobrancaAtuais.map((e, i) => {
          const orig = baseOriginalPorIdx.get(i);
          if (orig == null) return e;
          return { ...e, valorOriginal: orig, valor: novosValores.has(i) ? novosValores.get(i)! : orig };
        });
        updates.examesCobranca = novaCobranca;
        updates.exames = novaCobranca.map(e => e.nome);
      }
    }

    try {
      await updateAtendimento(pagAtendimento.protocolo, updates);
      setPagLocalPagamentos(pagamentosFinais);
      void refreshEntradas();
      rpcRefresh();
      toast({ title: "Pagamento atualizado", description: `Status alterado para "${statusPag.label}"` });
      setPagModalOpen(false);
      setPagAtendimento(null);
    } catch (e) {
      toast({ title: "Falha ao atualizar pagamento", description: (e as Error)?.message, variant: "destructive" });
    }
  };


  const handleRemovePagamentoRealizado = (index: number) => {
    setPagLocalPagamentos(prev => (prev ?? []).filter((_, i) => i !== index));
  };

  const summary = useMemo(
    () => computeFinanceiroSummary(activeTab, entradas, filtered),
    [filtered, entradas, activeTab],
  );

  // Painel (Fase 3 V2) — 6 KPIs derivados de entradas/saídas/A Receber.
  const painelKpis = useMemo(
    () => computePainelKpis(entradas, saidas, aReceberSource, aReceberConvenioRows),
    [entradas, saidas, aReceberSource, aReceberConvenioRows],
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
  // Fase 9 — Excluir foi substituído por Estornar formal.
  // O alvo do estorno guarda o entry inteiro para resolvermos (tipo, id) na confirmação.
  const [estornoTarget, setEstornoTarget] = useState<FinanceiroEntry | null>(null);
  const handleDeleteClick = (entry: FinanceiroEntry) => {
    setEstornoTarget(entry);
    setDeletingProtocolo(entry.protocolo);
    setDeleteDialogOpen(true);
  };
  const handleEstornarConfirm = async (motivo: string) => {
    if (!estornoTarget) return;
    try {
      let tipo: "pagamento" | "fatura" | "saida";
      let id: number | null = null;
      if (estornoTarget.tipo === "saida") {
        tipo = "saida";
        id = estornoTarget.saidaId ?? null;
      } else if (estornoTarget.origem === "fatura_convenio") {
        tipo = "fatura";
        id = estornoTarget.faturaId ?? null;
      } else {
        tipo = "pagamento";
        id = estornoTarget.pagamentoId ?? null;
      }
      if (!id) {
        toast({ title: "Não foi possível identificar o registro para estorno", variant: "destructive" });
        return;
      }
      await estornarFinanceiro(tipo, id, motivo);
      toast({ title: "Estorno registrado", description: `Protocolo ${estornoTarget.protocolo} estornado.` });
      setDeleteDialogOpen(false);
      setEstornoTarget(null);
      setDeletingProtocolo("");
      // Refresca dados afetados.
      if (tipo === "saida") {
        // financeiroStore reflete via subscribe ao próximo poll/realtime; força reload simples.
        await import("@/data/financeiroStore").then(m => m._initFinanceiroStore());
      } else {
        await refreshEntradas();
      }
    } catch {
      // showError já notificou via service.
    }
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

  const {
    totalExames: detailTotalExames,
    subtotalExames: detailSubtotalExames,
    descontoExames: detailDescontoExames,
    totalPago: detailTotalPago,
    saldo: detailSaldo,
  } = computeDetailTotals(detailExames, detailAtendimento);

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
    painelKpis,
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
    periodoRapido, aplicarPeriodoRapido,
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

      {/* ─── Tab Navigation (Segmentado moderno) ─── */}
      <div className="overflow-x-auto no-scrollbar">
        <nav className="inline-flex items-center p-1.5 bg-muted/50 border border-border/60 rounded-xl">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setCurrentPage(1); }}
                className={cn(
                  "flex items-center gap-2.5 px-4 py-2 rounded-lg text-sm transition-all whitespace-nowrap cursor-pointer",
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                    : "text-muted-foreground font-medium hover:text-foreground hover:bg-muted",
                )}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>


      <>

          {/* ─── Aba Integrações: histórico de webhooks dos gateways ─── */}
          {activeTab === "integracoes" && canSeeIntegracoes && (
            <IntegracoesWebhookPanel />
          )}

          {/* ─── Tabs Entradas e Saídas (Fase 4 — Passo 3): consomem FinanceiroContext ─── */}
          {activeTab === "saida" && <SaidasTab />}
          {activeTab === "entrada" && <EntradasTab />}

          {/* ─── Tab Painel (Fase 3 V2) ─── */}
          {activeTab === "painel" && <PainelTab />}

          {/* ─── Tab A Receber (Fase 4 — Passo 4): consome FinanceiroContext ─── */}
          {activeTab === "a_receber" && <AReceberTab />}

          {/* ─── Tab Convênios (Fase 7): área dedicada (em aberto + faturas) ─── */}
          {activeTab === "convenios" && <ConveniosTab />}



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

      <EstornarDialog
        open={deleteDialogOpen}
        protocolo={deletingProtocolo}
        tipoLabel={
          estornoTarget?.tipo === "saida"
            ? "Despesa"
            : estornoTarget?.origem === "fatura_convenio"
              ? "Fatura"
              : "Recebimento"
        }
        onClose={() => { setDeleteDialogOpen(false); setEstornoTarget(null); }}
        onConfirm={handleEstornarConfirm}
      />

      <DetailEntryDialog
        open={detailDialogOpen}
        detailEntry={detailEntry}
        detailAtendimento={detailAtendimento}
        detailExames={detailExames}
        detailTotalExames={detailTotalExames}
        detailSubtotalExames={detailSubtotalExames}
        detailDescontoExames={detailDescontoExames}
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


      {/* Receber pagamento (A Receber) — usa o modal "Pagamento" padrão (mesmo de /atendimento) */}
      <PagamentoDialog
        open={pagModalOpen}
        onClose={() => { setPagModalOpen(false); setPagAtendimento(null); }}
        itens={pagamentoData.itens}
        subtotal={pagamentoData.subtotal}
        desconto={pagamentoData.desconto}
        acrescimo={pagamentoData.acrescimo}
        total={pagamentoData.total}
        valorPago={pagamentoData.valorPago}
        saldoDevedor={pagamentoData.saldoDevedor}
        exames={pagamentoData.exames}
        pagamentosRealizados={pagamentoData.pagamentosRealizados}
        onRemovePagamentoRealizado={handleRemovePagamentoRealizado}
        onConfirm={handlePagamentoConfirm}
        descontoData={pagAtendimento?.data}
        acrescimoData={pagAtendimento?.data}
        isEditing={true}
      />


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
