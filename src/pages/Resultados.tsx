import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, Calendar, Printer, FileText, ChevronLeft, ChevronRight,
  LayoutList, LayoutGrid, ClipboardList, Inbox, Eye, CheckCircle2, Clock, XCircle,
} from "lucide-react";
import { getAtendimentos, subscribe, isAtendimentosBooting, hasAtendimentosBooted } from "@/data/atendimentoStore";
import type { MockAtendimento } from "@/data/types";
import { formatIdadeDetalhada } from "@/lib/idade";
import { fireSuccessConfetti } from "@/lib/confetti";
import SuccessOverlay from "@/components/SuccessOverlay";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useFeatureFlag } from "@/lib/featureFlags";
import { useResultadosPage, type ResultadoPageRow, isStatusAllowedForResultados } from "@/hooks/useResultadosPage";
import { PageHeader } from "@/components/shared/PageHeader";

type ResultStatus = "Finalizado" | "Pendente" | "Cancelado";

interface Resultado {
  id: number;
  nome: string;
  nascimento: string;
  idade: string;
  protocolo: string;
  dataCadastro: string;
  status: ResultStatus;
  motivoCancelamento?: string;
  analistas: string[];
  /** Bandeira independente do status — exibida como pílula extra. */
  temRetificacao?: boolean;
}

const statusConfig: Record<ResultStatus, { dot: string; text: string; bg: string; bar: string }> = {
  Finalizado: { dot: "bg-[hsl(var(--status-success))]", text: "text-[hsl(var(--status-success))]", bg: "bg-[hsl(var(--status-success-bg))]", bar: "bg-[hsl(var(--status-success))]" },
  Pendente:   { dot: "bg-[hsl(var(--status-warning))]", text: "text-[hsl(var(--status-warning))]", bg: "bg-[hsl(var(--status-warning-bg))]", bar: "bg-[hsl(var(--status-warning))]" },
  Cancelado:  { dot: "bg-[hsl(var(--status-danger))]",  text: "text-[hsl(var(--status-danger))]",  bg: "bg-[hsl(var(--status-danger-bg))]",  bar: "bg-[hsl(var(--status-danger))]" },
};

const tabs: Array<{ label: string; key: "todos" | ResultStatus }> = [
  { label: "Todos",       key: "todos" },
  { label: "Finalizados", key: "Finalizado" },
  { label: "Pendentes",   key: "Pendente" },
  { label: "Cancelados",  key: "Cancelado" },
];

const avatarColors = [
  "bg-[hsl(var(--status-info-bg))] text-[hsl(var(--status-info))]",
  "bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning))]",
  "bg-[hsl(var(--status-success-bg))] text-[hsl(var(--status-success))]",
  "bg-[hsl(var(--status-purple-bg))] text-[hsl(var(--status-purple))]",
];

const normalize = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function mapStatus(label: string): ResultStatus {
  const l = label.toLowerCase();
  if (l.includes("cancel")) return "Cancelado";
  if (l.includes("liberado") || l.includes("finaliz")) return "Finalizado";
  return "Pendente";
}

