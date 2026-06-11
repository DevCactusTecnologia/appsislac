/**
 * Integrações de Apoio — Painel admin (Fase 3).
 *
 * Inclui:
 *  - Configuração + teste de conexão Hermes Pardini.
 *  - Consulta por external_protocol: resultado, PDF, pendências, rastreabilidade.
 *  - Tabela de jobs com retry/cancel manual e detalhe de erro.
 */

import { useEffect, useMemo, useState } from "react";
import { getCurrentTenantId } from "@/data/_tenant";
import {
  Plug, Activity, RefreshCw,
  PlugZap, FileText, AlertTriangle, Clock, Search, Download, RotateCcw, X,
  Loader2, Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { INTEGRATION_PROVIDERS, type IntegrationProvider } from "@/integrations/contracts/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { listProviderUIs } from "@/integrations/providers/registry";
import type { ProviderActionDef, ProviderUIConfig } from "@/integrations/contracts/providerUI";
import { getCapabilities, hasCapability } from "@/integrations/contracts/capabilities";
import { isFeatureEnabled, useFeatureFlag } from "@/lib/featureFlags";
import { ProviderConfigCard } from "./ProviderConfigCard";
import { ProviderCatalogImporter } from "./ProviderCatalogImporter";
import { useAuth } from "@/contexts/AuthContext";
import StatusBadge from "@/components/StatusBadge";

type ProviderRow = {
  id: string;
  provider: IntegrationProvider;
  ativo: boolean;
  endpoint_url: string | null;
  mode: "MOCK" | "HOMOLOG" | "PROD";
  client_code: string | null;
  config: Record<string, unknown> | null;
};
type JobRow = {
  id: string;
  integration_id: string | null;
  kind: string;
  status: string;
  retry_count: number;
  last_error: string | null;
  created_at: string;
  payload: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
};
type ResultRow = {
  id: string;
  external_protocol: string;
  status: string;
  liberado_em: string | null;
  resultado: any;
  pendencias: any;
  rastreabilidade: any;
};
type PdfRow = { id: string; external_protocol: string; storage_path: string; size_bytes: number | null; mime_type: string | null; created_at: string };

const IntegracoesApoioTab = () => {
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const [tenantId, setTenantId] = useState<string | null>(user?.tenantId ?? null);

  useEffect(() => {
    if (!tenantId) {
      getCurrentTenantId().then(setTenantId);
    }
  }, [tenantId]);

  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [jobFilter, setJobFilter] = useState<string>("ALL");
  const [busyJobId, setBusyJobId] = useState<string | null>(null);
  const [openJobId, setOpenJobId] = useState<string | null>(null);

  const [protocol, setProtocol] = useState("");
  const [resultRow, setResultRow] = useState<ResultRow | null>(null);
  const [pdfList, setPdfList] = useState<PdfRow[]>([]);
  const [searching, setSearching] = useState(false);

  // Reativo: re-renderiza quando o tenant carrega/muda flags (ex.: dbsync_enabled).
  useFeatureFlag("dbsync_enabled");

  // Lista de providers visíveis: registry + filtro por feature flag por tenant.
  const visibleProviderUIs = useMemo<ProviderUIConfig[]>(
    () =>
      listProviderUIs().filter((ui) => !ui.featureFlag || isFeatureEnabled(ui.featureFlag)),
    // re-roda quando flags mudam
    [],
  );

  // Provider operacional ativo (primeiro com `polling` capability + linha em integrations).
  // Usado pela seção "Consulta por protocolo".
  const activeOperationalProvider = useMemo(() => {
    for (const ui of visibleProviderUIs) {
      if (ui.status !== "disponivel") continue;
      const caps = getCapabilities(ui.provider);
      if (!caps.polling) continue;
      const row = providers.find((p) => p.provider === ui.provider) ?? null;
      if (row) return { ui, row };
    }
    return null;
  }, [visibleProviderUIs, providers]);

  const reload = async () => {
    const [{ data: ints }, { data: jbs }] = await Promise.all([
      supabase.from("integrations").select("id, provider, ativo, endpoint_url, mode, client_code, config"),
      supabase
        .from("integration_jobs")
        .select("id, integration_id, kind, status, retry_count, last_error, created_at, payload, result")
        .order("created_at", { ascending: false }).limit(50),
    ]);
    const rows = ((ints as ProviderRow[] | null) ?? []).map((r) => ({ ...r, config: r.config ?? {} }));
    setProviders(rows);
    setJobs((jbs as JobRow[] | null) ?? []);
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  const buscarProtocolo = async () => {
    if (!protocol.trim() || !activeOperationalProvider) return;
    setSearching(true);
    try {
      const { data: r } = await supabase.from("integration_results")
        .select("id, external_protocol, status, liberado_em, resultado, pendencias, rastreabilidade")
        .eq("integration_id", activeOperationalProvider.row.id)
        .eq("external_protocol", protocol.trim())
        .maybeSingle();
      setResultRow((r as ResultRow | null) ?? null);
      const { data: pdfs } = await supabase.from("integration_pdfs")
        .select("id, external_protocol, storage_path, size_bytes, mime_type, created_at")
        .eq("integration_id", activeOperationalProvider.row.id)
        .eq("external_protocol", protocol.trim())
        .order("created_at", { ascending: false });
      setPdfList((pdfs as PdfRow[] | null) ?? []);
      if (!r) toast({ title: "Nada encontrado", description: `Sem resultado para ${protocol.trim()}` });
    } catch (e) {
      toast({ title: "Erro", description: String((e as Error).message ?? e), variant: "destructive" });
    } finally { setSearching(false); }
  };

  const enqueue = async (kind: string) => {
    if (!activeOperationalProvider || !protocol.trim()) return;
    try {
      const { data, error } = await supabase.functions.invoke("integration-job-action", {
        body: {
          action: "enqueue",
          integration_id: activeOperationalProvider.row.id,
          kind,
          payload: { external_protocol: protocol.trim() },
        },
      });
      if (error) throw error;
      toast({ title: `Job ${kind} disparado`, description: `id ${(data as any)?.job_id?.slice(0,8)}…` });
      await reload();
      setTimeout(() => { void buscarProtocolo(); }, 800);
    } catch (e) {
      toast({ title: "Erro", description: String((e as Error).message ?? e), variant: "destructive" });
    }
  };

  const downloadPdf = async (pdf: PdfRow) => {
    try {
      const { data, error } = await supabase.functions.invoke("integration-pdf-url", {
        body: { pdf_id: pdf.id },
      });
      if (error) throw error;
      const url = (data as any)?.url;
      if (!url) throw new Error("sem URL");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast({ title: "Erro", description: String((e as Error).message ?? e), variant: "destructive" });
    }
  };

  const jobAction = async (job_id: string, action: "retry" | "cancel") => {
    setBusyJobId(job_id);
    try {
      const { error } = await supabase.functions.invoke("integration-job-action", {
        body: { action, job_id },
      });
      if (error) throw error;
      toast({ title: action === "retry" ? "Job reenfileirado" : "Job cancelado" });
      await reload();
    } catch (e) {
      toast({ title: "Erro", description: String((e as Error).message ?? e), variant: "destructive" });
    } finally { setBusyJobId(null); }
  };

  const filteredJobs = useMemo(
    () => jobFilter === "ALL" ? jobs : jobs.filter((j) => j.status === jobFilter),
    [jobs, jobFilter],
  );
  const exames: any[] = resultRow?.resultado?.exames ?? [];
  const pendencias: any[] = Array.isArray(resultRow?.pendencias) ? (resultRow!.pendencias as any[]) : [];
  const eventos: any[] = Array.isArray(resultRow?.rastreabilidade) ? (resultRow!.rastreabilidade as any[]) : [];

  const consultActions: ProviderActionDef[] = useMemo(() => {
    if (!activeOperationalProvider) return [];
    const caps = getCapabilities(activeOperationalProvider.ui.provider);
    return (activeOperationalProvider.ui.consultActions ?? []).filter((a) =>
      hasCapability(activeOperationalProvider.ui.provider, a.capability),
    );
  }, [activeOperationalProvider]);

  // Última sincronização por integração (último job conhecido).
  const lastSyncByIntegration = useMemo(() => {
    const map = new Map<string, string>();
    for (const j of jobs) {
      if (!j.integration_id) continue;
      if (!map.has(j.integration_id)) map.set(j.integration_id, j.created_at);
    }
    return map;
  }, [jobs]);

  const consultIcon = (name?: string) => {
    switch (name) {
      case "FileText": return <FileText className="h-4 w-4" />;
      case "AlertTriangle": return <AlertTriangle className="h-4 w-4" />;
      case "Clock": return <Clock className="h-4 w-4" />;
      default: return null;
    }
  };

  // KPIs derivados em tempo real para o header.
  const kpis = useMemo(() => {
    const ativos = providers.filter((p) => p.ativo).length;
    const pendentes = jobs.filter((j) => j.status === "PENDING" || j.status === "PROCESSING").length;
    const falhos = jobs.filter((j) => j.status === "FAILED").length;
    const ultimoJob = jobs[0]?.created_at ?? null;
    return { ativos, pendentes, falhos, ultimoJob, totalProviders: INTEGRATION_PROVIDERS.length };
  }, [providers, jobs]);

  const ultimaSyncLabel = useMemo(() => {
    if (!kpis.ultimoJob) return "—";
    const diff = Date.now() - new Date(kpis.ultimoJob).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return "agora";
    if (min < 60) return `${min} min atrás`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}h atrás`;
    return `${Math.floor(h / 24)}d atrás`;
  }, [kpis.ultimoJob]);

  return (
    <div className="space-y-6">
      {/* Header moderno: identidade + ação rápida */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Plug className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground">Integrações de Apoio</h2>
            <p className="text-sm text-muted-foreground">
              Conecte seu laboratório a redes de apoio e acompanhe a saúde das integrações em tempo real.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={reload} className="shrink-0 gap-2">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={PlugZap}
          label="Providers ativos"
          value={`${kpis.ativos}`}
          hint={`de ${kpis.totalProviders} disponíveis`}
          tone="primary"
        />
        <KpiCard
          icon={Clock}
          label="Jobs em andamento"
          value={`${kpis.pendentes}`}
          hint="pendentes ou processando"
          tone={kpis.pendentes > 0 ? "info" : "neutral"}
        />
        <KpiCard
          icon={AlertTriangle}
          label="Jobs com falha"
          value={`${kpis.falhos}`}
          hint={kpis.falhos > 0 ? "requer atenção" : "tudo certo"}
          tone={kpis.falhos > 0 ? "danger" : "success"}
        />
        <KpiCard
          icon={Activity}
          label="Última sincronização"
          value={ultimaSyncLabel}
          hint="atividade da fila"
          tone="neutral"
        />
      </div>

      {/* Cards de configuração — renderizados a partir do registry */}
      {visibleProviderUIs.map((ui) => {
        const row = providers.find((p) => p.provider === ui.provider) ?? null;
        return (
          <div key={ui.provider} className="space-y-3">
            <ProviderConfigCard
              ui={ui}
              existing={row}
              lastSyncAt={row ? lastSyncByIntegration.get(row.id) ?? null : null}
              onSaved={reload}
            />
            {ui.provider === "DB_DIAGNOSTICOS" && (
              <details className="group rounded-lg border border-border/40 bg-muted/20">
                <summary className="cursor-pointer select-none px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
                  Ferramentas avançadas — implantação
                </summary>
                <div className="p-3 border-t border-border/40">
                  <ProviderCatalogImporter
                    provider={ui.provider}
                    providerLabel={ui.display_name}
                    integrationId={row?.id ?? null}
                    tenantId={tenantId}
                  />
                </div>
              </details>
            )}
          </div>
        );
      })}

      {/* Consulta por protocolo */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Consulta por protocolo externo</h3>
          {activeOperationalProvider && (
            <span className="ml-auto text-xs text-muted-foreground">
              via <span className="text-foreground font-medium">{activeOperationalProvider.ui.display_name}</span>
            </span>
          )}
        </div>
        {!activeOperationalProvider && (
          <p className="text-xs text-muted-foreground">
            Configure e ative um provider de apoio para consultar protocolos.
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="external_protocol (ex.: PED-2025-0001)"
            value={protocol}
            onChange={(e) => setProtocol(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void buscarProtocolo(); }}
            disabled={!activeOperationalProvider}
          />
          <div className="flex gap-2 flex-wrap">
            <Button onClick={buscarProtocolo} disabled={!protocol.trim() || searching || !activeOperationalProvider}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Buscar
            </Button>
            {consultActions.map((a) => (
              <Button
                key={a.key}
                variant="outline"
                onClick={() => enqueue(a.key)}
                disabled={!protocol.trim() || !activeOperationalProvider}
              >
                {consultIcon(a.icon)} {a.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Resultado */}
        {resultRow && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Coluna 1: Resultado + PDFs */}
            <div className="space-y-3">
              <SubCard title="Resultado" icon={<FileText className="h-4 w-4" />}>
                <div className="text-xs space-y-1">
                  <Kv k="Status" v={
                    <span className="px-1.5 py-0.5 rounded border bg-muted text-foreground">
                      {resultRow.status}
                    </span>
                  } />
                  <Kv k="Liberado" v={resultRow.liberado_em ? new Date(resultRow.liberado_em).toLocaleString() : "—"} />
                  <Kv k="Paciente" v={resultRow.resultado?.pacienteNome ?? "—"} />
                  <Kv k="Exames" v={String(exames.length)} />
                </div>
                {(resultRow?.resultado?.laudoPdfUrl || resultRow?.resultado?.laudoPdfBase64) && (
                  <div className="mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-3 text-xs"
                      onClick={() => abrirLaudoDoPayload(resultRow!.resultado)}
                    >
                      <Download className="h-3.5 w-3.5 mr-1.5" /> Baixar laudo do retorno
                    </Button>
                  </div>
                )}
                {exames.length > 0 && (
                  <div className="mt-2 max-h-72 overflow-auto border border-border rounded-md">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/40 text-muted-foreground sticky top-0">
                        <tr>
                          <th className="text-left px-2 py-1">Código</th>
                          <th className="text-left px-2 py-1">Nome</th>
                          <th className="text-left px-2 py-1">Valor</th>
                          <th className="text-left px-2 py-1">Referência</th>
                        </tr>
                      </thead>
                      <tbody>
                        {exames.map((ex: any, i: number) => (
                          <tr key={i} className="border-t border-border align-top">
                            <td className="px-2 py-1 font-mono">{ex.codigoApoio}</td>
                            <td className="px-2 py-1">{ex.nomeExame}</td>
                            <td className="px-2 py-1 whitespace-nowrap">
                              {ex.valor ?? "—"} {ex.unidade ?? ""}
                            </td>
                            <td className="px-2 py-1">
                              <ReferenciaCell ex={ex} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SubCard>
              <SubCard title={`PDFs (${pdfList.length})`} icon={<FileText className="h-4 w-4" />}>
                {pdfList.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum PDF gravado. Use “Baixar PDF”.</p>
                ) : (
                  <ul className="space-y-1 text-xs">
                    {pdfList.map((p) => (
                      <li key={p.id} className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="truncate flex-1">{p.storage_path.split("/").pop()}</span>
                        <span className="text-muted-foreground">{p.size_bytes ?? 0}b</span>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => downloadPdf(p)}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </SubCard>
            </div>

            {/* Coluna 2: Pendências */}
            <SubCard title={`Pendências técnicas (${pendencias.length})`} icon={<AlertTriangle className="h-4 w-4 text-status-warning" />}>
              {pendencias.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem pendências registradas.</p>
              ) : (
                <ul className="space-y-2">
                  {pendencias.map((p, i) => (
                    <li key={i} className="text-xs border border-status-warning/30 rounded-md p-2 bg-status-warning-bg/40">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-foreground">{p.codigoExame ?? "—"}</span>
                        <span className="px-1.5 py-0.5 rounded border bg-background">{p.tipo ?? "—"}</span>
                        <span className="ml-auto text-muted-foreground">
                          {p.dataRegistro ? new Date(p.dataRegistro).toLocaleString() : ""}
                        </span>
                      </div>
                      <p className="text-muted-foreground">{p.descricao ?? ""}</p>
                    </li>
                  ))}
                </ul>
              )}
            </SubCard>

            {/* Coluna 3: Timeline rastreabilidade */}
            <SubCard title={`Rastreabilidade (${eventos.length})`} icon={<Clock className="h-4 w-4" />}>
              {eventos.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem eventos. Use “Rastreio”.</p>
              ) : (
                <ol className="relative border-l-2 border-border ml-2 space-y-3">
                  {[...eventos]
                    .sort((a, b) => String(a.data ?? "").localeCompare(String(b.data ?? "")))
                    .map((ev, i) => (
                    <li key={i} className="ml-3">
                      <span className="absolute -left-[7px] mt-1 h-3 w-3 rounded-full bg-primary border-2 border-background" />
                      <div className="text-xs">
                        <div className="font-medium text-foreground">{ev.etapa ?? "EVENTO"}</div>
                        <div className="text-muted-foreground">
                          {ev.data ? new Date(ev.data).toLocaleString() : "—"}
                        </div>
                        {ev.observacao && <div className="text-muted-foreground italic mt-0.5">{ev.observacao}</div>}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </SubCard>
          </div>
        )}
      </div>

      {/* Catálogo de provedores — visão de mercado */}
      <div className="bg-card border border-border rounded-lg">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Catálogo de provedores</h3>
          </div>
          <span className="text-xs text-muted-foreground">
            {loading ? "carregando…" : `${providers.length}/${INTEGRATION_PROVIDERS.length} configurado(s)`}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
          {INTEGRATION_PROVIDERS.map((p) => {
            const cfg = providers.find((x) => x.provider === p.id);
            const status: { label: string; type: "success" | "neutral" | "warning" } =
              cfg?.ativo
                ? { label: "Ativo", type: "success" }
                : p.status === "disponivel"
                ? { label: "Não configurado", type: "neutral" }
                : { label: "Em breve", type: "warning" };
            return (
              <div key={p.id} className="px-4 py-3 flex items-start gap-3 hover:bg-muted/30 transition-colors">
                <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center text-[11px] font-semibold text-muted-foreground shrink-0">
                  {p.short}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground truncate">{p.label}</p>
                    <StatusBadge label={status.label} type={status.type} />
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Jobs */}
      <div className="bg-card border border-border rounded-lg">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-foreground">Jobs ({filteredJobs.length})</h3>
          <select
            className="ml-2 h-8 text-xs rounded-md border border-input bg-background px-2"
            value={jobFilter} onChange={(e) => setJobFilter(e.target.value)}
          >
            <option value="ALL">Todos</option>
            <option value="PENDING">Pendentes</option>
            <option value="PROCESSING">Processando</option>
            <option value="COMPLETED">Concluídos</option>
            <option value="FAILED">Falhos</option>
            <option value="CANCELLED">Cancelados</option>
          </select>
          <button onClick={reload}
            className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <RefreshCw className="h-3 w-3" /> atualizar
          </button>
        </div>
        {filteredJobs.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Nenhum job.</p>
        ) : (
          <div className="divide-y divide-border">
            {filteredJobs.map((j) => {
              const isOpen = openJobId === j.id;
              const ep = (j.payload as any)?.external_protocol ?? "—";
              return (
                <div key={j.id} className="px-4 py-2 text-sm">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setOpenJobId(isOpen ? null : j.id)}
                      className="font-mono text-xs text-muted-foreground hover:text-foreground w-44 truncate text-left"
                      title={j.id}
                    >
                      {j.kind}
                    </button>
                    <StatusPill status={j.status} />
                    <span className="text-xs text-muted-foreground hidden md:inline">retry {j.retry_count}</span>
                    <span className="text-xs text-muted-foreground hidden md:inline truncate max-w-[20%]">
                      {ep}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground truncate max-w-[30%]">
                      {j.last_error ?? new Date(j.created_at).toLocaleString()}
                    </span>
                    <div className="flex gap-1">
                      {j.status !== "COMPLETED" && j.status !== "CANCELLED" && (
                        <Button size="sm" variant="ghost" className="h-7 px-2"
                          disabled={busyJobId === j.id}
                          onClick={() => jobAction(j.id, "cancel")}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 px-2"
                        disabled={busyJobId === j.id || j.status === "PROCESSING"}
                        onClick={() => jobAction(j.id, "retry")}>
                        {busyJobId === j.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <RotateCcw className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="mt-2 ml-2 pl-3 border-l-2 border-border text-xs space-y-2">
                      <Kv k="ID" v={<span className="font-mono">{j.id}</span>} />
                      <Kv k="Criado" v={new Date(j.created_at).toLocaleString()} />
                      <Kv k="Erro" v={j.last_error ?? "—"} />
                      <details>
                        <summary className="cursor-pointer text-muted-foreground">Payload</summary>
                        <pre className="bg-muted/40 p-2 rounded text-[11px] overflow-auto max-h-40">
                          {JSON.stringify(j.payload ?? {}, null, 2)}
                        </pre>
                      </details>
                      <details>
                        <summary className="cursor-pointer text-muted-foreground">Result</summary>
                        <pre className="bg-muted/40 p-2 rounded text-[11px] overflow-auto max-h-40">
                          {JSON.stringify(j.result ?? {}, null, 2)}
                        </pre>
                      </details>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const KpiCard = ({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
  tone: "primary" | "success" | "danger" | "info" | "neutral";
}) => {
  const toneCls: Record<typeof tone, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-status-success-bg text-status-success",
    danger: "bg-status-danger-bg text-status-danger",
    info: "bg-status-info-bg text-status-info",
    neutral: "bg-muted text-muted-foreground",
  };
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex items-start gap-3">
      <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${toneCls[tone]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold text-foreground leading-tight mt-0.5 truncate">{value}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{hint}</p>
      </div>
    </div>
  );
};

const SubCard = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
  <div className="border border-border rounded-md p-3 bg-background">
    <div className="flex items-center gap-2 mb-2">
      {icon}
      <h4 className="text-xs font-semibold text-foreground">{title}</h4>
    </div>
    {children}
  </div>
);

const Kv = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex gap-2"><span className="text-muted-foreground w-20">{k}</span><span className="flex-1">{v}</span></div>
);

const StatusPill = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; type: "success" | "danger" | "info" | "neutral" | "warning" }> = {
    COMPLETED: { label: "Concluído", type: "success" },
    FAILED: { label: "Falhou", type: "danger" },
    PROCESSING: { label: "Processando", type: "info" },
    CANCELLED: { label: "Cancelado", type: "neutral" },
    PENDING: { label: "Pendente", type: "warning" },
  };
  const m = map[status] ?? { label: status, type: "warning" as const };
  return <StatusBadge label={m.label} type={m.type} />;
};

/** Renderiza referência por categoria/colunas vinda do XSD Hermes Pardini. */
const ReferenciaCell = ({ ex }: { ex: any }) => {
  const linhas: any[] = Array.isArray(ex?.referenciaLinhas) ? ex.referenciaLinhas : [];
  if (linhas.length > 0) {
    return (
      <table className="w-full text-[11px] border border-border rounded">
        <thead className="bg-muted/30 text-muted-foreground">
          <tr>
            <th className="text-left px-1.5 py-0.5">Categoria</th>
            <th className="text-left px-1.5 py-0.5">Faixa</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => {
            const cat = [l.categoria1, l.categoria2, l.categoria3, l.categoria4]
              .filter(Boolean).join(" / ") || "—";
            const range =
              l.valor1 && l.valor2 ? `${l.valor1} a ${l.valor2}`
              : l.valor1 ? `≥ ${l.valor1}`
              : l.valor2 ? `≤ ${l.valor2}`
              : "—";
            const param =
              l.parametro1 && l.parametro2
                ? ` (${l.parametro1}${l.unidadeDoParametro1 ? l.unidadeDoParametro1 : ""}–${l.parametro2}${l.unidadeDoParametro2 ?? ""})`
                : l.parametro1
                  ? ` (${l.parametro1}${l.unidadeDoParametro1 ?? ""})`
                  : "";
            return (
              <tr key={i} className="border-t border-border">
                <td className="px-1.5 py-0.5">{cat}{param}</td>
                <td className="px-1.5 py-0.5 whitespace-nowrap">
                  {range}{l.unidadeDoValor ? ` ${l.unidadeDoValor}` : ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }
  if (ex?.referenciaTexto) {
    return <span className="text-muted-foreground">{ex.referenciaTexto}</span>;
  }
  if (ex?.referencia) {
    return <span className="text-muted-foreground">{ex.referencia}</span>;
  }
  return <span className="text-muted-foreground">—</span>;
};

/** Abre/baixa o PDF embutido no payload de retorno (URL ou base64). */
function abrirLaudoDoPayload(resultado: any) {
  if (!resultado) return;
  if (resultado.laudoPdfUrl) {
    window.open(resultado.laudoPdfUrl, "_blank", "noopener,noreferrer");
    return;
  }
  if (resultado.laudoPdfBase64) {
    try {
      const bin = atob(resultado.laudoPdfBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      console.error("[IntegracoesApoioTab] base64 inválido", e);
    }
  }
}

export default IntegracoesApoioTab;