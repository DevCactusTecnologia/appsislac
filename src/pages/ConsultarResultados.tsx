import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, Calendar, Printer, FileText, ChevronLeft, ChevronRight,
  LayoutList, LayoutGrid, ClipboardList, Inbox, Eye, CheckCircle2, Clock, XCircle,
} from "lucide-react";
import { getAtendimentos, subscribe } from "@/data/atendimentoStore";
import type { MockAtendimento } from "@/data/types";
import { formatIdadeDetalhada } from "@/lib/idade";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useFeatureFlag, isFeatureEnabled } from "@/lib/featureFlags";
import { useResultadosPage } from "@/hooks/useResultadosPage";
import { PageHeader } from "@/components/shared/PageHeader";

/**
 * /consultar-resultados
 *
 * Versão somente-leitura da página /resultados, voltada para CONFERÊNCIA
 * e IMPRESSÃO de laudos. Não permite editar, salvar, liberar nem
 * solicitar recoleta — todas as ações de escrita são realizadas em
 * /resultados pela equipe técnica.
 *
 * Reaproveita os mesmos dados (atendimentoStore) e a mesma página de
 * detalhe (ResultadoDetalhe), que entra em modo consulta via ?modo=consulta.
 */

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
    dataCadastro: a.data,
    status: mapStatus(a.statusAtendimento.label),
    motivoCancelamento: a.motivoCancelamento,
    analistas: a.solicitante ? [buildIniciais(a.solicitante)] : [],
    temRetificacao: Array.isArray(a.exames)
      ? a.exames.some((e) => (e as { retificado?: boolean }).retificado === true)
      : false,
  };
}

/** Formata "YYYY-MM-DD HH:mm:ss" do RPC para o padrão "dd/MM/yyyy HH:mm" usado na UI. */
function formatDataRPC(iso: string): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return iso;
  const [, y, mo, d, hh, mm] = m;
  return hh ? `${d}/${mo}/${y} ${hh}:${mm}` : `${d}/${mo}/${y}`;
}

/** Status canônico do RPC → status da UI legada. */
function statusFromRPC(canonical: string): ResultStatus {
  const l = (canonical || "").toLowerCase();
  if (l.includes("cancel")) return "Cancelado";
  if (l.includes("liberado") || l.includes("finaliz")) return "Finalizado";
  return "Pendente";
}

