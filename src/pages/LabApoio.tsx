import { PageHeader } from "@/components/shared/PageHeader";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2, Search, RefreshCw, Upload, Download, Check, ExternalLink,
  Loader2, FileText, Eye, History, AlertCircle, Inbox, Filter, Radio,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getTerceirizadosOperacionalPaged,
  callLabApoioAdapter,
  updateExameTerceirizado,
  type TerceirizadoOperacionalRow,
  type StatusExterno,
} from "@/data/atendimentoStore";
import { getLabsApoio, _initLabsApoioStore } from "@/data/labApoioStore";
import { getCachedTenantNome, getCurrentTenantId } from "@/lib/db/tenantResolver";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import LabBadge from "@/components/LabBadge";
import IntegrationStatusBadge from "@/components/IntegrationStatusBadge";
import AuditoriaIntegracaoDrawer from "@/components/AuditoriaIntegracaoDrawer";
import { abrirLaudoResolvido } from "@/lib/laudoResolver";
import { SEO } from "@/components/seo/SEO";

type TabKey = "a_enviar" | "aguardando" | "recebidos" | "atrasados" | "todos";

const TAB_TO_STATUSES: Record<Exclude<TabKey, "atrasados" | "todos">, StatusExterno[]> = {
  a_enviar:   ["AGUARDANDO_ENVIO"],
  aguardando: ["ENVIADO", "EM_ANALISE_LAB"],
  recebidos:  ["RESULTADO_RECEBIDO", "IMPORTADO", "FINALIZADO"],
};

// Status badge centralizado em IntegrationStatusBadge — não duplicar mapeamentos aqui.

const ATRASO_DIAS = 5;
const PAGE_SIZE = 50;
const normalize = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function diasDesde(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return null;
  return Math.floor((Date.now() - d) / 86400000);
}

