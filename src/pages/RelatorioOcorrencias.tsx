import { PageHeader } from "@/components/shared/PageHeader";
import { useState, useMemo, useEffect } from "react";
import { AlertTriangle, Search, XCircle, FlaskConical, ClipboardList, CalendarIcon, X, Eye, CheckCircle2, Info, ChevronLeft, ChevronRight, TrendingDown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import StandardDialog from "@/components/ui/standard-dialog";
import { Textarea } from "@/components/ui/textarea";
import StatusBadge from "@/components/StatusBadge";
import { getAtendimentos, getExamesOperacionaisByStatus, subscribe as subscribeAtendimentos, type ExameOperacionalRow } from "@/data/atendimentoStore";
import { toast } from "sonner";
import { useFeatureFlag, isFeatureEnabled } from "@/lib/featureFlags";
import { useOcorrenciasPage, type OcorrenciaRow } from "@/hooks/useOcorrenciasPage";

const parseDateBR = (d: string): Date | null => {
  const parts = d.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (parts) return new Date(Number(parts[3]), Number(parts[2]) - 1, Number(parts[1]));
  return null;
};

/** Formata ISO timestamp em "dd/MM/yyyy HH:mm:ss" (UI legada). */
const formatIsoBR = (iso: string | null | undefined, withTime = true): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return withTime ? format(d, "dd/MM/yyyy HH:mm:ss") : format(d, "dd/MM/yyyy");
};

/** Converte Date local em string ISO YYYY-MM-DD (sem timezone shift). */
const toIsoDate = (d: Date): string => {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
};

interface OcorrenciaAmostra { exame: string; tipo: "Coleta" | "Análise"; motivo: string; data: string; }
interface OcorrenciaAtendimento { id: string; protocolo: string; nome: string; cpf: string; data: string; dataProtocolo: string; dataOcorrencia: string; categoria: "atendimento" | "amostra" | "misto"; motivoAtendimento?: string; amostras: OcorrenciaAmostra[]; }