function buildIniciais(nome: string): string {
  const parts = nome.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function fromAtendimento(a: MockAtendimento, idx: number): Resultado {
  return {
    id: idx + 1,
    nome: a.nome,
    nascimento: a.nascimento,
    idade: formatIdadeDetalhada(a.nascimento),
    protocolo: a.protocolo,
    dataCadastro: a.data, // já vem como "DD/MM/YYYY HH:mm:ss"
    status: mapStatus(a.statusAtendimento.label),
    motivoCancelamento: a.motivoCancelamento,
    analistas: a.solicitante ? [buildIniciais(a.solicitante)] : [],
    temRetificacao: Array.isArray(a.exames)
      ? a.exames.some((e) => (e as { retificado?: boolean }).retificado === true)
      : false,
  };
}

/**
 * Indica se o atendimento deve aparecer em /resultados.
 * Apenas atendimentos cujos exames já estão `em_analise`, `finalizado`/`liberado`
 * ou totalmente cancelados pertencem à etapa de Resultados.
 * Bloqueia explicitamente "Pedido Realizado" (todos pendentes) e
 * "Amostra Coletada" (sem nenhum exame analisado).
 */
function isAtendimentoElegivelResultados(label: string | undefined | null): boolean {
  return isStatusAllowedForResultados(label);
}

function fmtBr(d: string | null): string {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}
function fmtBrDate(d: string | null): string {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()}`;
}
function fromRpcRow(r: ResultadoPageRow, idx: number): Resultado {
  const nome = r.paciente_nome ?? "";
  const nascimentoBr = fmtBrDate(r.paciente_nascimento);
  return {
    id: idx + 1,
    nome,
    nascimento: nascimentoBr,
    idade: r.paciente_nascimento ? formatIdadeDetalhada(r.paciente_nascimento) : "",
    protocolo: r.protocolo,
    dataCadastro: fmtBr(r.data),
    status: mapStatus(r.status_resultado),
    motivoCancelamento: r.motivo_cancelamento ?? undefined,
    analistas: r.solicitante ? [buildIniciais(r.solicitante)] : [],
    temRetificacao: r.tem_retificacao === true,
  };
}

const Resultados = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebouncedValue(searchQuery, 250);
  const [motivoDialogOpen, setMotivoDialogOpen] = useState(false);
  const [selectedMotivo, setSelectedMotivo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [, setTick] = useState(0);
  const [successDialog, setSuccessDialog] = useState(false);
  const [hadPendentes, setHadPendentes] = useState(false);
  const itemsPerPage = 10;

  // ── Canary: RPC paginada quando flag ON e legacy OFF ──
  const ffPaginated = useFeatureFlag("paginated_atendimentos");
  const ffLegacy = useFeatureFlag("USE_LEGACY_STORE");
  const useRpc = ffPaginated && !ffLegacy;

  // Caminho legado (cache global) — só assina quando NÃO está em RPC
  useEffect(() => {
    if (useRpc) return;
    return subscribe(() => setTick((t) => t + 1));
  }, [useRpc]);

  const tabKeyAtual = tabs[activeTab].key;
  const rpcStatus = useMemo<string | undefined>(() => {
    // Mapeia tab → status canônico no banco. "Todos" = sem filtro.
    if (useRpc !== true) return undefined;
    if (tabKeyAtual === "Finalizado") return "Resultado liberado";
    if (tabKeyAtual === "Cancelado")  return "Pedido cancelado";
    // "Pendente" agrega múltiplos status no banco; deixar sem filtro server-side
    // e filtrar no cliente (mesmo critério do mapStatus). "Todos" idem.
    return undefined;
  }, [useRpc, tabKeyAtual]);

  const rpc = useResultadosPage(
    { status: rpcStatus, q: debouncedQuery },
    useRpc,
  );

  // Auto-pagina até esgotar a fonte ou hit do cap (5 páginas = 250).
  // Mantém compatibilidade com paginação numerada existente do JSX.
  useEffect(() => {
    if (!useRpc) return;
    if (rpc.loading || rpc.loadingMore) return;
    if (rpc.hasMore) void rpc.loadMore();
  }, [useRpc, rpc.loading, rpc.loadingMore, rpc.hasMore, rpc.loadMore, rpc.items.length]);

  const resultados: Resultado[] = useMemo(() => {
    if (useRpc) {
      // RPC já vem filtrada pelo hook (defesa em profundidade), mas
      // re-aplicamos o predicate para reforçar a invariante na tela.
      return rpc.items
        .filter((r) => isAtendimentoElegivelResultados(r.status_resultado))
        .map(fromRpcRow);
    }
    return getAtendimentos()
      .filter((a) => isAtendimentoElegivelResultados(a.statusAtendimento.label))
      .map(fromAtendimento);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useRpc, rpc.items]);

  const filtered = resultados.filter((item) => {
    const q = normalize(debouncedQuery);
    const hasSearch = q.length > 0;
    const tabKey = tabs[activeTab].key;
    const tabMatchesItem = tabKey === item.status;
    const tabFilter = hasSearch || tabKey === "todos" || tabMatchesItem;
    const matchSearch = !q || normalize(item.nome).includes(q) || normalize(item.protocolo).includes(q);
    return tabFilter && matchSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const finalizadosCount = resultados.filter(r => r.status === "Finalizado").length;
  const pendentesCount   = resultados.filter(r => r.status === "Pendente").length;
  const canceladosCount  = resultados.filter(r => r.status === "Cancelado").length;

  // Detecta quando todos os pendentes foram liberados (pendentes: >0 → 0)
  useEffect(() => {
    if (resultados.length === 0) return;
    if (pendentesCount > 0) {
      setHadPendentes(true);
    } else if (hadPendentes) {
      setSuccessDialog(true);
      setHadPendentes(false);
      fireSuccessConfetti();
    }
  }, [pendentesCount, resultados.length, hadPendentes]);

  const StatusPill = ({ status }: { status: ResultStatus }) => {
    const c = statusConfig[status];
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium ${c.bg} ${c.text}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
        {status}
      </span>
    );
  };

  const RetificacaoPill = () => (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning))]"
      title="Algum exame deste atendimento está em retificação"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--status-warning))]" />
      Em retificação
    </span>
  );

  const SummaryChip = ({ icon: Icon, label, value, tone }: { icon: typeof Clock; label: string; value: number; tone: "warning" | "success" | "danger" }) => {
    const map = {
      warning: "text-[hsl(var(--status-warning))] bg-[hsl(var(--status-warning-bg))]",
      success: "text-[hsl(var(--status-success))] bg-[hsl(var(--status-success-bg))]",
      danger:  "text-[hsl(var(--status-danger))] bg-[hsl(var(--status-danger-bg))]",
    } as const;
    return (
      <div className={`flex items-center gap-2 px-3 h-9 rounded-lg ${map[tone]}`}>
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">{label}</span>
        <span className="text-sm font-semibold tabular-nums">{value}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 animate-fade-in">

        <PageHeader
          eyebrow="Operacional"
          title="Inserir Resultados"
          description={`${filtered.length} ${filtered.length === 1 ? "resultado encontrado" : "resultados encontrados"}`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <SummaryChip icon={CheckCircle2} label="Finalizados" value={finalizadosCount} tone="success" />
              <SummaryChip icon={Clock}        label="Pendentes"   value={pendentesCount}   tone="warning" />
              <SummaryChip icon={XCircle}      label="Cancelados"  value={canceladosCount}  tone="danger" />
            </div>
          }
        />


        {/* ─── Toolbar (filtros + busca + view) ─── */}
        <div className="bg-card rounded-xl border border-border p-3 mb-5">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            {/* Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar bg-muted/50 rounded-lg p-1 shrink-0">
              {tabs.map((tab, index) => (
                <button
                  key={tab.label}
                  onClick={() => { setActiveTab(index); setCurrentPage(1); }}
                  className={`h-8 px-3.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                    activeTab === index
                      ? "bg-card text-foreground shadow-elevation-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="Buscar por nome ou protocolo…"
                className="pl-10 pr-4 h-10 w-full bg-muted/40 border border-transparent rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-background focus:border-border transition-all"
              />
            </div>
            {/* View mode */}
            <div className="flex items-center bg-muted/50 rounded-lg p-1 shrink-0">
              <button
                onClick={() => setViewMode("list")}
                className={`h-8 w-8 rounded-md flex items-center justify-center transition-all ${
                  viewMode === "list" ? "bg-card text-foreground shadow-elevation-xs" : "text-muted-foreground hover:text-foreground"
                }`}
                title="Lista"
              >
                <LayoutList className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`h-8 w-8 rounded-md flex items-center justify-center transition-all ${
                  viewMode === "grid" ? "bg-card text-foreground shadow-elevation-xs" : "text-muted-foreground hover:text-foreground"
                }`}
                title="Cartões"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ─── Conteúdo ─── */}
        {paginated.length === 0 ? (
          <div className="bg-card rounded-xl border border-border flex flex-col items-center py-16 text-center px-8">
            <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <Inbox className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <h2 className="text-base font-semibold text-foreground mb-1">
              Nenhum exame pronto para liberação
            </h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Esta página exibe apenas exames em <span className="font-medium text-foreground">análise</span>,{" "}
              <span className="font-medium text-foreground">finalizados</span> ou{" "}
              <span className="font-medium text-foreground">liberados</span>. Exames ainda pendentes de coleta ou análise não aparecem aqui.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
              <button
                onClick={() => navigate("/registrar-coleta")}
                className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
              >
                Ir para Registrar Coleta
              </button>
              <button
                onClick={() => navigate("/analisar-amostra")}
                className="h-9 px-4 rounded-lg border border-border bg-card text-foreground text-xs font-semibold hover:bg-accent transition-colors"
              >
                Ir para Analisar Amostra
              </button>
            </div>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 animate-fade-in-up">
            {paginated.map((item) => {
              const c = statusConfig[item.status];
              return (
                <div
                  key={item.id}
                  className="relative bg-card border border-border rounded-xl overflow-hidden flex flex-col transition-all duration-150 hover:border-border/80 hover:shadow-elevation-sm"
                >
                  <span className={`absolute top-0 left-0 h-full w-1 ${c.bar}`} />
                  <div className="p-4 pl-5 flex-1">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="h-10 w-10 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0">
                          {buildIniciais(item.nome)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground leading-tight truncate">{item.nome}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{item.idade}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        <StatusPill status={item.status} />
                        
                      </div>
                    </div>

                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground w-16 shrink-0">Protocolo</span>
                        <span className="font-mono font-semibold text-foreground truncate">{item.protocolo}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-muted-foreground w-16 shrink-0">Data</span>
                        <span className="text-foreground inline-flex items-center gap-1 tabular-nums">
                          <Calendar className="h-3 w-3 shrink-0 mt-0.5" />
                          {(() => {
                            const [data, hora] = item.dataCadastro.split(" ");
                            return <>{data}{hora && <span className="text-muted-foreground ml-1">{hora}</span>}</>;
                          })()}
                        </span>
                      </div>
                    </div>

                    {item.status === "Cancelado" && item.motivoCancelamento && (
                      <button
                        onClick={() => { setSelectedMotivo(item.motivoCancelamento!); setMotivoDialogOpen(true); }}
                        className="mt-3 text-[11px] font-medium text-[hsl(var(--status-warning))] hover:underline"
                      >
                        Ver motivo do cancelamento
                      </button>
                    )}
                  </div>

                  <div className="px-4 pl-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between">
                    <div className="flex -space-x-1.5">
                      {item.analistas.length > 0 ? item.analistas.map((ini, i) => (
                        <span key={i} className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-card ${avatarColors[i % avatarColors.length]}`}>
                          {ini}
                        </span>
                      )) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {item.status === "Finalizado" && (
                        <button className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" title="Imprimir">
                          <Printer className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => navigate(`/resultado/${item.protocolo}`)}
                        className="h-8 px-3 rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors inline-flex items-center gap-1.5"
                      >
                        <Eye className="h-3.5 w-3.5" /> Abrir
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden animate-fade-in-up">
            {/* Mobile: stacked rows (no horizontal scroll) */}
            <div className="md:hidden divide-y divide-border">
              {paginated.map((item) => {
                const c = statusConfig[item.status];
                return (
                  <div key={item.id} className="relative p-4 pl-5 hover:bg-accent/30 transition-colors">
                    <span className={`absolute top-0 left-0 h-full w-1 ${c.bar}`} />
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="h-9 w-9 rounded-full bg-primary/10 text-primary text-[11px] font-semibold flex items-center justify-center shrink-0">
                          {buildIniciais(item.nome)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{item.nome}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{item.nascimento} · {item.idade}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        <StatusPill status={item.status} />
                        
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[11px] mb-3">
                      <span className="font-mono font-semibold text-foreground truncate">{item.protocolo}</span>
                      <span className="text-muted-foreground tabular-nums whitespace-nowrap">{item.dataCadastro}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex -space-x-1.5">
                        {item.analistas.length > 0 ? item.analistas.slice(0, 3).map((ini, i) => (
                          <span key={i} className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-card ${avatarColors[i % avatarColors.length]}`}>
                            {ini}
                          </span>
                        )) : <span className="text-[11px] text-muted-foreground">—</span>}
                      </div>
                      <button
                        onClick={() => navigate(`/resultado/${item.protocolo}`)}
                        className="h-8 px-3 rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors inline-flex items-center gap-1.5"
                      >
                        <Eye className="h-3.5 w-3.5" /> Abrir
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tablet/Desktop: table without horizontal scroll */}
            <div className="hidden md:block">
              <table className="w-full text-sm table-fixed">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Paciente</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-[140px] hidden lg:table-cell">Protocolo</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-[110px]">Data</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-[120px]">Status</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-[120px] hidden xl:table-cell">Analistas</th>
                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-[110px]">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((item) => {
                    const c = statusConfig[item.status];
                    return (
                      <tr key={item.id} className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors duration-150 group">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className={`h-1 w-1 rounded-full ${c.bar} hidden`} />
                            <div className="h-9 w-9 rounded-full bg-primary/10 text-primary text-[11px] font-semibold flex items-center justify-center shrink-0">
                              {buildIniciais(item.nome)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{item.nome}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{item.nascimento} · {item.idade}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell"><span className="font-mono text-xs font-semibold text-foreground truncate block">{item.protocolo}</span></td>
                        <td className="px-4 py-3 tabular-nums">
                          {(() => {
                            const [data, hora] = item.dataCadastro.split(" ");
                            return (
                              <div className="flex flex-col leading-tight">
                                <span className="text-xs font-medium text-foreground">{data}</span>
                                {hora && <span className="text-[11px] text-muted-foreground">{hora}</span>}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <StatusPill status={item.status} />
                            
                            {item.status === "Cancelado" && item.motivoCancelamento && (
                              <button
                                onClick={() => { setSelectedMotivo(item.motivoCancelamento!); setMotivoDialogOpen(true); }}
                                className="text-[11px] font-medium text-[hsl(var(--status-warning))] hover:underline hidden xl:inline truncate"
                              >
                                Motivo
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden xl:table-cell">
                          <div className="flex -space-x-1.5">
                            {item.analistas.length > 0 ? item.analistas.slice(0, 3).map((ini, i) => (
                              <span key={i} className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-card ${avatarColors[i % avatarColors.length]}`}>
                                {ini}
                              </span>
                            )) : <span className="text-xs text-muted-foreground">—</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => navigate(`/resultado/${item.protocolo}`)}
                            className="h-8 px-3 rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors inline-flex items-center gap-1.5"
                          >
                            <Eye className="h-3.5 w-3.5" /> Abrir
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── Paginação ─── */}
        {filtered.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 py-5">
            <span className="text-xs text-muted-foreground">
              Mostrando <span className="font-semibold text-foreground tabular-nums">{Math.min((currentPage - 1) * itemsPerPage + 1, filtered.length)}–{Math.min(currentPage * itemsPerPage, filtered.length)}</span> de <span className="font-semibold text-foreground tabular-nums">{filtered.length}</span>
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                .map((page, idx, arr) => (
                  <div key={page} className="flex items-center">
                    {idx > 0 && page - arr[idx - 1] > 1 && <span className="text-xs text-muted-foreground px-1">…</span>}
                    <button
                      onClick={() => setCurrentPage(page)}
                      className={`h-8 min-w-8 px-2 rounded-md text-xs font-medium transition-colors tabular-nums ${
                        page === currentPage
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-accent"
                      }`}
                    >
                      {page}
                    </button>
                  </div>
                ))}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Motivo dialog ─── */}
      {motivoDialogOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-foreground/40 backdrop-blur-[6px]" onClick={() => setMotivoDialogOpen(false)} />
          <div className="relative bg-card rounded-xl border border-border shadow-elevation-lg w-full max-w-md p-6 animate-fade-in-up">
            <div className="flex items-start gap-3 mb-4">
              <div className="h-10 w-10 rounded-lg bg-[hsl(var(--status-warning-bg))] flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-[hsl(var(--status-warning))]" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">Motivo do cancelamento</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Detalhes informados ao cancelar o atendimento.</p>
              </div>
            </div>
            <div className="bg-muted/40 rounded-lg p-4 text-sm text-foreground mb-5">{selectedMotivo}</div>
            <div className="flex justify-end">
              <button onClick={() => setMotivoDialogOpen(false)} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Sucesso: todos os pendentes liberados ─── */}
      <SuccessOverlay
        open={successDialog}
        onClose={() => setSuccessDialog(false)}
        title="Todos os resultados liberados!"
        description="Não há mais exames pendentes na fila. Excelente trabalho!"
      />
    </div>
  );
};

export default Resultados;