const LabApoio = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("a_enviar");
  const [labFilter, setLabFilter] = useState<string>("__all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [rows, setRows] = useState<TerceirizadoOperacionalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [busyBatch, setBusyBatch] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [realtimeOn, setRealtimeOn] = useState(true);
  const [auditOpen, setAuditOpen] = useState<TerceirizadoOperacionalRow | null>(null);

  const labs = getLabsApoio();

  const reload = async () => {
    setLoading(true);
    const { rows: data, total: t } = await getTerceirizadosOperacionalPaged({
      limit: PAGE_SIZE,
      offset: 0,
    });
    setRows(data);
    setTotal(t);
    setSelected(new Set());
    setLoading(false);
  };

  const loadMore = async () => {
    if (loadingMore || rows.length >= total) return;
    setLoadingMore(true);
    const { rows: more } = await getTerceirizadosOperacionalPaged({
      limit: PAGE_SIZE,
      offset: rows.length,
    });
    // Mescla evitando duplicatas (caso realtime já tenha trazido alguns)
    setRows(prev => {
      const seen = new Set(prev.map(r => r.id));
      return [...prev, ...more.filter(r => !seen.has(r.id))];
    });
    setLoadingMore(false);
  };

  useEffect(() => {
    void _initLabsApoioStore().then(reload);
  }, []);

  // Realtime subscription
  useEffect(() => {
    if (!realtimeOn) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    void getCurrentTenantId().then((tid) => {
      if (cancelled || !tid) return;
      channel = supabase
        .channel(`lab-apoio:${tid}`, { config: { private: true } })
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "atendimento_exames", filter: `tenant_id=eq.${tid}` },
          (payload) => {
            const next = payload.new as Partial<TerceirizadoOperacionalRow> | null;
            const old = payload.old as Partial<TerceirizadoOperacionalRow> | null;
            if (payload.eventType === "DELETE") {
              setRows(prev => prev.filter(r => r.id !== old?.id));
              return;
            }
            if (!next?.id) return;
            setRows(prev => {
              const idx = prev.findIndex(r => r.id === next.id);
              if (idx === -1) {
                // Linha nova — recarrega para obter joins (paciente/protocolo)
                void reload();
                return prev;
              }
              const merged = { ...prev[idx], ...next } as TerceirizadoOperacionalRow;
              const copy = prev.slice();
              copy[idx] = merged;
              return copy;
            });
          },
        )
        .subscribe();
    });
    return () => {
      cancelled = true;
      if (channel) { try { void supabase.removeChannel(channel); } catch { /* noop */ } }
    };
  }, [realtimeOn]);

  // Contadores por aba (independem do filtro de busca)
  const counters = useMemo(() => {
    const c = { a_enviar: 0, aguardando: 0, recebidos: 0, atrasados: 0, todos: rows.length };
    for (const r of rows) {
      if (TAB_TO_STATUSES.a_enviar.includes(r.status_externo)) c.a_enviar++;
      if (TAB_TO_STATUSES.aguardando.includes(r.status_externo)) {
        c.aguardando++;
        const d = diasDesde(r.data_envio);
        if (d !== null && d >= ATRASO_DIAS) c.atrasados++;
      }
      if (TAB_TO_STATUSES.recebidos.includes(r.status_externo)) c.recebidos++;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (tab === "atrasados") {
      list = list.filter(r =>
        TAB_TO_STATUSES.aguardando.includes(r.status_externo) &&
        (diasDesde(r.data_envio) ?? 0) >= ATRASO_DIAS,
      );
    } else if (tab !== "todos") {
      const allowed = TAB_TO_STATUSES[tab];
      list = list.filter(r => allowed.includes(r.status_externo));
    }
    if (labFilter !== "__all") {
      list = list.filter(r => (r.lab_apoio_id ?? "") === labFilter);
    }
    const q = normalize(debouncedSearch);
    if (q) {
      list = list.filter(r =>
        normalize(r.paciente_nome).includes(q) ||
        normalize(r.protocolo).includes(q) ||
        normalize(r.nome_exame).includes(q) ||
        normalize(r.protocolo_externo ?? "").includes(q),
      );
    }
    return list;
  }, [rows, tab, labFilter, debouncedSearch]);

  // Agrupamento por laboratório (visualmente claro)
  const grouped = useMemo(() => {
    const map = new Map<string, { labId: string; labNome: string; rows: TerceirizadoOperacionalRow[] }>();
    for (const r of filtered) {
      const labId = r.lab_apoio_id ?? "__sem_lab";
      const labNome = labs.find(l => l.id === r.lab_apoio_id)?.nome ?? "Sem laboratório definido";
      const g = map.get(labId) ?? { labId, labNome, rows: [] };
      g.rows.push(r);
      map.set(labId, g);
    }
    return Array.from(map.values()).sort((a, b) => a.labNome.localeCompare(b.labNome));
  }, [filtered, labs]);

  const handleSend = async (row: TerceirizadoOperacionalRow) => {
    setBusyId(row.id);
    const r = await callLabApoioAdapter("send", row.id);
    setBusyId(null);
    if (r.ok) { toast.success(`Enviado (protocolo ${r.protocolo_externo}).`); void reload(); }
    else toast.error(r.error || "Falha ao enviar para o laboratório.");
  };

  const handleFetch = async (row: TerceirizadoOperacionalRow) => {
    setBusyId(row.id);
    const r = await callLabApoioAdapter("fetch", row.id);
    setBusyId(null);
    if (r.ok) {
      if (r.status_externo === "IMPORTADO") toast.success("Resultado importado.");
      else toast.info("Lab informa que o exame ainda está em análise.");
      void reload();
    } else toast.error(r.error || "Falha ao consultar o laboratório.");
  };

  const handleMarcarRecebido = async (row: TerceirizadoOperacionalRow) => {
    setBusyId(row.id);
    const r = await updateExameTerceirizado(row.id, {
      status_externo: "FINALIZADO",
      status: "finalizado",
      resultado_importado: true,
      data_retorno: new Date().toISOString(),
      data_liberacao: new Date().toISOString(),
    });
    setBusyId(null);
    if (r.ok) { toast.success("Marcado como recebido e liberado."); void reload(); }
    else toast.error(r.error || "Falha ao marcar como recebido.");
  };

  const handleUpload = async (row: TerceirizadoOperacionalRow, file: File) => {
    setBusyId(row.id);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      let bin = ""; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      const contentBase64 = btoa(bin);
      const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, "_");
      const filename = safeName.toLowerCase().endsWith(".pdf") ? safeName : `${safeName}.pdf`;
      const { data, error } = await supabase.functions.invoke("lab-apoio-upload-pdf", {
        body: {
          target: "resultado",
          atendimento_exame_id: row.id,
          filename,
          contentBase64,
        },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Falha no upload");
      toast.success(data.s3_mirrored ? "Resultado anexado (espelhado no S3)." : "Resultado anexado.");
      void reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no upload");
    } finally {
      setBusyId(null);
    }
  };

  const handleVerLaudo = async (row: TerceirizadoOperacionalRow) => {
    setBusyId(row.id);
    const r = await abrirLaudoResolvido(row.id);
    setBusyId(null);
    if (!r.ok) toast.error(r.error || "Falha ao abrir laudo.");
    else if (r.source === "none") toast.info("Laudo ainda indisponível.");
  };

  // ===== Seleção e ações em lote =====
  const toggleRow = (id: number) =>
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  const toggleGroup = (groupRows: TerceirizadoOperacionalRow[]) =>
    setSelected(prev => {
      const n = new Set(prev);
      const allSelected = groupRows.every(r => n.has(r.id));
      if (allSelected) groupRows.forEach(r => n.delete(r.id));
      else groupRows.forEach(r => n.add(r.id));
      return n;
    });

  const runBatch = async (
    label: string,
    targetRows: TerceirizadoOperacionalRow[],
    fn: (row: TerceirizadoOperacionalRow) => Promise<{ ok: boolean; error?: string }>,
  ) => {
    if (targetRows.length === 0) {
      toast.info("Nenhum exame elegível na seleção.");
      return;
    }
    setBusyBatch(label);
    let ok = 0, fail = 0;
    for (const r of targetRows) {
      try {
        const res = await fn(r);
        if (res.ok) ok++; else fail++;
      } catch { fail++; }
    }
    setBusyBatch(null);
    if (ok > 0) toast.success(`${label}: ${ok} exame(s) processado(s).`);
    if (fail > 0) toast.error(`${label}: ${fail} falha(s).`);
    setSelected(new Set());
    void reload();
  };

  const handleBatchSend = (groupRows: TerceirizadoOperacionalRow[]) => {
    const target = groupRows.filter(r => selected.has(r.id) && r.integracao_ativa && r.status_externo === "AGUARDANDO_ENVIO");
    void runBatch("Enviar", target, async (r) => {
      const res = await callLabApoioAdapter("send", r.id);
      return { ok: res.ok, error: res.ok ? undefined : res.error };
    });
  };

  const handleBatchFetch = (groupRows: TerceirizadoOperacionalRow[]) => {
    const target = groupRows.filter(r =>
      selected.has(r.id) && r.integracao_ativa &&
      ["ENVIADO", "EM_ANALISE_LAB", "RESULTADO_RECEBIDO", "ERRO_INTEGRACAO"].includes(r.status_externo),
    );
    void runBatch("Reconsultar", target, async (r) => {
      const res = await callLabApoioAdapter("fetch", r.id);
      return { ok: res.ok, error: res.ok ? undefined : res.error };
    });
  };

  const handleBatchMarcarRecebido = (groupRows: TerceirizadoOperacionalRow[]) => {
    const target = groupRows.filter(r =>
      selected.has(r.id) && !r.integracao_ativa &&
      r.status_externo !== "IMPORTADO" && r.status_externo !== "FINALIZADO",
    );
    void runBatch("Marcar recebido", target, (r) =>
      updateExameTerceirizado(r.id, {
        status_externo: "FINALIZADO",
        status: "finalizado",
        resultado_importado: true,
        data_retorno: new Date().toISOString(),
        data_liberacao: new Date().toISOString(),
      }),
    );
  };

  const handleDownload = async (row: TerceirizadoOperacionalRow) => {
    if (!row.arquivo_resultado_path) return;
    const { data, error } = await supabase.storage
      .from("resultados-externos")
      .createSignedUrl(row.arquivo_resultado_path, 60);
    if (error || !data) { toast.error("Não foi possível abrir o arquivo."); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const tabs: Array<{ key: TabKey; label: string; count: number; tone?: string }> = [
    { key: "a_enviar",   label: "A enviar",          count: counters.a_enviar },
    { key: "aguardando", label: "Aguardando retorno", count: counters.aguardando },
    { key: "recebidos",  label: "Recebidos",          count: counters.recebidos },
    { key: "atrasados",  label: "Atrasados",          count: counters.atrasados, tone: "danger" },
    { key: "todos",      label: "Todos",              count: counters.todos },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      <SEO
        title="Laboratórios de Apoio | SISLAC"
        description="Gestão completa do ciclo de exames terceirizados: envio, acompanhamento, recebimento e importação."
      />

      <PageHeader
        eyebrow="Integrações"
        title="Laboratórios de Apoio"
        description="Acompanhe o ciclo dos exames terceirizados — envio, aguardando, recebimento e importação."
        actions={
          <>
            <button
              onClick={() => setRealtimeOn(v => !v)}
              title={realtimeOn ? "Tempo real ativo — clique para pausar" : "Tempo real pausado — clique para ativar"}
              className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-xs font-medium transition-colors ${
                realtimeOn
                  ? "border-[hsl(var(--status-success-bg))] bg-[hsl(var(--status-success-bg))] text-[hsl(var(--status-success))]"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              <Radio className={`h-3.5 w-3.5 ${realtimeOn ? "animate-pulse" : ""}`} />
              {realtimeOn ? "Ao vivo" : "Pausado"}
            </button>
            <button
              onClick={() => void reload()}
              className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-accent transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </button>
          </>
        }
      />

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por paciente, protocolo, exame ou protocolo externo…"
            className="w-full h-10 pl-10 pr-3 rounded-lg border border-border bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <select
            value={labFilter}
            onChange={(e) => setLabFilter(e.target.value)}
            className="h-10 pl-9 pr-8 rounded-lg border border-border bg-card text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="__all">Todos os laboratórios</option>
            {labs.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
        </div>
      </div>

      {/* Abas */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border">
        {tabs.map(t => {
          const active = tab === t.key;
          const danger = t.tone === "danger" && t.count > 0;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative h-10 px-4 text-xs font-semibold transition-colors flex items-center gap-2 ${
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
              <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold tabular-nums ${
                danger
                  ? "bg-[hsl(var(--status-danger-bg))] text-[hsl(var(--status-danger))]"
                  : active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              }`}>
                {t.count}
              </span>
              {active && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary rounded-full" />}
            </button>
          );
        })}
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="py-20 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
            <Inbox className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">Nenhum exame nesta visão</p>
          <p className="text-xs text-muted-foreground mt-1">Ajuste o filtro ou aguarde novos pedidos.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(g => (
            <section key={g.labId} className="rounded-xl border border-border bg-card overflow-hidden">
              <header className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/30">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    aria-label={`Selecionar todos de ${g.labNome}`}
                    className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                    checked={g.rows.length > 0 && g.rows.every(r => selected.has(r.id))}
                    onChange={() => toggleGroup(g.rows)}
                  />
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-foreground">{g.labNome}</h2>
                  <span className="text-[10px] font-bold tabular-nums px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {g.rows.length}
                  </span>
                </div>
                {(() => {
                  const selCount = g.rows.filter(r => selected.has(r.id)).length;
                  if (selCount === 0) return null;
                  const isBatchBusy = busyBatch !== null;
                  return (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-medium text-muted-foreground mr-1">{selCount} selecionado(s)</span>
                      <button
                        onClick={() => handleBatchSend(g.rows)}
                        disabled={isBatchBusy}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        {busyBatch === "Enviar" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                        Enviar
                      </button>
                      <button
                        onClick={() => handleBatchFetch(g.rows)}
                        disabled={isBatchBusy}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border border-border text-foreground hover:bg-accent disabled:opacity-50"
                      >
                        {busyBatch === "Reconsultar" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                        Reconsultar
                      </button>
                      <button
                        onClick={() => handleBatchMarcarRecebido(g.rows)}
                        disabled={isBatchBusy}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border border-border text-foreground hover:bg-accent disabled:opacity-50"
                      >
                        {busyBatch === "Marcar recebido" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        Marcar recebido
                      </button>
                    </div>
                  );
                })()}
              </header>
              <ul className="divide-y divide-border">
                {g.rows.map(row => {
                  const isBusy = busyId === row.id;
                  const dEnvio = diasDesde(row.data_envio);
                  const atrasado = TAB_TO_STATUSES.aguardando.includes(row.status_externo) && (dEnvio ?? 0) >= ATRASO_DIAS;
                  const finalizado = row.status_externo === "IMPORTADO" || row.status_externo === "FINALIZADO";
                  const isSelected = selected.has(row.id);

                  return (
                    <li key={row.id} className="px-4 py-3.5 hover:bg-accent/30 transition-colors">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0 flex-1 flex items-start gap-3">
                          <input
                            type="checkbox"
                            aria-label={`Selecionar ${row.nome_exame}`}
                            className="h-4 w-4 mt-0.5 rounded border-border accent-primary cursor-pointer shrink-0"
                            checked={isSelected}
                            onChange={() => toggleRow(row.id)}
                          />
                          <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold text-foreground truncate">{row.nome_exame}</h3>
                            <LabBadge
                              tipoProcesso="TERCEIRIZADO"
                              labApoioId={row.lab_apoio_id}
                              labApoioNome={g.labNome}
                              laboratorioPropriaNome={getCachedTenantNome()}
                              compact
                            />
                            <IntegrationStatusBadge row={row} compact />
                            {atrasado && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[hsl(var(--status-danger-bg))] text-[hsl(var(--status-danger))]">
                                <AlertCircle className="h-2.5 w-2.5" /> {dEnvio} dias sem retorno
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-muted-foreground flex-wrap">
                            <button
                              onClick={() => navigate(`/resultados/${encodeURIComponent(row.protocolo)}/consulta`)}
                              className="font-medium text-foreground hover:text-primary truncate max-w-[200px]"
                              title={row.paciente_nome}
                            >
                              {row.paciente_nome}
                            </button>
                            <span className="font-mono">{row.protocolo}</span>
                            {row.protocolo_externo && (
                              <span>Externo: <span className="font-mono text-foreground">{row.protocolo_externo}</span></span>
                            )}
                            {row.data_envio && <span>Enviado: <span className="text-foreground">{fmtDate(row.data_envio)}</span></span>}
                            {row.data_retorno && <span>Retorno: <span className="text-foreground">{fmtDate(row.data_retorno)}</span></span>}
                          </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                          {row.integracao_ativa ? (
                            <>
                              {row.status_externo === "AGUARDANDO_ENVIO" && (
                                <button onClick={() => handleSend(row)} disabled={isBusy}
                                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                                  {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                                  Enviar
                                </button>
                              )}
                              {(row.status_externo === "ENVIADO" || row.status_externo === "EM_ANALISE_LAB" || row.status_externo === "ERRO_INTEGRACAO") && (
                                <button onClick={() => handleFetch(row)} disabled={isBusy}
                                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border border-border text-foreground hover:bg-accent disabled:opacity-50">
                                  {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                                  Reconsultar
                                </button>
                              )}
                              {row.status_externo === "RESULTADO_RECEBIDO" && (
                                <button onClick={() => handleFetch(row)} disabled={isBusy}
                                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                                  {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                                  Importar
                                </button>
                              )}
                              {finalizado && (
                                <button onClick={() => handleVerLaudo(row)} disabled={isBusy}
                                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border border-border text-foreground hover:bg-accent disabled:opacity-50">
                                  <Eye className="h-3 w-3" /> Ver laudo
                                </button>
                              )}
                              <button onClick={() => setAuditOpen(row)}
                                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                                title="Histórico da integração">
                                <History className="h-3 w-3" />
                              </button>
                            </>
                          ) : (
                            <>
                              <label className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border border-border text-foreground hover:bg-accent cursor-pointer">
                                <Upload className="h-3 w-3" />
                                {row.arquivo_resultado_path ? "Substituir" : "Anexar PDF"}
                                <input type="file" accept="application/pdf,image/*" className="hidden"
                                  disabled={isBusy}
                                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(row, f); e.target.value = ""; }} />
                              </label>
                              {!finalizado && (
                                <button onClick={() => handleMarcarRecebido(row)} disabled={isBusy}
                                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                                  {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                  Marcar recebido
                                </button>
                              )}
                              {row.arquivo_resultado_path && (
                                <button onClick={() => handleDownload(row)}
                                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-accent">
                                  <FileText className="h-3 w-3" /> Arquivo <ExternalLink className="h-2.5 w-2.5" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          {/* Carregar mais / status de paginação */}
          <div className="flex flex-col items-center gap-2 py-4">
            <p className="text-[11px] text-muted-foreground tabular-nums">
              Exibindo {rows.length} de {total} exame(s) terceirizado(s)
            </p>
            {rows.length < total && (
              <button
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-accent disabled:opacity-50"
              >
                {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Carregar mais ({Math.min(PAGE_SIZE, total - rows.length)})
              </button>
            )}
          </div>
        </div>
      )}

      <AuditoriaIntegracaoDrawer
        open={!!auditOpen}
        onOpenChange={(v) => !v && setAuditOpen(null)}
        atendimentoExameId={auditOpen?.id ?? null}
        nomeExame={auditOpen?.nome_exame}
        protocoloExterno={auditOpen?.protocolo_externo ?? null}
        labNome={labs.find(l => l.id === auditOpen?.lab_apoio_id)?.nome}
      />
    </div>
  );
};

export default LabApoio;