const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const RelatorioOcorrencias = () => {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("todos");
  const [statusFilter, setStatusFilter] = useState<"todos" | "pendentes" | "resolvidas">("todos");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [selectedItem, setSelectedItem] = useState<OcorrenciaAtendimento | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveNote, setResolveNote] = useState("");
  const [resolvedMap, setResolvedMap] = useState<Record<string, { resolucao: string; data: string }>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [examesCancelados, setExamesCancelados] = useState<ExameOperacionalRow[]>([]);
  const [, setTick] = useState(0);
  const ITEMS_PER_PAGE = 5;

  // ── Branch por flag ──────────────────────────────────────────────────
  // ON: usa `useOcorrenciasPage` (RPC `ocorrencias_page`, sem cache global).
  // OFF / USE_LEGACY_STORE: mantém o caminho legado com `getAtendimentos`
  // + `getExamesOperacionaisByStatus` intactos.
  const flagPaginated = useFeatureFlag("paginated_atendimentos");
  const flagLegacy = useFeatureFlag("USE_LEGACY_STORE");
  const useServer = flagPaginated && !flagLegacy && !isFeatureEnabled("USE_LEGACY_STORE");

  const ocorrenciasServerHook = useOcorrenciasPage(
    {
      dateFrom: dateFrom ? toIsoDate(dateFrom) : undefined,
      dateTo: dateTo ? toIsoDate(dateTo) : undefined,
      q: search,
    },
    useServer,
  );

  // Carrega exames cancelados (a nível de exame) para detectar amostras canceladas em coleta/análise.
  // Apenas no caminho legado — server-side já vem unificado pela RPC.
  useEffect(() => {
    if (useServer) return;
    let mounted = true;
    const load = () => {
      getExamesOperacionaisByStatus(["cancelado"]).then((rows) => {
        if (mounted) setExamesCancelados(rows);
      }).catch(() => { /* ignore */ });
    };
    load();
    const unsub = subscribeAtendimentos(() => { setTick(t => t + 1); load(); });
    return () => { mounted = false; unsub(); };
  }, [useServer]);

  // ── Agregação a partir das rows do RPC (modo server) ─────────────────
  // Junta rows de `kind=atendimento` e `kind=amostra` por protocolo,
  // produzindo o mesmo shape `OcorrenciaAtendimento` da UI legada.
  const ocorrenciasFromServer = useMemo<OcorrenciaAtendimento[]>(() => {
    if (!useServer) return [];
    const map = new Map<string, OcorrenciaAtendimento>();
    const ensure = (r: OcorrenciaRow): OcorrenciaAtendimento => {
      const existing = map.get(r.protocolo);
      if (existing) return existing;
      const dataProtocolo = formatIsoBR(r.data_protocolo);
      const dataOcorrencia = formatIsoBR(r.occurred_at);
      const created: OcorrenciaAtendimento = {
        id: r.protocolo,
        protocolo: r.protocolo,
        nome: r.paciente_nome,
        cpf: r.paciente_cpf,
        data: dataOcorrencia || dataProtocolo,
        dataProtocolo,
        dataOcorrencia,
        categoria: "amostra",
        amostras: [],
      };
      map.set(r.protocolo, created);
      return created;
    };

    for (const r of ocorrenciasServerHook.items) {
      const entry = ensure(r);
      if (r.kind === "atendimento") {
        entry.motivoAtendimento = r.motivo || "Não informado";
        entry.dataProtocolo = formatIsoBR(r.data_protocolo);
        entry.dataOcorrencia = formatIsoBR(r.occurred_at);
        entry.categoria = entry.amostras.length > 0 ? "misto" : "atendimento";
      } else {
        const tipo: "Coleta" | "Análise" = r.exame_data_analise ? "Análise" : "Coleta";
        const dataAmostra = formatIsoBR(r.exame_data_analise || r.exame_data_coleta, false);
        entry.amostras.push({
          exame: r.exame_nome ?? "—",
          tipo,
          motivo: r.motivo,
          data: dataAmostra,
        });
        if (entry.motivoAtendimento) entry.categoria = "misto";
      }
    }
    return Array.from(map.values());
  }, [useServer, ocorrenciasServerHook.items]);

  const ocorrenciasLegacy = useMemo<OcorrenciaAtendimento[]>(() => {
    if (useServer) return [];
    const map = new Map<string, OcorrenciaAtendimento>();
    const getOrCreate = (protocolo: string, nome: string, cpf: string, data: string, dataProtocolo: string, dataOcorrencia: string): OcorrenciaAtendimento => {
      if (!map.has(protocolo)) map.set(protocolo, { id: protocolo, protocolo, nome, cpf, data, dataProtocolo, dataOcorrencia, categoria: "amostra", amostras: [] });
      return map.get(protocolo)!;
    };
    const allAtendimentos = getAtendimentos();
    allAtendimentos.filter(a => a.statusAtendimento.label === "Cancelado" || a.statusAtendimento.label === "Pedido cancelado").forEach(a => {
      const dataOcorrencia = a.updatedAt || a.data;
      const entry = getOrCreate(a.protocolo, a.nome, a.cpf, a.data, a.data, dataOcorrencia);
      entry.dataProtocolo = a.data;
      entry.dataOcorrencia = dataOcorrencia;
      entry.motivoAtendimento = a.motivoCancelamento || "Não informado";
      entry.categoria = entry.amostras.length > 0 ? "misto" : "atendimento";
    });
    // Mapa auxiliar: protocolo → MockAtendimento (para resolver dataProtocolo nos exames cancelados)
    const atByProtocolo = new Map(allAtendimentos.map(a => [a.protocolo, a]));
    // Exames cancelados individualmente (não totalmente cancelados no atendimento)
    examesCancelados.forEach(p => {
      p.exames.forEach(e => {
        if (e.status !== "cancelado") return;
        const at = atByProtocolo.get(p.protocolo);
        const dataProtocolo = at?.data || "";
        // Data da ocorrência do exame: updated_at (cancelamento) > data_analise > data_coleta
        const dataOcorrenciaIso = e.updated_at || e.data_analise || e.data_coleta || "";
        const dataOcorrenciaFmt = dataOcorrenciaIso ? format(new Date(dataOcorrenciaIso), "dd/MM/yyyy HH:mm:ss") : "";
        const dataAmostraFmt = (e.data_analise || e.data_coleta) ? format(new Date((e.data_analise || e.data_coleta) as string), "dd/MM/yyyy") : "";
        const entry = getOrCreate(p.protocolo, p.paciente_nome, p.paciente_cpf, dataOcorrenciaFmt, dataProtocolo, dataOcorrenciaFmt);
        // Garante que dataProtocolo/dataOcorrencia fiquem corretos quando entry foi criado pelo atendimento
        if (!entry.dataProtocolo) entry.dataProtocolo = dataProtocolo;
        if (!entry.dataOcorrencia) entry.dataOcorrencia = dataOcorrenciaFmt;
        // Heurística: tem data_analise => cancelado em análise; tem data_coleta sem data_analise => cancelado em coleta
        const tipo: "Coleta" | "Análise" = e.data_analise ? "Análise" : "Coleta";
        const motivo = e.motivo_cancelamento || (tipo === "Análise" ? "Cancelado na etapa de análise" : "Cancelado na etapa de coleta");
        entry.amostras.push({ exame: e.nome, tipo, motivo, data: dataAmostraFmt });
        if (entry.motivoAtendimento) entry.categoria = "misto";
      });
    });
    return Array.from(map.values());
  }, [useServer, examesCancelados]);

  const ocorrencias = useServer ? ocorrenciasFromServer : ocorrenciasLegacy;

  const filtered = useMemo(() => {
    let items = ocorrencias;
    if (tab === "atendimentos") items = items.filter(i => i.categoria === "atendimento" || i.categoria === "misto");
    else if (tab === "amostras") items = items.filter(i => i.categoria === "amostra" || i.categoria === "misto");
    if (statusFilter === "pendentes") items = items.filter(i => !resolvedMap[i.id]);
    else if (statusFilter === "resolvidas") items = items.filter(i => !!resolvedMap[i.id]);
    if (search.trim()) { const term = normalize(search.trim()); items = items.filter(i => normalize(i.nome).includes(term) || normalize(i.protocolo).includes(term) || (i.cpf && i.cpf.replace(/\D/g, "").includes(term.replace(/\D/g, "")))); }
    if (dateFrom || dateTo) { items = items.filter(i => { const d = parseDateBR(i.dataOcorrencia || i.data); if (!d) return false; if (dateFrom && d < dateFrom) return false; if (dateTo) { const end = new Date(dateTo); end.setHours(23, 59, 59, 999); if (d > end) return false; } return true; }); }
    return items;
  }, [ocorrencias, search, tab, statusFilter, dateFrom, dateTo, resolvedMap]);

  const totalAtendimentos = ocorrencias.filter(i => i.categoria === "atendimento" || i.categoria === "misto").length;
  const totalAmostras = ocorrencias.filter(i => i.categoria === "amostra" || i.categoria === "misto").length;
  const totalResolvidas = ocorrencias.filter(i => !!resolvedMap[i.id]).length;
  const totalPendentes = ocorrencias.length - totalResolvidas;

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedItems = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);
  const resetPage = () => setCurrentPage(1);
  const isResolved = (id: string) => !!resolvedMap[id];

  const categoriaIcon = (cat: OcorrenciaAtendimento["categoria"]) => {
    if (cat === "atendimento") return <XCircle className="h-4 w-4 text-destructive" />;
    if (cat === "amostra") return <FlaskConical className="h-4 w-4 text-status-warning" />;
    return <ClipboardList className="h-4 w-4 text-destructive" />;
  };

  const openDetail = (item: OcorrenciaAtendimento) => { setSelectedItem(item); setDetailOpen(true); };
  const openResolve = (item: OcorrenciaAtendimento) => { setSelectedItem(item); setResolveNote(""); setResolveOpen(true); };
  const handleResolve = () => {
    if (!selectedItem) return;
    if (!resolveNote.trim()) { toast.error("Informe uma descrição da resolução."); return; }
    setResolvedMap(prev => ({ ...prev, [selectedItem.id]: { resolucao: resolveNote.trim(), data: format(new Date(), "dd/MM/yyyy HH:mm") } }));
    setResolveOpen(false); toast.success("Ocorrência resolvida com sucesso!");
  };

  const statsCards = [
    { label: "Total", value: ocorrencias.length, icon: TrendingDown, color: "text-destructive", bg: "bg-destructive/8", filter: "todos" as const },
    { label: "Pendentes", value: totalPendentes, icon: AlertTriangle, color: "text-status-warning", bg: "bg-status-warning/10", filter: "pendentes" as const },
    { label: "Resolvidas", value: totalResolvidas, icon: CheckCircle2, color: "text-status-success", bg: "bg-status-success/10", filter: "resolvidas" as const },
    { label: "C/ Amostras", value: totalAmostras, icon: FlaskConical, color: "text-primary", bg: "bg-primary/8", filter: "todos" as const },
  ];

  const tabItems = [
    { key: "todos", label: "Todos", count: ocorrencias.length },
    { key: "atendimentos", label: "Atendimentos", count: totalAtendimentos },
    { key: "amostras", label: "Amostras", count: totalAmostras },
  ];

  return (
    <div className="p-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        eyebrow="Relatórios"
        title="Ocorrências"
        description="Atendimentos e amostras cancelados."
        actions={
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input placeholder="Buscar nome, protocolo ou CPF..." value={search} onChange={e => { setSearch(e.target.value); resetPage(); }} className="w-full h-10 pl-10 pr-4 rounded-xl border border-border/60 bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all" />
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statsCards.map(card => {
          const Icon = card.icon;
          const isActive = statusFilter === card.filter && card.filter !== "todos" || (statusFilter === "todos" && card.label === "Total");
          return (
            <button key={card.label} onClick={() => { setStatusFilter(card.filter); resetPage(); }} className={cn("flex items-center gap-3 rounded-3xl p-4 transition-all text-left border", isActive ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20" : "bg-card text-card-foreground border-border/60 hover:border-primary/40 hover:shadow-md")}>
              <div className={cn("h-10 w-10 rounded-2xl flex items-center justify-center shrink-0", isActive ? "bg-primary-foreground/20" : card.bg)}>
                <Icon className={cn("h-5 w-5", isActive ? "text-primary-foreground" : card.color)} />
              </div>
              <div>
                <p className={cn("text-xs font-semibold", isActive ? "text-primary-foreground/70" : "text-muted-foreground")}>{card.label}</p>
                <p className={cn("text-xl font-bold", isActive ? "text-primary-foreground" : "text-foreground")}>{card.value}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Date filters */}
      <div className="rounded-3xl border border-border/60 bg-card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_auto] items-end gap-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Data inicial</label>
            <Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-full justify-start font-normal h-10 text-sm rounded-2xl", !dateFrom && "text-muted-foreground")}><CalendarIcon className="mr-2 h-3.5 w-3.5" />{dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Selecionar"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus locale={ptBR} className="p-3 pointer-events-auto" /></PopoverContent></Popover>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Data final</label>
            <Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-full justify-start font-normal h-10 text-sm rounded-2xl", !dateTo && "text-muted-foreground")}><CalendarIcon className="mr-2 h-3.5 w-3.5" />{dateTo ? format(dateTo, "dd/MM/yyyy") : "Selecionar"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus locale={ptBR} className="p-3 pointer-events-auto" /></PopoverContent></Popover>
          </div>
          {(dateFrom || dateTo) && <Button variant="ghost" size="sm" onClick={() => { setDateFrom(undefined); setDateTo(undefined); resetPage(); }} className="text-muted-foreground h-10 rounded-2xl"><X className="h-3.5 w-3.5 mr-1" />Limpar</Button>}
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 sm:flex sm:w-fit items-center gap-1 p-1 bg-muted/40 rounded-2xl border border-border/30">
        {tabItems.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); resetPage(); }}
            className={cn(
              "flex items-center justify-center gap-1.5 px-2 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all min-w-0",
              tab === t.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-card/60"
            )}
          >
            <span className="truncate">{t.label}</span>
            <span className={cn(
              "text-[10px] sm:text-[11px] rounded-lg px-1.5 py-0.5 font-bold shrink-0",
              tab === t.key ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="rounded-3xl border border-border/60 bg-card overflow-hidden">
        <div className="p-4 bg-muted/15 border-b border-border/30 flex items-center justify-between">
          <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-primary" /><span className="text-sm font-semibold text-foreground">Lista de Ocorrências</span></div>
          <span className="text-xs text-muted-foreground">{filtered.length} registros</span>
        </div>

        {filtered.length === 0 ? (
          <div className="p-20 text-center">
            <div className="h-12 w-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-3"><AlertTriangle className="h-6 w-6 text-muted-foreground" /></div>
            <p className="text-sm text-muted-foreground font-medium">Nenhuma ocorrência encontrada</p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead><tr className="bg-muted/10 border-b border-border/30"><th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase w-24">Tipo</th><th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase">Protocolo</th><th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase">Paciente</th><th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase">Ocorrências</th><th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase">Status</th><th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase">Ações</th></tr></thead>
                <tbody>
                  {paginatedItems.map(item => (
                    <tr key={item.id} className={cn("border-b border-border/15 last:border-0 hover:bg-muted/10 transition-colors group", isResolved(item.id) && "opacity-60")}>
                      <td className="px-5 py-4"><div className="flex items-center gap-2">{categoriaIcon(item.categoria)}<span className="text-xs">{item.categoria === "atendimento" ? "Atend." : item.categoria === "amostra" ? "Amostra" : "Misto"}</span></div></td>
                      <td className="px-5 py-4">
                        <div className="font-mono text-xs text-muted-foreground">{item.protocolo}</div>
                        <div className="text-[11px] text-muted-foreground/80 mt-0.5">{item.dataOcorrencia || item.data || "—"}</div>
                      </td>
                      <td className="px-5 py-4 text-sm font-medium text-foreground">{item.nome}</td>
                      <td className="px-5 py-4 text-xs text-muted-foreground">{item.motivoAtendimento && <p className="text-destructive">Atendimento cancelado</p>}{item.amostras.length > 0 && <p>{item.amostras.length} amostra(s)</p>}</td>
                      <td className="px-5 py-4">{isResolved(item.id) ? <StatusBadge label="Resolvido" type="success" /> : <StatusBadge label="Pendente" type="warning" />}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 rounded-xl hover:bg-primary/10 hover:text-primary" onClick={() => openDetail(item)}><Eye className="h-3.5 w-3.5" />Detalhes</Button>
                          {!isResolved(item.id) && <Button size="sm" className="h-8 text-xs gap-1.5 rounded-xl bg-status-success hover:bg-status-success/90 text-primary-foreground" onClick={() => openResolve(item)}><CheckCircle2 className="h-3.5 w-3.5" />Resolver</Button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="lg:hidden divide-y divide-border/30">
              {paginatedItems.map(item => {
                const tipoLabel = item.categoria === "atendimento" ? "Atendimento" : item.categoria === "amostra" ? "Amostra" : "Misto";
                const tipoColor = item.categoria === "amostra"
                  ? "bg-status-warning/10 text-status-warning"
                  : "bg-destructive/10 text-destructive";
                return (
                  <div key={item.id} className={cn("p-4 space-y-3", isResolved(item.id) && "opacity-60")}>
                    {/* Linha 1: tipo + status */}
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold", tipoColor)}>
                        {categoriaIcon(item.categoria)}
                        {tipoLabel}
                      </span>
                      {isResolved(item.id) ? <StatusBadge label="Resolvido" type="success" /> : <StatusBadge label="Pendente" type="warning" />}
                    </div>

                    {/* Linha 2: paciente + protocolo + data da ocorrência */}
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground leading-tight">{item.nome}</p>
                      <p className="text-[11px] font-mono text-muted-foreground">{item.protocolo}</p>
                      {(item.dataOcorrencia || item.data) && <p className="text-[11px] text-muted-foreground/80">{item.dataOcorrencia || item.data}</p>}
                    </div>

                    {/* Motivo do atendimento cancelado */}
                    {item.motivoAtendimento && (
                      <div className="flex items-start gap-2 rounded-2xl bg-destructive/5 border border-destructive/15 px-3 py-2">
                        <XCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-destructive">Atendimento cancelado</p>
                          <p className="text-xs text-foreground/80 mt-0.5 break-words">{item.motivoAtendimento}</p>
                        </div>
                      </div>
                    )}

                    {/* Resumo de amostras */}
                    {item.amostras.length > 0 && (
                      <div className="flex items-center gap-2 rounded-2xl bg-status-warning/5 border border-status-warning/15 px-3 py-2">
                        <FlaskConical className="h-3.5 w-3.5 text-status-warning shrink-0" />
                        <p className="text-xs text-foreground/80">
                          <span className="font-semibold text-status-warning">{item.amostras.length}</span> amostra(s) cancelada(s)
                        </p>
                      </div>
                    )}

                    {/* Ações */}
                    <div className="flex gap-2 pt-1">
                      <Button variant="outline" size="sm" className="h-9 text-xs rounded-2xl gap-1.5 flex-1" onClick={() => openDetail(item)}>
                        <Eye className="h-3.5 w-3.5" />Detalhes
                      </Button>
                      {!isResolved(item.id) && (
                        <Button size="sm" className="h-9 text-xs rounded-2xl gap-1.5 bg-status-success hover:bg-status-success/90 text-primary-foreground flex-1" onClick={() => openResolve(item)}>
                          <CheckCircle2 className="h-3.5 w-3.5" />Resolver
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-border/30">
                <span className="text-xs text-muted-foreground">{(safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)} de {filtered.length}</span>
                <div className="flex items-center gap-1">
                  <button className="p-2 rounded-xl hover:bg-muted transition-colors disabled:opacity-30" disabled={safePage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}><ChevronLeft className="h-4 w-4" /></button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1).reduce<(number | "...")[]>((acc, p, idx, arr) => { if (idx > 0 && p - (arr[idx - 1]) > 1) acc.push("..."); acc.push(p); return acc; }, []).map((p, idx) => p === "..." ? <span key={`dot-${idx}`} className="px-1 text-muted-foreground text-sm">…</span> : <button key={p} onClick={() => setCurrentPage(p as number)} className={cn("h-8 w-8 rounded-xl text-sm font-medium transition-colors", p === safePage ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted")}>{p}</button>)}
                  <button className="p-2 rounded-xl hover:bg-muted transition-colors disabled:opacity-30" disabled={safePage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}><ChevronRight className="h-4 w-4" /></button>
                </div>
              </div>
            )}

            {/* Loader server-side: aparece quando há mais páginas no RPC */}
            {useServer && ocorrenciasServerHook.hasMore && (
              <div className="flex justify-center px-5 py-4 border-t border-border/30">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-2xl"
                  disabled={ocorrenciasServerHook.loadingMore}
                  onClick={() => void ocorrenciasServerHook.loadMore()}
                >
                  {ocorrenciasServerHook.loadingMore ? "Carregando…" : "Carregar mais ocorrências"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Dialog */}
      <StandardDialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        icon={<Info className="h-5 w-5 text-primary" />}
        title="Detalhes da Ocorrência"
        maxWidth="lg"
        footer={
          <>
            <Button variant="outline" className="rounded-2xl" onClick={() => setDetailOpen(false)}>Fechar</Button>
            {selectedItem && !isResolved(selectedItem.id) && <Button className="bg-status-success hover:bg-status-success/90 text-primary-foreground rounded-2xl" onClick={() => { setDetailOpen(false); openResolve(selectedItem); }}><CheckCircle2 className="h-4 w-4 mr-1" />Resolver</Button>}
          </>
        }
      >
        {selectedItem && (
          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-muted-foreground text-xs">Protocolo</p><p className="font-mono font-medium">{selectedItem.protocolo}</p></div>
              <div><p className="text-muted-foreground text-xs">Data de criação do protocolo</p><p className="font-medium">{selectedItem.dataProtocolo || selectedItem.data || "—"}</p></div>
              <div><p className="text-muted-foreground text-xs">Data de criação da ocorrência</p><p className="font-medium">{selectedItem.dataOcorrencia || "—"}</p></div>
              <div className="col-span-2"><p className="text-muted-foreground text-xs">Paciente</p><p className="font-medium">{selectedItem.nome}</p></div>
              {selectedItem.cpf && <div className="col-span-2"><p className="text-muted-foreground text-xs">CPF</p><p className="font-medium">{selectedItem.cpf}</p></div>}
            </div>
            {selectedItem.motivoAtendimento && (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
                <div className="flex items-start gap-2"><XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" /><div><p className="text-xs font-medium text-destructive">Atendimento cancelado</p><p className="text-sm text-foreground mt-1">{selectedItem.motivoAtendimento}</p></div></div>
              </div>
            )}
            {selectedItem.amostras.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Amostras canceladas ({selectedItem.amostras.length})</p>
                {selectedItem.amostras.map((amostra, idx) => (
                  <div key={idx} className="rounded-2xl border border-status-warning/20 bg-status-warning/5 p-4">
                    <div className="flex items-start gap-2"><FlaskConical className="h-4 w-4 text-status-warning mt-0.5 shrink-0" /><div className="flex-1"><div className="flex items-center justify-between"><p className="text-sm font-medium">{amostra.exame}</p><span className="text-[10px] px-2 py-0.5 rounded-xl bg-muted text-muted-foreground">{amostra.tipo}</span></div><p className="text-xs text-status-warning mt-1">{amostra.motivo}</p>{amostra.data && <p className="text-[11px] text-muted-foreground mt-0.5">{amostra.data}</p>}</div></div>
                  </div>
                ))}
              </div>
            )}
            {isResolved(selectedItem.id) && (
              <div className="rounded-2xl border border-status-success/20 bg-status-success/5 p-4">
                <div className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-status-success mt-0.5 shrink-0" /><div><p className="text-xs font-medium text-status-success">Resolução ({resolvedMap[selectedItem.id].data})</p><p className="text-sm mt-1">{resolvedMap[selectedItem.id].resolucao}</p></div></div>
              </div>
            )}
          </div>
        )}
      </StandardDialog>

      {/* Resolve Dialog */}
      <StandardDialog
        open={resolveOpen}
        onClose={() => setResolveOpen(false)}
        icon={<CheckCircle2 className="h-5 w-5 text-status-success" />}
        title="Resolver Ocorrência"
        maxWidth="md"
        footer={
          <>
            <Button variant="outline" className="rounded-2xl" onClick={() => setResolveOpen(false)}>Cancelar</Button>
            <Button className="bg-status-success hover:bg-status-success/90 text-white rounded-2xl" onClick={handleResolve}><CheckCircle2 className="h-4 w-4 mr-1" />Confirmar</Button>
          </>
        }
      >
        {selectedItem && (
          <div className="px-6 py-5 space-y-4">
            <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 text-sm space-y-1">
              <p className="font-medium">{selectedItem.nome}</p>
              <p className="text-xs text-muted-foreground">{selectedItem.protocolo}</p>
              {selectedItem.motivoAtendimento && <p className="text-xs text-destructive">• Atendimento cancelado</p>}
              {selectedItem.amostras.map((a, i) => <p key={i} className="text-xs text-status-warning">• {a.exame} — {a.motivo}</p>)}
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Descrição da resolução *</label>
              <Textarea placeholder="Descreva como a ocorrência foi resolvida..." value={resolveNote} onChange={e => setResolveNote(e.target.value)} className="mt-1.5 rounded-2xl" rows={4} />
            </div>
          </div>
        )}
      </StandardDialog>
    </div>
  );
};

export default RelatorioOcorrencias;