const ConsultarResultados = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebouncedValue(searchQuery, 250);
  const [motivoDialogOpen, setMotivoDialogOpen] = useState(false);
  const [selectedMotivo, setSelectedMotivo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [, setTick] = useState(0);
  const itemsPerPage = 10;

  useEffect(() => subscribe(() => setTick((t) => t + 1)), []);

  // ── Branch por flag ─────────────────────────────────────────────────────
  // ON: usa `useResultadosPage` (server-side, sem cache global).
  // OFF / USE_LEGACY_STORE: mantém o caminho legado intacto.
  const flagPaginated = useFeatureFlag("paginated_atendimentos");
  const flagLegacy = useFeatureFlag("USE_LEGACY_STORE");
  const useServer = flagPaginated && !flagLegacy && !isFeatureEnabled("USE_LEGACY_STORE");

  // Status canônico (no banco) que corresponde à aba ativa.
  const tabStatusCanonical = useMemo(() => {
    const k = tabs[activeTab].key;
    if (k === "Finalizado") return "Resultado Liberado";
    if (k === "Cancelado")  return "Pedido Cancelado";
    if (k === "Pendente")   return undefined; // múltiplos status — sem filtro server, filtra client
    return undefined;
  }, [activeTab]);

  const serverPage = useResultadosPage(
    { status: tabStatusCanonical, q: searchQuery },
    useServer,
  );

  const legacyResultados: Resultado[] = useMemo(
    () => getAtendimentos().map(fromAtendimento),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setTick],
  );

  // Mapeia rows do RPC para o shape legado da UI.
  const serverResultados: Resultado[] = useMemo(() => {
    return serverPage.items.map((r, idx) => ({
      id: idx + 1,
      nome: r.paciente_nome ?? "—",
      nascimento: r.paciente_nascimento ?? "",
      idade: r.paciente_nascimento ? formatIdadeDetalhada(r.paciente_nascimento) : "",
      protocolo: r.protocolo,
      dataCadastro: formatDataRPC(r.data),
      status: statusFromRPC(r.status_resultado),
      motivoCancelamento: r.motivo_cancelamento ?? undefined,
      analistas: r.solicitante ? [buildIniciais(r.solicitante)] : [],
      temRetificacao: r.tem_retificacao === true,
    }));
  }, [serverPage.items]);

  const resultados = useServer ? serverResultados : legacyResultados;

  const filtered = resultados.filter((item) => {
    const q = normalize(debouncedQuery);
    const hasSearch = q.length > 0;
    const tabKey = tabs[activeTab].key;
    // No modo server-side a aba já vira filtro no RPC (exceto "Pendente"),
    // então aqui basta deixar passar tudo que veio. Para "Pendente" caímos
    // no filtro client por status, que ainda é confiável.
    const tabFilter = useServer
      ? (tabKey === "todos" || tabKey === "Pendente" ? item.status === "Pendente" || tabKey !== "Pendente" : true)
      : (hasSearch || tabKey === "todos" || item.status === tabKey);
    const matchSearch = !q || normalize(item.nome).includes(q) || normalize(item.protocolo).includes(q);
    return tabFilter && matchSearch;
  });

  // No modo server-side, o RPC já paginou — exibimos tudo que veio.
  // Loader "Carregar mais" aparece quando o hook ainda tem páginas.
  const totalPages = useServer ? 1 : Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const paginated = useServer
    ? filtered
    : filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // KPIs: legado consegue contar tudo (cache local). Server-side conta só
  // o que está carregado (aproximação aceitável até existir RPC dedicada).
  const finalizadosCount = resultados.filter(r => r.status === "Finalizado").length;
  const pendentesCount   = resultados.filter(r => r.status === "Pendente").length;
  const canceladosCount  = resultados.filter(r => r.status === "Cancelado").length;

  const abrirDetalhe = (protocolo: string) => navigate(`/resultados/${protocolo}/consulta`);

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
      <div className={`flex min-w-0 items-center justify-center gap-1 px-2 sm:gap-2 sm:px-3 h-8 sm:h-9 rounded-lg ${map[tone]}`}>
        <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
        <span className="truncate text-[11px] sm:text-xs font-medium">{label}</span>
        <span className="text-[11px] sm:text-sm font-semibold tabular-nums shrink-0">{value}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 animate-fade-in">

        <PageHeader
          eyebrow="Operacional"
          title="Consultar Resultados"
          description={`Somente leitura · ${filtered.length} ${filtered.length === 1 ? "resultado encontrado" : "resultados encontrados"}`}
          actions={
            <div className="grid w-full grid-cols-3 gap-1.5 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-2">
              <SummaryChip icon={CheckCircle2} label="Finalizados" value={finalizadosCount} tone="success" />
              <SummaryChip icon={Clock}        label="Pendentes"   value={pendentesCount}   tone="warning" />
              <SummaryChip icon={XCircle}      label="Cancelados"  value={canceladosCount}  tone="danger" />
            </div>
          }
        />


        {/* ─── Toolbar ─── */}
        <div className="bg-card rounded-xl border border-border p-2.5 sm:p-3 mb-5">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="grid grid-cols-4 gap-0.5 bg-muted/50 rounded-lg p-1 w-full min-w-0 lg:flex lg:items-center lg:gap-1 lg:w-auto lg:shrink-0">
              {tabs.map((tab, index) => (
                <button
                  key={tab.label}
                  onClick={() => { setActiveTab(index); setCurrentPage(1); }}
                  className={`h-8 min-w-0 px-1 sm:px-2 lg:px-3.5 rounded-md text-[10px] min-[380px]:text-[11px] sm:text-xs font-medium transition-all whitespace-nowrap overflow-hidden text-ellipsis ${
                    activeTab === index
                      ? "bg-card text-foreground shadow-elevation-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
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
          <div className="bg-card rounded-xl border border-border flex flex-col items-center py-20 text-center px-8">
            <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <Inbox className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <h2 className="text-base font-semibold text-foreground mb-1">Nenhum resultado encontrado</h2>
            <p className="text-sm text-muted-foreground">Tente ajustar os filtros ou a busca.</p>
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
                        <button
                          onClick={() => abrirDetalhe(item.protocolo)}
                          className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                          title="Imprimir / Visualizar"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => abrirDetalhe(item.protocolo)}
                        className="h-8 px-3 rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors inline-flex items-center gap-1.5"
                      >
                        <Eye className="h-3.5 w-3.5" /> Consultar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden animate-fade-in-up">
            {/* Mobile */}
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
                        onClick={() => abrirDetalhe(item.protocolo)}
                        className="h-8 px-3 rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors inline-flex items-center gap-1.5"
                      >
                        <Eye className="h-3.5 w-3.5" /> Consultar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop */}
            <div className="hidden md:block">
              <table className="w-full text-sm table-fixed">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Paciente</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-[140px] hidden lg:table-cell">Protocolo</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-[110px]">Data</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-[120px]">Status</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-[120px] hidden xl:table-cell">Analistas</th>
                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-[130px]">Ações</th>
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
                            onClick={() => abrirDetalhe(item.protocolo)}
                            className="h-8 px-3 rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors inline-flex items-center gap-1.5"
                          >
                            <Eye className="h-3.5 w-3.5" /> Consultar
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

        {/* ─── Loader server-side (Carregar mais) ─── */}
        {useServer && serverPage.hasMore && (
          <div className="flex justify-center py-5">
            <button
              onClick={() => void serverPage.loadMore()}
              disabled={serverPage.loadingMore}
              className="h-9 px-4 rounded-lg border border-border bg-card text-xs font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50"
            >
              {serverPage.loadingMore ? "Carregando…" : "Carregar mais"}
            </button>
          </div>
        )}

        {/* ─── Paginação (somente legado) ─── */}
        {!useServer && filtered.length > 0 && (
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
    </div>
  );
};

export default ConsultarResultados;