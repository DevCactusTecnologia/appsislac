// PageHeader removido — header próprio inline para estética Soft Dashboard.
import { useState, useMemo, lazy, Suspense } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Search, BarChart3, ListOrdered, ClipboardList, TrendingUp, Users, Building2, FlaskConical, TestTube, Download, FileText, Filter, X, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import StandardDialog from "@/components/ui/standard-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { printHtmlInHiddenFrame } from "@/lib/printHtml";
import { getConveniosAtivosNomes } from "@/data/convenioStore";
import {
  fetchProducaoAggregates,
  fetchDailySeries,
  ProducaoBucket,
} from "@/data/producaoMetricsStore";
// recharts (~300 KB) só é baixado quando o usuário abre o diálogo "Gráfica".
const ProducaoChartsLazy = lazy(() => import("./producao/ProducaoChartsLazy"));
import { useAuth } from "@/contexts/AuthContext";
import { listarMateriaisAmostra } from "@/data/materiaisAmostraStore";

// Catálogo SSOT — carregado dinamicamente de materiais_amostra (Soroteca 2.1).
const PERIODOS_RAPIDOS = [
  { label: "Hoje", days: 0 }, { label: "7 dias", days: 7 }, { label: "15 dias", days: 15 }, { label: "30 dias", days: 30 }, { label: "90 dias", days: 90 },
];

type TipoProducao = "analista" | "unidade" | "setor" | "exame";

interface ProducaoItem { id: number; nome: string; descricao: string; totalExames: number; }

const TIPO_DESCRICAO: Record<TipoProducao, string> = {
  analista: "Analista / Coletador",
  unidade: "Convênio / Unidade",
  setor: "Setor / Material",
  exame: "Exame solicitado",
};

function bucketsToItems(buckets: ProducaoBucket[], descricao: string): ProducaoItem[] {
  return buckets.map((b, i) => ({
    id: i + 1,
    nome: b.nome,
    descricao,
    totalExames: b.total,
  }));
}

const tipoConfig: Record<TipoProducao, { label: string; icon: typeof Users }> = {
  analista: { label: "Analista", icon: Users }, unidade: { label: "Unidade", icon: Building2 }, setor: { label: "Setor", icon: FlaskConical }, exame: { label: "Exame", icon: TestTube },
};

const CHART_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(210, 70%, 55%)", "hsl(150, 60%, 45%)", "hsl(340, 65%, 55%)", "hsl(45, 80%, 50%)"];

