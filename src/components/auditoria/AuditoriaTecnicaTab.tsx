import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Clock, Eye, Filter, Loader2, Plus, Pencil, Trash2, X,
  Database, ChevronDown, Download, FileText, ChevronsUpDown,
} from "lucide-react";
import {
  fetchAuditLogs, fetchAuditTabelas, diffObjects,
  exportAuditLogsCsv, exportAuditLogsPdf, fetchAuditLogsAll,
  type AuditLogTech, type AuditAcao, type AuditDiffField,
} from "@/data/auditLogsStore";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function iniciaisFromEmail(email: string | null): string {
  if (!email) return "··";
  const local = email.split("@")[0] || email;
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

function avatarClass(iniciais: string): string {
  const h = iniciais.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const palette = [
    "bg-primary/10 text-primary",
    "bg-status-success-bg text-[hsl(var(--status-success))]",
    "bg-status-warning-bg text-[hsl(var(--status-warning))]",
    "bg-status-info-bg text-[hsl(var(--status-info))]",
  ];
  return palette[h % palette.length];
}

const ACAO_BADGE: Record<AuditAcao, { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }> = {
  INSERT: { label: "Criação", cls: "bg-status-success-bg text-[hsl(var(--status-success))] border-[hsl(var(--status-success))]/30", icon: Plus },
  UPDATE: { label: "Alteração", cls: "bg-status-info-bg text-[hsl(var(--status-info))] border-[hsl(var(--status-info))]/30", icon: Pencil },
  DELETE: { label: "Exclusão", cls: "bg-status-danger-bg text-[hsl(var(--status-danger))] border-[hsl(var(--status-danger))]/30", icon: Trash2 },
};

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v.length > 80 ? v.slice(0, 80) + "…" : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try { return JSON.stringify(v); } catch { return String(v); }
}

/* ------------------------------------------------------------------ */
/* Componente                                                          */
/* ------------------------------------------------------------------ */

const PAGE_SIZE = 30;
const DIFF_INITIAL_FIELDS = 8;       // mostra primeiro N campos
const DIFF_LOAD_MORE_STEP = 20;      // passo do "ver mais"
const EXPORT_PAGE_TRIGGER = 1000;    // a partir disso, usa stream paginado
const STORAGE_PREFIX = "sislac.auditoria-tecnica.filters.v1";
const PROGRESS_PREFIX = "sislac.auditoria-tecnica.export-progress.v1";
const PROGRESS_TTL_MS = 5 * 60 * 1000; // 5 min — só restaura se for recente

type ExportScope = "page" | "all";

interface PersistedExportProgress {
  kind: "csv" | "pdf";
  scope: ExportScope;
  loaded: number;
  rendered?: number;
  total?: number;
  message: string;
  startedAt: number;
}

function progressKey(atendimentoId?: string | null): string {
  return `${PROGRESS_PREFIX}:${atendimentoId ?? "global"}`;
}