const Producao = () => {
  // Multi-tenant cache governance: toda queryKey operacional DEVE começar com
  // ["tenant", tenantId, ...] para impedir reuso de cache cross-tenant em troca
  // de identidade na mesma aba. RLS é a fonte de verdade — o prefixo é defesa
  // em profundidade no client. Ver mem://architecture/cache-governance.
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? "anon";
  const [tipoSelecionado, setTipoSelecionado] = useState<TipoProducao>("analista");
  // Default range: last 30 days.
  const [dataInicial, setDataInicial] = useState<Date>(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; });
  const [dataFinal, setDataFinal] = useState<Date>(() => new Date());
  const [chartDialogOpen, setChartDialogOpen] = useState(false);
  const [chartItem, setChartItem] = useState<ProducaoItem | null>(null);
  const [quantDialogOpen, setQuantDialogOpen] = useState(false);
  const [quantItem, setQuantItem] = useState<ProducaoItem | null>(null);
  const [filtroConvenio, setFiltroConvenio] = useState<string>("todos");
  const [filtroMaterial, setFiltroMaterial] = useState<string>("todos");
  const [showFiltros, setShowFiltros] = useState(false);

  const conveniosNomes = useMemo(() => getConveniosAtivosNomes(), []);

  // SSOT — materiais carregados de materiais_amostra (Soroteca 2.1).
  const { data: materiaisCatalog } = useQuery({
    queryKey: ["tenant", tenantId, "materiais_amostra", "ativos"],
    queryFn: async () => (await listarMateriaisAmostra({ ativosOnly: true, pageSize: 100 })).rows,
    staleTime: 5 * 60_000,
  });
  const MATERIAIS = useMemo(
    () => (materiaisCatalog ?? []).map((m) => m.nome),
    [materiaisCatalog],
  );

  const iniIso = dataInicial.toISOString().slice(0, 10);
  const fimIso = dataFinal.toISOString().slice(0, 10);

  const { data: aggregates, isLoading } = useQuery({
    queryKey: ["tenant", tenantId, "producao", "aggregates", iniIso, fimIso],
    queryFn: ({ signal }) => fetchProducaoAggregates(dataInicial, dataFinal, signal),
    staleTime: 60_000,
  });

  const producaoData: Record<TipoProducao, ProducaoItem[]> = useMemo(() => ({
    analista: bucketsToItems(aggregates?.porAnalista ?? [], TIPO_DESCRICAO.analista),
    unidade: bucketsToItems(aggregates?.porConvenio ?? [], TIPO_DESCRICAO.unidade),
    setor: bucketsToItems(aggregates?.porMaterial ?? [], TIPO_DESCRICAO.setor),
    exame: bucketsToItems(aggregates?.porExame ?? [], TIPO_DESCRICAO.exame),
  }), [aggregates]);

  const hasActiveFilters = filtroConvenio !== "todos" || filtroMaterial !== "todos";
  const clearFilters = () => { setFiltroConvenio("todos"); setFiltroMaterial("todos"); };
  const applyQuickPeriod = (days: number) => { const end = new Date(); const start = new Date(); start.setDate(end.getDate() - days); setDataInicial(start); setDataFinal(end); };

  // Apply filtroConvenio / filtroMaterial client-side over the loaded buckets when applicable.
  const dadosBase = producaoData[tipoSelecionado];
  const dados = useMemo(() => {
    if (!hasActiveFilters) return dadosBase;
    // We can only filter accurately when the active type is convenio or material.
    if (tipoSelecionado === "unidade" && filtroConvenio !== "todos") {
      return dadosBase.filter(d => d.nome === filtroConvenio);
    }
    if (tipoSelecionado === "setor" && filtroMaterial !== "todos") {
      return dadosBase.filter(d => d.nome === filtroMaterial);
    }
    return dadosBase;
  }, [dadosBase, hasActiveFilters, tipoSelecionado, filtroConvenio, filtroMaterial]);

  const totalGeral = dados.reduce((sum, item) => sum + item.totalExames, 0);
  const maiorProducao = Math.max(...dados.map(d => d.totalExames), 1);

  // Daily series query (only when chart dialog is open with an item).
  const chartFilter = useMemo(() => {
    if (!chartItem) return undefined;
    if (tipoSelecionado === "analista") return { analista: chartItem.nome };
    if (tipoSelecionado === "unidade") return { convenio: chartItem.nome };
    if (tipoSelecionado === "setor") return { material: chartItem.nome };
    return { nomeExame: chartItem.nome };
  }, [chartItem, tipoSelecionado]);

  const { data: dailySeries } = useQuery({
    queryKey: ["tenant", tenantId, "producao", "daily", iniIso, fimIso, tipoSelecionado, chartItem?.nome],
    queryFn: ({ signal }) => fetchDailySeries(dataInicial, dataFinal, chartFilter, signal),
    enabled: chartDialogOpen && !!chartItem,
    staleTime: 60_000,
  });

  const getDailyData = (_item: ProducaoItem) => {
    return (dailySeries ?? []).map(d => ({
      dia: format(new Date(d.dia + "T00:00:00"), "dd/MM"),
      exames: d.total,
    }));
  };
  const getPieData = (item: ProducaoItem) => dados.map(d => ({ nome: d.nome.length > 20 ? d.nome.substring(0, 18) + "…" : d.nome, valor: d.totalExames, isSelected: d.id === item.id }));
  const getWeeklyBreakdown = (item: ProducaoItem) => {
    // Build real weekly breakdown from daily series (load on demand for the quant dialog as well).
    const series = dailySeries ?? [];
    if (series.length === 0) {
      return [{ periodo: format(dataInicial, "dd/MM") + " - " + format(dataFinal, "dd/MM"), label: "Período", exames: item.totalExames, rotina: item.totalExames, urgentes: 0, media: Math.round(item.totalExames / 7) }];
    }
    // Group every 7 days.
    const weeks: { periodo: string; label: string; exames: number; rotina: number; urgentes: number; media: number }[] = [];
    let bucket: typeof series = [];
    let weekIdx = 1;
    series.forEach((d, idx) => {
      bucket.push(d);
      if (bucket.length === 7 || idx === series.length - 1) {
        const total = bucket.reduce((s, x) => s + x.total, 0);
        const ini = format(new Date(bucket[0].dia + "T00:00:00"), "dd/MM");
        const fim = format(new Date(bucket[bucket.length - 1].dia + "T00:00:00"), "dd/MM");
        weeks.push({ periodo: `${ini} - ${fim}`, label: `Semana ${weekIdx}`, exames: total, rotina: total, urgentes: 0, media: Math.round(total / Math.max(bucket.length, 1)) });
        bucket = [];
        weekIdx++;
      }
    });
    return weeks;
  };

  const downloadCSV = (filename: string, headers: string[], rows: string[][]) => {
    const csv = "\uFEFF" + [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${filename}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const exportPDF = (title: string, contentId: string) => {
    const content = document.getElementById(contentId); if (!content) return;
    const escTitle = title
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const html = `<html><head><title>${escTitle}</title><style>body{font-family:system-ui,sans-serif;padding:24px;color:#1a1a1a}h1{font-size:18px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5;font-weight:600}</style></head><body>${content.innerHTML}</body></html>`;
    printHtmlInHiddenFrame({ html, frameId: `producao-${contentId}-print-frame` });
  };

  const periodoLabel = `${format(dataInicial, "dd MMM", { locale: ptBR })} — ${format(dataFinal, "dd MMM, yyyy", { locale: ptBR })}`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/20 via-background to-background">
      <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto space-y-7">
        {/* ── Header ─────────────────────────────────────────── */}
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-primary/80 uppercase tracking-[0.22em] mb-2">Relatórios</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight leading-tight">Produção</h1>
            <p className="mt-1.5 text-sm text-muted-foreground/80">Indicadores por analista, unidade, setor e exame · {periodoLabel}</p>
          </div>
          <div className="flex items-center gap-2.5 rounded-2xl bg-card/80 backdrop-blur px-4 py-2.5 border border-border/50 shadow-sm">
            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div className="leading-tight">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Total no período</p>
              <p className="text-base font-bold text-foreground tabular-nums">{totalGeral.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">exames</span></p>
            </div>
          </div>
        </header>

        {/* ── Tipo cards (preservados) ───────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(Object.keys(tipoConfig) as TipoProducao[]).map(key => {
            const config = tipoConfig[key]; const Icon = config.icon; const isActive = tipoSelecionado === key;
            const count = producaoData[key].reduce((s, i) => s + i.totalExames, 0);
            return (
              <button key={key} onClick={() => setTipoSelecionado(key)} className={cn("flex flex-col items-start gap-2 rounded-3xl p-4 transition-all text-left border", isActive ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20" : "bg-card text-card-foreground border-border/60 hover:border-primary/40 hover:shadow-md")}>
                <div className={cn("h-9 w-9 rounded-2xl flex items-center justify-center", isActive ? "bg-primary-foreground/20" : "bg-primary/8")}>
                  <Icon className={cn("h-4 w-4", isActive ? "text-primary-foreground" : "text-primary")} />
                </div>
                <div>
                  <p className={cn("text-[10px] font-semibold uppercase tracking-wider", isActive ? "text-primary-foreground/70" : "text-muted-foreground")}>{config.label}</p>
                  <p className={cn("text-lg font-bold tabular-nums", isActive ? "text-primary-foreground" : "text-foreground")}>{count.toLocaleString()}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Filtros (chassi suave) ─────────────────────────── */}
        <section className="rounded-3xl border border-border/50 bg-card/70 backdrop-blur shadow-sm">
          <div className="p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              {/* Datas em pill duplo */}
              <div className="flex items-center gap-2 flex-1">
                <div className="inline-flex items-center rounded-2xl border border-border/60 bg-background/80 divide-x divide-border/60 overflow-hidden">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-2 px-4 h-11 text-sm font-medium text-foreground hover:bg-muted/40 transition-colors">
                        <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mr-1">De</span>
                        {format(dataInicial, "dd MMM yyyy", { locale: ptBR })}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={dataInicial} onSelect={d => d && setDataInicial(d)} initialFocus className="p-3 pointer-events-auto" /></PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-2 px-4 h-11 text-sm font-medium text-foreground hover:bg-muted/40 transition-colors">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mr-1">Até</span>
                        {format(dataFinal, "dd MMM yyyy", { locale: ptBR })}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={dataFinal} onSelect={d => d && setDataFinal(d)} initialFocus className="p-3 pointer-events-auto" /></PopoverContent>
                  </Popover>
                </div>
                {/* Atalhos de período */}
                <div className="hidden md:flex items-center gap-1 ml-1">
                  {PERIODOS_RAPIDOS.map(p => (
                    <button key={p.label} onClick={() => applyQuickPeriod(p.days)} className="h-8 px-3 rounded-xl text-[11px] font-medium text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors">
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant={showFiltros ? "default" : "outline"} className="h-11 gap-2 rounded-2xl px-4" onClick={() => setShowFiltros(!showFiltros)}>
                  <Filter className="h-3.5 w-3.5" />Filtros
                  {hasActiveFilters && <span className="ml-1 h-5 min-w-5 px-1 rounded-full bg-primary-foreground/20 text-[10px] flex items-center justify-center font-bold">{(filtroConvenio !== "todos" ? 1 : 0) + (filtroMaterial !== "todos" ? 1 : 0)}</span>}
                </Button>
                <Button className="h-11 gap-2 rounded-2xl px-5 shadow-sm">
                  <Search className="h-3.5 w-3.5" />Atualizar
                </Button>
              </div>
            </div>

            {/* Atalhos mobile */}
            <div className="md:hidden flex flex-wrap items-center gap-1">
              {PERIODOS_RAPIDOS.map(p => (
                <button key={p.label} onClick={() => applyQuickPeriod(p.days)} className="h-8 px-3 rounded-xl text-[11px] font-medium bg-muted/40 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors">
                  {p.label}
                </button>
              ))}
            </div>

            {showFiltros && (
              <div className="border-t border-border/40 pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-fade-in">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Convênio</label>
                  <Select value={filtroConvenio} onValueChange={setFiltroConvenio}><SelectTrigger className="h-10 text-sm rounded-2xl"><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="todos">Todos</SelectItem>{conveniosNomes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Material</label>
                  <Select value={filtroMaterial} onValueChange={setFiltroMaterial}><SelectTrigger className="h-10 text-sm rounded-2xl"><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="todos">Todos</SelectItem>{MATERIAIS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
                </div>
                {hasActiveFilters && <div className="flex items-end"><Button variant="ghost" size="sm" className="h-10 text-sm gap-1.5 rounded-2xl text-destructive hover:bg-destructive/10" onClick={clearFilters}><X className="h-3.5 w-3.5" />Limpar filtros</Button></div>}
              </div>
            )}
          </div>
        </section>

        {/* ── Ranking de produção ────────────────────────────── */}
        <section className="rounded-3xl border border-border/50 bg-card/70 backdrop-blur shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <ClipboardList className="h-4 w-4 text-primary" />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-foreground">Ranking por {tipoConfig[tipoSelecionado].label}</p>
                <p className="text-[11px] text-muted-foreground">{dados.length} {dados.length === 1 ? "registro" : "registros"} · ordenado por volume</p>
              </div>
            </div>
            {isLoading && <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />}
          </div>

          {dados.length === 0 ? (
            <div className="py-20 text-center">
              <div className="inline-flex p-3 rounded-2xl bg-muted/40 mb-3">
                <ClipboardList className="h-6 w-6 text-muted-foreground/60" />
              </div>
              <p className="text-sm font-semibold text-foreground">Nenhum dado no período</p>
              <p className="text-xs text-muted-foreground mt-1">Ajuste o intervalo ou os filtros para visualizar a produção.</p>
            </div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden lg:block">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/20 border-b border-border/40">
                      <th className="text-left pl-5 pr-2 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-14">#</th>
                      <th className="text-left px-3 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{tipoConfig[tipoSelecionado].label}</th>
                      <th className="text-left px-3 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-[34%]">Participação</th>
                      <th className="text-right px-3 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-28">Exames</th>
                      <th className="text-right pr-5 pl-3 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-52">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.map((item, idx) => {
                      const pct = Math.round((item.totalExames / maiorProducao) * 100);
                      const isTop = idx === 0;
                      return (
                        <tr key={item.id} className="border-b border-border/20 last:border-0 hover:bg-muted/15 transition-colors group">
                          <td className="pl-5 pr-2 py-3.5">
                            <span className={cn("inline-flex items-center justify-center h-7 w-7 rounded-xl text-[11px] font-bold tabular-nums", isTop ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground")}>
                              {idx + 1}
                            </span>
                          </td>
                          <td className="px-3 py-3.5">
                            <p className="text-sm font-semibold text-foreground leading-tight">{item.nome}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{item.descricao}</p>
                          </td>
                          <td className="px-3 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="flex-1 h-1.5 bg-muted/60 rounded-full overflow-hidden">
                                <div className={cn("h-full rounded-full transition-all duration-700", isTop ? "bg-primary" : "bg-primary/55")} style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[11px] font-medium text-muted-foreground w-9 text-right tabular-nums">{pct}%</span>
                            </div>
                          </td>
                          <td className="px-3 py-3.5 text-right">
                            <span className="text-sm font-bold text-foreground tabular-nums">{item.totalExames.toLocaleString()}</span>
                          </td>
                          <td className="pr-5 pl-3 py-3.5">
                            <div className="flex items-center justify-end gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="sm" className="gap-1.5 rounded-xl h-8 text-xs hover:bg-primary/10 hover:text-primary" onClick={() => { setChartItem(item); setChartDialogOpen(true); }}><BarChart3 className="h-3 w-3" />Gráfica</Button>
                              <Button variant="ghost" size="sm" className="gap-1.5 rounded-xl h-8 text-xs hover:bg-primary/10 hover:text-primary" onClick={() => { setQuantItem(item); setQuantDialogOpen(true); }}><ListOrdered className="h-3 w-3" />Quantitativa</Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="lg:hidden divide-y divide-border/30">
                {dados.map((item, idx) => {
                  const pct = Math.round((item.totalExames / maiorProducao) * 100);
                  const isTop = idx === 0;
                  return (
                    <div key={item.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <span className={cn("inline-flex items-center justify-center h-7 w-7 rounded-xl text-[11px] font-bold tabular-nums shrink-0", isTop ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground")}>
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{item.nome}</p>
                            <p className="text-[11px] text-muted-foreground">{item.descricao}</p>
                          </div>
                        </div>
                        <span className="text-base font-bold text-foreground shrink-0 tabular-nums">{item.totalExames.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <div className="flex-1 h-1.5 bg-muted/60 rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full", isTop ? "bg-primary" : "bg-primary/55")} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground tabular-nums">{pct}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="flex-1 gap-1.5 rounded-2xl h-9 text-xs" onClick={() => { setChartItem(item); setChartDialogOpen(true); }}><BarChart3 className="h-3 w-3" />Gráfica</Button>
                        <Button variant="outline" size="sm" className="flex-1 gap-1.5 rounded-2xl h-9 text-xs" onClick={() => { setQuantItem(item); setQuantDialogOpen(true); }}><ListOrdered className="h-3 w-3" />Quantitativa</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>

      {/* Chart Dialog */}
      <StandardDialog
        open={chartDialogOpen}
        onClose={() => setChartDialogOpen(false)}
        icon={<BarChart3 className="h-5 w-5 text-primary" />}
        title={`Gráfica — ${chartItem?.nome ?? ""}`}
        subtitle={chartItem ? `${tipoConfig[tipoSelecionado].label} · ${format(dataInicial, "dd/MM/yy", { locale: ptBR })} – ${format(dataFinal, "dd/MM/yy", { locale: ptBR })}` : undefined}
        maxWidth="5xl"
        headerActions={chartItem ? (
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" className="gap-1.5 rounded-full h-8 text-xs hover:bg-muted" onClick={() => downloadCSV(`grafica_${chartItem.nome.replace(/\s+/g, "_")}`, ["Dia", "Exames"], getDailyData(chartItem).map(d => [d.dia, String(d.exames)]))}><Download className="h-3.5 w-3.5" />CSV</Button>
            <Button variant="ghost" size="sm" className="gap-1.5 rounded-full h-8 text-xs hover:bg-muted" onClick={() => exportPDF(`Gráfico - ${chartItem.nome}`, "chart-print-content")}><FileText className="h-3.5 w-3.5" />PDF</Button>
          </div>
        ) : undefined}
      >
        {chartItem && (() => {
          const daily = getDailyData(chartItem);
          const pie = getPieData(chartItem);
          const pico = daily.reduce((max, d) => d.exames > max.exames ? d : max, daily[0] ?? { dia: "—", exames: 0 });
          const mediaDia = daily.length ? Math.round(daily.reduce((s, d) => s + d.exames, 0) / daily.length) : 0;
          const share = pie.find(p => p.isSelected)?.valor ?? 0;
          const total = pie.reduce((s, p) => s + p.valor, 0) || 1;
          const sharePct = Math.round((share / total) * 100);
          return (
            <div className="px-6 py-5 space-y-5 bg-gradient-to-b from-muted/20 to-transparent">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Total no período", value: chartItem.totalExames.toLocaleString(), hint: `${daily.length} dia(s)`, tone: "text-primary", icon: TrendingUp },
                  { label: "Média / dia", value: mediaDia.toLocaleString(), hint: "exames", tone: "text-foreground", icon: BarChart3 },
                  { label: "Pico do período", value: pico.exames.toLocaleString(), hint: pico.dia, tone: "text-foreground", icon: ClipboardList },
                ].map((k) => (
                  <div key={k.label} className="rounded-2xl border border-border/60 bg-card p-4 flex items-start gap-3 shadow-elevation-xs">
                    <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><k.icon className="h-4 w-4 text-primary" /></div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{k.label}</p>
                      <p className={cn("text-xl font-bold tabular-nums leading-tight mt-0.5", k.tone)}>{k.value}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{k.hint}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div id="chart-print-content" className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-3 rounded-2xl border border-border/60 bg-card p-5 shadow-elevation-xs">
                  <Suspense fallback={<div className="h-72 flex items-center justify-center text-xs text-muted-foreground">Carregando gráficos…</div>}>
                    <ProducaoChartsLazy daily={daily} pie={[]} colors={CHART_COLORS} pieTitle="" />
                  </Suspense>
                </div>
                <div className="lg:col-span-2 rounded-2xl border border-border/60 bg-card p-5 shadow-elevation-xs space-y-4">
                  <div className="flex items-baseline justify-between">
                    <h4 className="text-sm font-semibold text-foreground">Participação</h4>
                    <span className="text-[11px] text-muted-foreground">{tipoConfig[tipoSelecionado].label}</span>
                  </div>
                  <div className="rounded-xl bg-primary/5 border border-primary/15 p-3">
                    <p className="text-[10px] uppercase tracking-widest text-primary font-semibold">{chartItem.nome}</p>
                    <p className="text-2xl font-bold text-primary tabular-nums mt-0.5">{sharePct}%</p>
                    <p className="text-[11px] text-muted-foreground">do total no período</p>
                  </div>
                  <Suspense fallback={<div className="h-40 flex items-center justify-center text-xs text-muted-foreground">…</div>}>
                    <ProducaoChartsLazy daily={[]} pie={pie} colors={CHART_COLORS} pieTitle={tipoConfig[tipoSelecionado].label} />
                  </Suspense>
                </div>
              </div>
            </div>
          );
        })()}
      </StandardDialog>

      {/* Quantitativa Dialog */}
      <StandardDialog
        open={quantDialogOpen}
        onClose={() => setQuantDialogOpen(false)}
        icon={<ListOrdered className="h-5 w-5 text-primary" />}
        title={`Quantitativa — ${quantItem?.nome ?? ""}`}
        subtitle={quantItem ? `${tipoConfig[tipoSelecionado].label} · ${format(dataInicial, "dd/MM/yy", { locale: ptBR })} – ${format(dataFinal, "dd/MM/yy", { locale: ptBR })}` : undefined}
        maxWidth="5xl"
        headerActions={quantItem ? (
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" className="gap-1.5 rounded-full h-8 text-xs hover:bg-muted" onClick={() => {
              const b = getWeeklyBreakdown(quantItem);
              downloadCSV(`quant_${quantItem.nome.replace(/\s+/g, "_")}`, ["Período", "Datas", "Rotina", "Urgentes", "Total", "Média/Dia"], b.map(w => [w.label, w.periodo, String(w.rotina), String(w.urgentes), String(w.exames), String(w.media)]));
            }}><Download className="h-3.5 w-3.5" />CSV</Button>
            <Button variant="ghost" size="sm" className="gap-1.5 rounded-full h-8 text-xs hover:bg-muted" onClick={() => exportPDF(`Quantitativa - ${quantItem.nome}`, "quant-print-content")}><FileText className="h-3.5 w-3.5" />PDF</Button>
          </div>
        ) : undefined}
      >
        {quantItem && (() => {
          const breakdown = getWeeklyBreakdown(quantItem);
          const totalRotina = breakdown.reduce((s, w) => s + w.rotina, 0);
          const totalUrgentes = breakdown.reduce((s, w) => s + w.urgentes, 0);
          const totalExames = breakdown.reduce((s, w) => s + w.exames, 0);
          const mediaGeral = breakdown.length ? Math.round(totalExames / breakdown.length) : 0;
          const picoSemana = breakdown.reduce((max, w) => w.exames > max.exames ? w : max, breakdown[0] ?? { label: "—", exames: 0 });
          const urgPct = totalExames ? Math.round((totalUrgentes / totalExames) * 100) : 0;
          return (
            <div className="px-6 py-5 space-y-5 bg-gradient-to-b from-muted/20 to-transparent">
              <div id="quant-print-content" className="space-y-5">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: "Total", value: totalExames, hint: `${breakdown.length} semana(s)`, tone: "text-primary", bg: "bg-primary/10", icon: TrendingUp },
                    { label: "Rotina", value: totalRotina, hint: `${100 - urgPct}% do total`, tone: "text-status-success", bg: "bg-status-success-bg", icon: ClipboardList },
                    { label: "Urgentes", value: totalUrgentes, hint: `${urgPct}% do total`, tone: "text-status-warning", bg: "bg-status-warning-bg", icon: TestTube },
                    { label: "Pico semanal", value: picoSemana.exames, hint: picoSemana.label, tone: "text-foreground", bg: "bg-muted", icon: BarChart3 },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-2xl border border-border/60 bg-card p-4 flex items-start gap-3 shadow-elevation-xs">
                      <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0", stat.bg)}><stat.icon className={cn("h-4 w-4", stat.tone)} /></div>
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{stat.label}</p>
                        <p className={cn("text-xl font-bold tabular-nums leading-tight mt-0.5", stat.tone)}>{stat.value.toLocaleString()}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{stat.hint}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-elevation-xs">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-border/40">
                    <h4 className="text-sm font-semibold text-foreground">Distribuição semanal</h4>
                    <span className="text-[11px] text-muted-foreground tabular-nums">Média {mediaGeral.toLocaleString()} / semana</span>
                  </div>
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full">
                      <thead><tr className="bg-muted/15 border-b border-border/30"><th className="text-left px-5 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Período</th><th className="text-right px-5 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Rotina</th><th className="text-right px-5 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Urgentes</th><th className="text-right px-5 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Total</th><th className="text-right px-5 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Média/Dia</th><th className="px-5 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-32">Volume</th></tr></thead>
                      <tbody>
                        {breakdown.map(week => {
                          const pct = picoSemana.exames ? Math.round((week.exames / picoSemana.exames) * 100) : 0;
                          return (
                            <tr key={week.label} className="border-b border-border/15 last:border-0 hover:bg-muted/10 transition-colors">
                              <td className="px-5 py-3"><p className="text-sm font-medium">{week.label}</p><p className="text-[11px] text-muted-foreground">{week.periodo}</p></td>
                              <td className="px-5 py-3 text-right text-sm tabular-nums">{week.rotina.toLocaleString()}</td>
                              <td className="px-5 py-3 text-right text-sm tabular-nums text-status-warning font-medium">{week.urgentes.toLocaleString()}</td>
                              <td className="px-5 py-3 text-right text-sm tabular-nums font-bold">{week.exames.toLocaleString()}</td>
                              <td className="px-5 py-3 text-right text-sm tabular-nums text-muted-foreground">{week.media}</td>
                              <td className="px-5 py-3"><div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-primary/80" style={{ width: `${pct}%` }} /></div></td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-muted/20 border-t border-border/40">
                          <td className="px-5 py-3 text-sm font-bold">Total</td>
                          <td className="px-5 py-3 text-right text-sm tabular-nums font-semibold">{totalRotina.toLocaleString()}</td>
                          <td className="px-5 py-3 text-right text-sm tabular-nums text-status-warning font-semibold">{totalUrgentes.toLocaleString()}</td>
                          <td className="px-5 py-3 text-right text-sm tabular-nums font-bold text-primary">{totalExames.toLocaleString()}</td>
                          <td className="px-5 py-3 text-right text-sm tabular-nums text-muted-foreground">{mediaGeral}</td>
                          <td className="px-5 py-3" />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <div className="sm:hidden divide-y divide-border/30">
                    {breakdown.map(week => (
                      <div key={week.label} className="p-4 space-y-2">
                        <div className="flex items-center justify-between"><div><p className="text-sm font-semibold">{week.label}</p><p className="text-[11px] text-muted-foreground">{week.periodo}</p></div><span className="text-base font-bold tabular-nums">{week.exames.toLocaleString()}</span></div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-muted/20 rounded-xl p-2"><p className="text-[9px] text-muted-foreground uppercase">Rotina</p><p className="text-sm font-semibold tabular-nums">{week.rotina.toLocaleString()}</p></div>
                          <div className="bg-muted/20 rounded-xl p-2"><p className="text-[9px] text-muted-foreground uppercase">Urgentes</p><p className="text-sm font-semibold tabular-nums text-status-warning">{week.urgentes.toLocaleString()}</p></div>
                          <div className="bg-muted/20 rounded-xl p-2"><p className="text-[9px] text-muted-foreground uppercase">Média/Dia</p><p className="text-sm font-semibold tabular-nums">{week.media}</p></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </StandardDialog>
      </div>
    </div>
  );
};

export default Producao;