function loadProgress(atendimentoId?: string | null): PersistedExportProgress | null {
  try {
    const raw = sessionStorage.getItem(progressKey(atendimentoId));
    if (!raw) return null;
    const p = JSON.parse(raw) as PersistedExportProgress;
    if (!p || typeof p !== "object") return null;
    if (Date.now() - (p.startedAt ?? 0) > PROGRESS_TTL_MS) {
      sessionStorage.removeItem(progressKey(atendimentoId));
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

function saveProgress(atendimentoId: string | null | undefined, p: PersistedExportProgress | null): void {
  try {
    if (p === null) sessionStorage.removeItem(progressKey(atendimentoId));
    else sessionStorage.setItem(progressKey(atendimentoId), JSON.stringify(p));
  } catch { /* noop */ }
}

interface PersistedFilters {
  tabelaFilter: string;
  acaoFilter: AuditAcao | "all";
  search: string;
}

function storageKey(atendimentoId?: string | null): string {
  return `${STORAGE_PREFIX}:${atendimentoId ?? "global"}`;
}

function loadFilters(atendimentoId?: string | null): PersistedFilters | null {
  try {
    const raw = sessionStorage.getItem(storageKey(atendimentoId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedFilters>;
    if (typeof parsed !== "object" || parsed === null) return null;
    // Validação defensiva — só aceita strings esperadas
    const acao = parsed.acaoFilter;
    const acaoOk = acao === "all" || acao === "INSERT" || acao === "UPDATE" || acao === "DELETE";
    return {
      tabelaFilter: typeof parsed.tabelaFilter === "string" ? parsed.tabelaFilter : "all",
      acaoFilter: acaoOk ? (acao as AuditAcao | "all") : "all",
      search: typeof parsed.search === "string" ? parsed.search.slice(0, 200) : "",
    };
  } catch {
    return null;
  }
}

function saveFilters(atendimentoId: string | null | undefined, f: PersistedFilters): void {
  try {
    sessionStorage.setItem(storageKey(atendimentoId), JSON.stringify(f));
  } catch {
    /* sessionStorage indisponível — ignora */
  }
}

interface Props {
  /** Quando definido, filtra logs apenas das tabelas/registros relacionados a este atendimento. */
  atendimentoFilter?: {
    atendimentoId: string;
    exameIds?: string[];
    pagamentoIds?: string[];
  };
}

export default function AuditoriaTecnicaTab({ atendimentoFilter }: Props) {
  // Restaura filtros do sessionStorage no mount, isolado por atendimento.
  const initial = useMemo(
    () => loadFilters(atendimentoFilter?.atendimentoId ?? null),
    // Recalcula quando muda o atendimento — escopo diferente, filtros diferentes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [atendimentoFilter?.atendimentoId],
  );

  const [tabelas, setTabelas] = useState<string[]>([]);
  const [tabelaFilter, setTabelaFilter] = useState<string>(initial?.tabelaFilter ?? "all");
  const [acaoFilter, setAcaoFilter] = useState<AuditAcao | "all">(initial?.acaoFilter ?? "all");
  const [search, setSearch] = useState(initial?.search ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(initial?.search ?? "");

  const [logs, setLogs] = useState<AuditLogTech[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState<null | "csv" | "pdf">(null);
  const [exportProgress, setExportProgress] = useState<string>("");
  const [exportScope, setExportScope] = useState<ExportScope>("page");
  const [resumedProgress, setResumedProgress] = useState<PersistedExportProgress | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [detailLog, setDetailLog] = useState<AuditLogTech | null>(null);
  const [diffVisibleCount, setDiffVisibleCount] = useState<number>(DIFF_INITIAL_FIELDS);

  // Persiste filtros sempre que mudam (escopado por atendimento)
  useEffect(() => {
    saveFilters(atendimentoFilter?.atendimentoId ?? null, {
      tabelaFilter,
      acaoFilter,
      search,
    });
  }, [tabelaFilter, acaoFilter, search, atendimentoFilter?.atendimentoId]);

  // Reaplica filtros salvos quando muda o escopo (atendimento)
  useEffect(() => {
    const saved = loadFilters(atendimentoFilter?.atendimentoId ?? null);
    if (saved) {
      setTabelaFilter(saved.tabelaFilter);
      setAcaoFilter(saved.acaoFilter);
      setSearch(saved.search);
      setDebouncedSearch(saved.search);
    }
  }, [atendimentoFilter?.atendimentoId]);

  // Debounce busca
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Lista de tabelas (uma vez)
  useEffect(() => {
    fetchAuditTabelas().then(setTabelas);
  }, []);

  // Reset paginação quando filtros mudam
  useEffect(() => {
    setPage(0);
    setHasMore(true);
  }, [tabelaFilter, acaoFilter, debouncedSearch, atendimentoFilter?.atendimentoId]);

  // Reset visibilidade do diff ao trocar de log
  useEffect(() => {
    setDiffVisibleCount(DIFF_INITIAL_FIELDS);
  }, [detailLog?.id]);

  // Restaura progresso de exportação interrompido (se recente).
  useEffect(() => {
    const saved = loadProgress(atendimentoFilter?.atendimentoId ?? null);
    if (saved) setResumedProgress(saved);
    else setResumedProgress(null);
  }, [atendimentoFilter?.atendimentoId]);

  // Toast quando store sinaliza falha parcial em algum registro.
  useEffect(() => {
    function onPartial(e: Event) {
      const detail = (e as CustomEvent<{ kind: string; failed: number }>).detail;
      if (detail?.failed > 0) {
        toast.warning(
          `${detail.failed} registro(s) falharam ao renderizar e foram omitidos do ${detail.kind?.toUpperCase()}.`,
        );
      }
    }
    window.addEventListener("auditExport:partialFailure", onPartial as EventListener);
    return () => window.removeEventListener("auditExport:partialFailure", onPartial as EventListener);
  }, []);

  // Cancela qualquer export pendente ao desmontar.
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const buildParams = useCallback((offset: number) => {
    const params: Parameters<typeof fetchAuditLogs>[0] = {
      limit: PAGE_SIZE,
      offset,
    };
    if (tabelaFilter !== "all") params.tabela = tabelaFilter;
    if (acaoFilter !== "all") params.acao = acaoFilter;
    if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
    // Filtro automático por atendimento — busca por atendimento_id e ids relacionados
    if (atendimentoFilter && tabelaFilter === "all") {
      const ids = [atendimentoFilter.atendimentoId];
      if (atendimentoFilter.exameIds) ids.push(...atendimentoFilter.exameIds);
      if (atendimentoFilter.pagamentoIds) ids.push(...atendimentoFilter.pagamentoIds);
      params.registroIds = ids;
    } else if (atendimentoFilter && tabelaFilter !== "all") {
      // Quando uma tabela específica é escolhida, usa o id mais relevante
      if (tabelaFilter === "atendimentos") params.registroId = atendimentoFilter.atendimentoId;
      else if (tabelaFilter === "atendimento_exames" && atendimentoFilter.exameIds?.length) {
        params.registroIds = atendimentoFilter.exameIds;
      } else if (tabelaFilter === "atendimento_pagamentos" && atendimentoFilter.pagamentoIds?.length) {
        params.registroIds = atendimentoFilter.pagamentoIds;
      }
    }
    return params;
  }, [tabelaFilter, acaoFilter, debouncedSearch, atendimentoFilter]);

  // Carga inicial / quando filtros mudam
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAuditLogs(buildParams(0))
      .then((data) => {
        if (cancelled) return;
        setLogs(data);
        setHasMore(data.length === PAGE_SIZE);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [buildParams]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    const data = await fetchAuditLogs(buildParams(nextPage * PAGE_SIZE));
    setLogs((prev) => [...prev, ...data]);
    setPage(nextPage);
    setHasMore(data.length === PAGE_SIZE);
    setLoadingMore(false);
  }, [buildParams, hasMore, loadingMore, page]);

  const detailDiff: AuditDiffField[] = useMemo(() => {
    if (!detailLog) return [];
    if (detailLog.acao === "UPDATE") return diffObjects(detailLog.antes, detailLog.depois);
    if (detailLog.acao === "INSERT") return Object.entries(detailLog.depois ?? {})
      .filter(([k]) => k !== "updated_at" && k !== "created_at")
      .map(([campo, para]): AuditDiffField => ({ campo, de: undefined, para }));
    if (detailLog.acao === "DELETE") return Object.entries(detailLog.antes ?? {})
      .filter(([k]) => k !== "updated_at" && k !== "created_at")
      .map(([campo, de]): AuditDiffField => ({ campo, de, para: undefined }));
    return [];
  }, [detailLog]);

  const visibleDiff = useMemo(() => detailDiff.slice(0, diffVisibleCount), [detailDiff, diffVisibleCount]);
  const remainingDiff = Math.max(0, detailDiff.length - diffVisibleCount);

  const handleExport = useCallback(async (kind: "csv" | "pdf") => {
    if (exporting) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setExporting(kind);
    setResumedProgress(null);
    setExportProgress("Buscando registros…");
    const atId = atendimentoFilter?.atendimentoId ?? null;
    const startedAt = Date.now();
    const persist = (msg: string, loaded: number, rendered?: number, total?: number) => {
      saveProgress(atId, { kind, scope: exportScope, loaded, rendered, total, message: msg, startedAt });
    };
    try {
      let data: AuditLogTech[];
      if (exportScope === "page") {
        // Apenas o que já está visível na lista atual (rápido, sem rede extra).
        data = logs;
      } else {
        // Exportar tudo: usa stream paginado independente do tamanho.
        const firstPage = await fetchAuditLogs({ ...buildParams(0), limit: EXPORT_PAGE_TRIGGER, offset: 0 });
        if (ctrl.signal.aborted) throw new DOMException("Aborted", "AbortError");
        data = firstPage;
        if (firstPage.length === EXPORT_PAGE_TRIGGER) {
          const baseParams = buildParams(0);
          delete (baseParams as { limit?: number }).limit;
          delete (baseParams as { offset?: number }).offset;
          data = await fetchAuditLogsAll(
            baseParams,
            (p) => {
              const msg = `Carregados ${p.loaded.toLocaleString("pt-BR")} registros…`;
              setExportProgress(msg);
              persist(msg, p.loaded);
            },
            ctrl.signal,
          );
        }
      }
      if (data.length === 0) {
        toast.info("Nenhum registro para exportar com os filtros atuais.");
        return;
      }
      const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      if (kind === "csv") {
        const msg = `Gerando CSV (${data.length.toLocaleString("pt-BR")} linhas)…`;
        setExportProgress(msg);
        persist(msg, data.length, data.length, data.length);
        exportAuditLogsCsv(data, `auditoria-tecnica-${ts}.csv`);
        toast.success(`${data.length} registro(s) exportado(s) em CSV.`);
      } else {
        await exportAuditLogsPdf(
          data,
          `auditoria-tecnica-${ts}.pdf`,
          (p) => {
            const msg = `Renderizando PDF: ${p.rendered.toLocaleString("pt-BR")} de ${p.total.toLocaleString("pt-BR")}…`;
            setExportProgress(msg);
            persist(msg, data.length, p.rendered, p.total);
          },
          ctrl.signal,
        );
        toast.success(`${data.length} registro(s) exportado(s) em PDF.`);
      }
      saveProgress(atId, null);
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") {
        toast.info("Exportação cancelada.");
      } else {
        toast.error("Falha ao exportar logs.");
        // eslint-disable-next-line no-console
        console.error(e);
      }
      saveProgress(atId, null);
    } finally {
      setExporting(null);
      setExportProgress("");
      abortRef.current = null;
    }
  }, [buildParams, exporting, exportScope, logs, atendimentoFilter?.atendimentoId]);

  const handleCancelExport = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleDismissResumed = useCallback(() => {
    saveProgress(atendimentoFilter?.atendimentoId ?? null, null);
    setResumedProgress(null);
  }, [atendimentoFilter?.atendimentoId]);

  return (
    <div>
      {/* Banner de contexto quando filtrado por atendimento */}
      {atendimentoFilter && (
        <div className="mb-4 px-4 py-2.5 rounded-xl bg-primary/8 border border-primary/20 text-xs text-foreground flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-primary" />
          Exibindo apenas mudanças técnicas relacionadas ao atendimento{" "}
          <span className="font-mono font-semibold">#{atendimentoFilter.atendimentoId}</span>
          {(atendimentoFilter.exameIds?.length || 0) + (atendimentoFilter.pagamentoIds?.length || 0) > 0 && (
            <span className="text-muted-foreground">
              (incluindo {atendimentoFilter.exameIds?.length ?? 0} exame(s) e {atendimentoFilter.pagamentoIds?.length ?? 0} pagamento(s))
            </span>
          )}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 min-w-0">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar por e-mail do usuário…"
            className="pl-9 pr-3 py-2.5 w-full bg-card border border-border/60 rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="relative">
          <Database className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <select
            value={tabelaFilter}
            onChange={(e) => setTabelaFilter(e.target.value)}
            className="pl-9 pr-9 py-2.5 bg-card border border-border/60 rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none min-w-[200px]"
          >
            <option value="all">Todas as tabelas</option>
            {tabelas.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={acaoFilter}
            onChange={(e) => setAcaoFilter(e.target.value as AuditAcao | "all")}
            className="pl-3 pr-9 py-2.5 bg-card border border-border/60 rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none min-w-[160px]"
          >
            <option value="all">Todas as ações</option>
            <option value="INSERT">Criação</option>
            <option value="UPDATE">Alteração</option>
            <option value="DELETE">Exclusão</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <select
              value={exportScope}
              onChange={(e) => setExportScope(e.target.value as ExportScope)}
              disabled={exporting !== null}
              className="pl-3 pr-8 py-2.5 bg-card border border-border/60 rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none disabled:opacity-50"
              title="Escopo da exportação"
            >
              <option value="page">Apenas página atual ({logs.length})</option>
              <option value="all">Exportar tudo (todos os filtros)</option>
            </select>
            <ChevronsUpDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          </div>
          <button
            type="button"
            onClick={() => handleExport("csv")}
            disabled={loading || exporting !== null || logs.length === 0}
            className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl bg-card border border-border/60 text-sm text-foreground hover:bg-accent/40 transition-colors disabled:opacity-50"
            title={exportScope === "all" ? "Exportar todos os logs (com paginação) em CSV" : "Exportar apenas a página visível em CSV"}
          >
            {exporting === "csv" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            CSV
          </button>
          <button
            type="button"
            onClick={() => handleExport("pdf")}
            disabled={loading || exporting !== null || logs.length === 0}
            className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl bg-card border border-border/60 text-sm text-foreground hover:bg-accent/40 transition-colors disabled:opacity-50"
            title={exportScope === "all" ? "Exportar todos os logs (com paginação) em PDF" : "Exportar apenas a página visível em PDF"}
          >
            {exporting === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            PDF
          </button>
        </div>
      </div>

      {/* Banner de progresso restaurado (export interrompido em sessão recente) */}
      {resumedProgress && !exporting && (
        <div className="mb-4 px-4 py-2.5 rounded-xl bg-status-warning-bg border border-[hsl(var(--status-warning))]/30 text-xs text-foreground flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Loader2 className="h-3.5 w-3.5 text-[hsl(var(--status-warning))]" />
            <span className="truncate">
              Exportação anterior interrompida ({resumedProgress.kind.toUpperCase()}, escopo {resumedProgress.scope === "all" ? "completo" : "página"}):{" "}
              <span className="font-semibold">{resumedProgress.message}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setExportScope(resumedProgress.scope);
                handleExport(resumedProgress.kind);
              }}
              className="px-3 py-1.5 rounded-lg bg-card border border-border/60 text-xs font-semibold text-foreground hover:bg-accent/40 transition-colors"
            >
              Retomar
            </button>
            <button
              type="button"
              onClick={handleDismissResumed}
              className="px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground"
            >
              Descartar
            </button>
          </div>
        </div>
      )}

      {exporting && exportProgress && (
        <div className="mb-4 px-4 py-2.5 rounded-xl bg-status-info-bg border border-[hsl(var(--status-info))]/25 text-xs text-[hsl(var(--status-info))] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
            <span className="truncate">{exportProgress}</span>
          </div>
          <button
            type="button"
            onClick={handleCancelExport}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-card border border-border/60 text-[11px] font-semibold text-foreground hover:bg-accent/40 transition-colors"
            title="Cancelar exportação"
          >
            <X className="h-3 w-3" />
            Cancelar
          </button>
        </div>
      )}

      {/* Lista (timeline) */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-card border border-border/60 rounded-2xl p-4 animate-pulse">
              <div className="h-3 w-1/3 bg-muted rounded mb-2" />
              <div className="h-3 w-1/4 bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-card border border-border/60 rounded-2xl p-12 text-center">
          <Database className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Nenhum registro técnico encontrado para os filtros aplicados.
          </p>
          <p className="text-xs text-muted-foreground/70 mt-2">
            Você só visualiza logs do tenant ao qual seu usuário pertence. Se acredita que faltam registros, verifique permissões com o administrador.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-0 max-w-3xl">
            {logs.map((log, idx) => {
              const cfg = ACAO_BADGE[log.acao];
              const Icon = cfg.icon;
              const iniciais = iniciaisFromEmail(log.userEmail);
              return (
                <div key={log.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`p-2 rounded-xl ${cfg.cls.split(" ")[0]} z-10 border-2 border-background`}>
                      <Icon className={`h-4 w-4 ${cfg.cls.split(" ")[1]}`} />
                    </div>
                    {idx < logs.length - 1 && <div className="w-px flex-1 bg-border/60" />}
                  </div>
                  <div className="flex-1 pb-5">
                    <div className="bg-card rounded-2xl border border-border/60 p-4 hover:shadow-sm transition-all duration-200">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-semibold ${cfg.cls}`}>
                              <Icon className="h-2.5 w-2.5" />
                              {cfg.label}
                            </span>
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-lg bg-muted/60 text-[10px] font-mono text-foreground"
                              title={`Tabela: ${log.tabela}`}
                            >
                              {log.tabela}
                            </span>
                            {log.registroId && (
                              <span
                                className="text-[10px] font-mono text-muted-foreground"
                                title={`ID completo: ${log.registroId}`}
                              >
                                #{log.registroId.length > 12 ? log.registroId.slice(0, 8) + "…" : log.registroId}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {fmtDateTime(log.createdAt)}
                          </div>
                        </div>
                        <button
                          onClick={() => setDetailLog(log)}
                          className="p-1.5 rounded-xl hover:bg-accent transition-colors text-muted-foreground hover:text-foreground shrink-0"
                          title="Ver detalhes"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold ${avatarClass(iniciais)}`}>
                          {iniciais}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">{log.userEmail || "Sistema"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {hasMore && (
            <div className="flex justify-center mt-6">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border/60 text-sm text-foreground hover:bg-accent/40 transition-colors disabled:opacity-50"
              >
                {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {loadingMore ? "Carregando…" : "Carregar mais"}
              </button>
            </div>
          )}
        </>
      )}

      {/* Drawer de detalhes */}
      {detailLog && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-foreground/30 backdrop-blur-[3px]" onClick={() => setDetailLog(null)} />
          <div className="relative w-full sm:max-w-xl bg-card border-l border-border shadow-[0_24px_80px_-12px_hsl(var(--foreground)/0.18)] overflow-y-auto animate-fade-in-up">
            <div className="sticky top-0 bg-card/95 backdrop-blur border-b border-border/60 px-6 py-4 flex items-center justify-between gap-3 z-10">
              <div className="min-w-0">
                <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Mudança técnica</p>
                <h3 className="text-base font-bold text-foreground truncate">{detailLog.tabela}</h3>
              </div>
              <button
                onClick={() => setDetailLog(null)}
                className="p-1.5 rounded-xl hover:bg-accent transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="px-6 py-5">
              <div className="grid grid-cols-2 gap-4 text-sm mb-5">
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Data/Hora</p>
                  <p className="font-medium text-foreground">{fmtDateTime(detailLog.createdAt)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Usuário</p>
                  <p className="font-medium text-foreground truncate" title={detailLog.userEmail ?? ""}>{detailLog.userEmail || "Sistema"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Registro</p>
                  <p className="font-mono text-xs text-foreground bg-muted/60 px-2 py-1 rounded-lg break-all">
                    {detailLog.registroId || "—"}
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {detailLog.acao === "UPDATE" ? "Campos alterados" : detailLog.acao === "INSERT" ? "Dados criados" : "Dados removidos"}
                  <span className="ml-2 text-muted-foreground/60 normal-case font-normal">({detailDiff.length})</span>
                </p>

                {detailDiff.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma mudança relevante.</p>
                ) : (
                  <div className="space-y-2">
                    {visibleDiff.map((d) => (
                      <div key={d.campo} className="bg-muted/30 rounded-xl border border-border/40 p-3">
                        <p className="text-xs font-bold text-foreground font-mono mb-2">{d.campo}</p>
                        {detailLog.acao === "UPDATE" ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">De</p>
                              <p className="text-[hsl(var(--status-danger))] line-through break-all" title={String(d.de ?? "")}>{formatValue(d.de)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Para</p>
                              <p className="text-[hsl(var(--status-success))] font-semibold break-all" title={String(d.para ?? "")}>{formatValue(d.para)}</p>
                            </div>
                          </div>
                        ) : detailLog.acao === "INSERT" ? (
                          <p className="text-xs text-[hsl(var(--status-success))] font-semibold break-all">{formatValue(d.para)}</p>
                        ) : (
                          <p className="text-xs text-[hsl(var(--status-danger))] line-through break-all">{formatValue(d.de)}</p>
                        )}
                      </div>
                    ))}
                    {remainingDiff > 0 && (
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="text-[11px] text-muted-foreground">
                          Exibindo {visibleDiff.length} de {detailDiff.length} campos
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setDiffVisibleCount((c) => Math.min(c + DIFF_LOAD_MORE_STEP, detailDiff.length))}
                            className="px-3 py-1.5 rounded-lg bg-card border border-border/60 text-xs font-semibold text-foreground hover:bg-accent/40 transition-colors"
                          >
                            Ver mais (+{Math.min(DIFF_LOAD_MORE_STEP, remainingDiff)})
                          </button>
                          <button
                            type="button"
                            onClick={() => setDiffVisibleCount(detailDiff.length)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-primary hover:underline"
                          >
                            Ver todos
                          </button>
                        </div>
                      </div>
                    )}
                    {detailDiff.length > DIFF_INITIAL_FIELDS && diffVisibleCount > DIFF_INITIAL_FIELDS && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setDiffVisibleCount(DIFF_INITIAL_FIELDS)}
                          className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                        >
                          Recolher
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}