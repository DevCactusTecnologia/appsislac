/**
 * Integrações de Apoio — Painel simplificado.
 *
 * Layout moderno e enxuto em um único card SectionShell.
 * Mantém toda a funcionalidade: configuração, teste, consulta por protocolo e jobs.
 */

import { useEffect, useMemo, useState } from "react";
import { getCurrentTenantId } from "@/lib/db/tenantResolver";
import {
  Plug, RefreshCw, PlugZap, FileText, AlertTriangle, Clock,
  Search, Download, RotateCcw, X, Loader2, Zap, ChevronDown,
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
import SectionShell from "./_shared/SectionShell";

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
// ✅ Tipos para Resultado - Remover 'any'
type ExameResult = {
  id?: string;
  nomeExame?: string;
  valor?: string | number;
  referenciaLinhas?: Array<{ minVal: number; maxVal: number; label: string }>;
  referencia?: string;
};

type PendenciaItem = {
  id?: string;
  tipo?: string;
  descricao?: string;
  resolvido?: boolean;
  data?: string;
  codigoExame?: string;
  dataRegistro?: string;
};

type RastreabilidadeEvento = {
  id?: string;
  tipo?: string;
  descricao?: string;
  timestamp?: string;
  usuario?: string;
  data?: string;
  etapa?: string;
  observacao?: string;
};

type LaudoPayload = {
  laudoPdfUrl?: string;
  laudoPdfBase64?: string;
  exames?: ExameResult[];
  [key: string]: unknown; // Para campos desconhecidos
};

type ResultRow = {
  id: string;
  external_protocol: string;
  status: string;
  liberado_em: string | null;
  resultado: LaudoPayload | null;
  pendencias: PendenciaItem[] | null;
  rastreabilidade: RastreabilidadeEvento[] | null;
};
type PdfRow = { id: string; external_protocol: string; storage_path: string; size_bytes: number | null; mime_type: string | null; created_at: string };

const IntegracoesApoioTab = () => {
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const [tenantId, setTenantId] = useState<string | null>(user?.tenantId ?? null);

  useEffect(() => {
    if (!tenantId) getCurrentTenantId().then(setTenantId);
  }, [tenantId]);

  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [jobFilter, setJobFilter] = useState<string>("ALL");
  const [busyJobId, setBusyJobId] = useState<string | null>(null);
  const [openJobId, setOpenJobId] = useState<string | null>(null);

  const [protocol, setProtocol] = useState("");
  const [resultRow, setResultRow] = useState<ResultRow | null>(null);
  const [pdfList, setPdfList] = useState<PdfRow[]>([]);
  const [searching, setSearching] = useState(false);

  useFeatureFlag("dbsync_enabled");

  const visibleProviderUIs = useMemo<ProviderUIConfig[]>(
    () => listProviderUIs().filter((ui) => !ui.featureFlag || isFeatureEnabled(ui.featureFlag)),
    [],
  );

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
        body: { action: "enqueue", integration_id: activeOperationalProvider.row.id, kind, payload: { external_protocol: protocol.trim() } },
      });
      if (error) throw error;
      toast({ title: `Job ${kind} disparado`, description: `id ${(data as any)?.job_id?.slice(0, 8)}…` });
      await reload();
      setTimeout(() => { void buscarProtocolo(); }, 800);
    } catch (e) {
      toast({ title: "Erro", description: String((e as Error).message ?? e), variant: "destructive" });
    }
  };

  const downloadPdf = async (pdf: PdfRow) => {
    try {
      const { data, error } = await supabase.functions.invoke("integration-pdf-url", { body: { pdf_id: pdf.id } });
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
      const { error } = await supabase.functions.invoke("integration-job-action", { body: { action, job_id } });
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
  const exames: ExameResult[] = resultRow?.resultado?.exames ?? [];
  const pendencias: PendenciaItem[] = Array.isArray(resultRow?.pendencias) ? (resultRow!.pendencias) : [];
  const eventos: RastreabilidadeEvento[] = Array.isArray(resultRow?.rastreabilidade) ? (resultRow!.rastreabilidade) : [];

  const consultActions: ProviderActionDef[] = useMemo(() => {
    if (!activeOperationalProvider) return [];
    return (activeOperationalProvider.ui.consultActions ?? []).filter((a) =>
      hasCapability(activeOperationalProvider.ui.provider, a.capability),
    );
  }, [activeOperationalProvider]);

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
      case "FileText": return <FileText className="h-3.5 w-3.5" />;
      case "AlertTriangle": return <AlertTriangle className="h-3.5 w-3.5" />;
      case "Clock": return <Clock className="h-3.5 w-3.5" />;
      default: return null;
    }
  };

  const ativosCount = providers.filter((p) => p.ativo).length;
  const falhasCount = jobs.filter((j) => j.status === "FAILED").length;

  return (
    <SectionShell
      icon={<Plug className="h-5 w-5 text-primary" />}
      eyebrow="Integrações"
      title="Integrações de Apoio"
      description="Conecte seu laboratório a redes de apoio e acompanhe a saúde das integrações em tempo real."
      meta={
        <span className="px-2.5 py-0.5 rounded-md bg-muted text-muted-foreground text-[11px] font-semibold">
          {ativosCount} ativo{ativosCount !== 1 ? "s" : ""}
        </span>
      }
      actions={
        <Button variant="outline" size="sm" onClick={reload} className="shrink-0 gap-2 rounded-xl h-9 text-xs">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      }
      bodyless
    >
      <div className="p-5 sm:p-7 space-y-8">

        {/* ── 1. Providers ── */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <PlugZap className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Providers configurados</h3>
            <span className="ml-auto text-[11px] text-muted-foreground">
              {loading ? "carregando…" : `${providers.length} configuração(ões)`}
            </span>
          </div>
          <div className="space-y-3">
            {visibleProviderUIs.map((ui) => {
              const row = providers.find((p) => p.provider === ui.provider) ?? null;
              return (
                <div key={ui.provider}>
                  <ProviderConfigCard
                    ui={ui}
                    existing={row}
                    lastSyncAt={row ? lastSyncByIntegration.get(row.id) ?? null : null}
                    onSaved={reload}
                  />
                  {ui.provider === "DB_DIAGNOSTICOS" && (
                    <details className="group rounded-lg border border-border/40 bg-muted/20 mt-2">
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
          </div>
        </section>

        {/* ── 2. Consulta por protocolo ── */}
        <section className="border border-border rounded-xl bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Consulta por protocolo externo</h3>
            {activeOperationalProvider && (
              <span className="ml-auto text-[11px] text-muted-foreground">
                via <span className="text-foreground font-medium">{activeOperationalProvider.ui.display_name}</span>
              </span>
            )}
          </div>
          <div className="p-4 space-y-4">
            {!activeOperationalProvider && (
              <p className="text-xs text-muted-foreground">Configure e ative um provider de apoio para consultar protocolos.</p>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                className="rounded-xl h-10 text-sm border-border focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                placeholder="external_protocol (ex.: PED-2025-0001)"
                value={protocol}
                onChange={(e) => setProtocol(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void buscarProtocolo(); }}
                disabled={!activeOperationalProvider}
              />
              <div className="flex gap-2 flex-wrap">
                <Button
                  className="rounded-xl text-xs h-10 gap-2"
                  onClick={buscarProtocolo}
                  disabled={!protocol.trim() || searching || !activeOperationalProvider}
                >
                  {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                  Buscar
                </Button>
                {consultActions.map((a) => (
                  <Button
                    key={a.key}
                    variant="outline"
                    className="rounded-xl text-xs h-10 gap-2"
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
              <div className="space-y-3 animate-in fade-in duration-300">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  {/* Resultado + PDFs */}
                  <div className="space-y-3">
                    <SubCard title="Resultado" icon={<FileText className="h-4 w-4" />}>
                      <div className="text-xs space-y-1">
                        <Kv k="Status" v={<span className="px-1.5 py-0.5 rounded border bg-muted text-foreground">{resultRow.status}</span>} />
                        <Kv k="Liberado" v={resultRow.liberado_em ? new Date(resultRow.liberado_em).toLocaleString() : "—"} />
                        <Kv k="Paciente" v={(resultRow.resultado?.pacienteNome as string) ?? "—"} />
                        <Kv k="Exames" v={String(exames.length)} />
                      </div>
                      {(resultRow?.resultado?.laudoPdfUrl || resultRow?.resultado?.laudoPdfBase64) && (
                        <div className="mt-2">
                          <Button size="sm" variant="outline" className="h-8 px-3 text-xs rounded-lg" onClick={() => abrirLaudoDoPayload(resultRow!.resultado)}>
                            <Download className="h-3.5 w-3.5 mr-1.5" /> Baixar laudo
                          </Button>
                        </div>
                      )}
                      {exames.length > 0 && (
                        <div className="mt-2 max-h-60 overflow-auto border border-border rounded-md">
                          <table className="w-full text-[11px]">
                            <thead className="bg-muted/40 text-muted-foreground sticky top-0">
                              <tr><th className="text-left px-2 py-1">Código</th><th className="text-left px-2 py-1">Nome</th><th className="text-left px-2 py-1">Valor</th><th className="text-left px-2 py-1">Referência</th></tr>
                            </thead>
                            <tbody>
                              {exames.map((ex: any, i: number) => (
                                <tr key={i} className="border-t border-border align-top">
                                  <td className="px-2 py-1 font-mono">{ex.codigoApoio}</td>
                                  <td className="px-2 py-1">{ex.nomeExame}</td>
                                  <td className="px-2 py-1 whitespace-nowrap">{ex.valor ?? "—"} {ex.unidade ?? ""}</td>
                                  <td className="px-2 py-1"><ReferenciaCell ex={ex} /></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </SubCard>
                    <SubCard title={`PDFs (${pdfList.length})`} icon={<FileText className="h-4 w-4" />}>
                      {pdfList.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nenhum PDF gravado. Use "Baixar PDF".</p>
                      ) : (
                        <ul className="space-y-1 text-xs">
                          {pdfList.map((p) => (
                            <li key={p.id} className="flex items-center gap-2">
                              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="truncate flex-1">{p.storage_path.split("/").pop()}</span>
                              <span className="text-muted-foreground">{p.size_bytes ?? 0}b</span>
                              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => downloadPdf(p)}><Download className="h-3.5 w-3.5" /></Button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </SubCard>
                  </div>
                  {/* Pendências */}
                  <SubCard title={`Pendências (${pendencias.length})`} icon={<AlertTriangle className="h-4 w-4 text-status-warning" />}>
                    {pendencias.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sem pendências registradas.</p>
                    ) : (
                      <ul className="space-y-2">
                        {pendencias.map((p, i) => (
                          <li key={i} className="text-xs border border-status-warning/30 rounded-md p-2 bg-status-warning-bg/40">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-foreground">{p.codigoExame ?? "—"}</span>
                              <span className="px-1.5 py-0.5 rounded border bg-background">{p.tipo ?? "—"}</span>
                              <span className="ml-auto text-muted-foreground">{p.dataRegistro ? new Date(p.dataRegistro).toLocaleString() : ""}</span>
                            </div>
                            <p className="text-muted-foreground">{p.descricao ?? ""}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </SubCard>
                  {/* Rastreabilidade */}
                  <SubCard title={`Rastreabilidade (${eventos.length})`} icon={<Clock className="h-4 w-4" />}>
                    {eventos.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sem eventos. Use "Rastreio".</p>
                    ) : (
                      <ol className="relative border-l-2 border-border ml-2 space-y-3">
                        {[...eventos].sort((a, b) => String(a.data ?? "").localeCompare(String(b.data ?? ""))).map((ev, i) => (
                          <li key={i} className="ml-3 relative">
                            <span className="absolute -left-[19px] mt-1 h-3 w-3 rounded-full bg-primary border-2 border-background" />
                            <div className="text-xs">
                              <div className="font-medium text-foreground">{ev.etapa ?? "EVENTO"}</div>
                              <div className="text-muted-foreground">{ev.data ? new Date(ev.data).toLocaleString() : "—"}</div>
                              {ev.observacao && <div className="text-muted-foreground italic mt-0.5">{ev.observacao}</div>}
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </SubCard>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── 3. Catálogo de provedores ── */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Catálogo de provedores</h3>
            <span className="ml-auto text-[11px] text-muted-foreground">
              {loading ? "carregando…" : `${providers.length}/${INTEGRATION_PROVIDERS.length} configurado(s)`}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {INTEGRATION_PROVIDERS.map((p) => {
              const cfg = providers.find((x) => x.provider === p.id);
              const status: { label: string; type: "success" | "neutral" | "warning" } =
                cfg?.ativo
                  ? { label: "Ativo", type: "success" }
                  : p.status === "disponivel"
                    ? { label: "Não configurado", type: "neutral" }
                    : { label: "Em breve", type: "warning" };
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors"
                >
                  <span className="h-6 w-6 rounded-md bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
                    {p.short}
                  </span>
                  <span className="text-xs font-medium text-foreground">{p.label}</span>
                  <StatusBadge label={status.label} type={status.type} />
                </div>
              );
            })}
          </div>
        </section>

        {/* ── 4. Jobs ── */}
        <section className="border border-border rounded-xl bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-foreground">Jobs recentes</h3>
            {falhasCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-destructive/10 text-destructive text-[10px] font-semibold">
                {falhasCount} falha{falhasCount !== 1 ? "s" : ""}
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <select
                className="h-8 text-[11px] rounded-lg border border-input bg-background px-2"
                value={jobFilter} onChange={(e) => setJobFilter(e.target.value)}
              >
                <option value="ALL">Todos</option>
                <option value="PENDING">Pendentes</option>
                <option value="PROCESSING">Processando</option>
                <option value="COMPLETED">Concluídos</option>
                <option value="FAILED">Falhos</option>
                <option value="CANCELLED">Cancelados</option>
              </select>
              <button onClick={reload} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
                <RefreshCw className="h-3 w-3" /> atualizar
              </button>
            </div>
          </div>
          {filteredJobs.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Nenhum job.</p>
          ) : (
            <div className="divide-y divide-border">
              {filteredJobs.map((j) => {
                const isOpen = openJobId === j.id;
                const ep = (j.payload as any)?.external_protocol ?? "—";
                return (
                  <div key={j.id} className="px-4 py-2.5 text-sm hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setOpenJobId(isOpen ? null : j.id)}
                        className="font-mono text-[11px] text-muted-foreground hover:text-foreground w-40 truncate text-left flex items-center gap-1"
                        title={j.id}
                      >
                        <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`} />
                        {j.kind}
                      </button>
                      <StatusPill status={j.status} />
                      <span className="text-[11px] text-muted-foreground hidden md:inline">retry {j.retry_count}</span>
                      <span className="text-[11px] text-muted-foreground hidden md:inline truncate max-w-[120px]">{ep}</span>
                      <span className="ml-auto text-[11px] text-muted-foreground truncate max-w-[180px]">
                        {j.last_error ?? new Date(j.created_at).toLocaleString()}
                      </span>
                      <div className="flex gap-1">
                        {j.status !== "COMPLETED" && j.status !== "CANCELLED" && (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={busyJobId === j.id} onClick={() => jobAction(j.id, "cancel")}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={busyJobId === j.id || j.status === "PROCESSING"} onClick={() => jobAction(j.id, "retry")}>
                          {busyJobId === j.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="mt-2 ml-6 pl-3 border-l-2 border-border text-xs space-y-2">
                        <Kv k="ID" v={<span className="font-mono">{j.id}</span>} />
                        <Kv k="Criado" v={new Date(j.created_at).toLocaleString()} />
                        <Kv k="Erro" v={j.last_error ?? "—"} />
                        <details>
                          <summary className="cursor-pointer text-muted-foreground">Payload</summary>
                          <pre className="bg-muted/40 p-2 rounded text-[11px] overflow-auto max-h-40">{JSON.stringify(j.payload ?? {}, null, 2)}</pre>
                        </details>
                        <details>
                          <summary className="cursor-pointer text-muted-foreground">Result</summary>
                          <pre className="bg-muted/40 p-2 rounded text-[11px] overflow-auto max-h-40">{JSON.stringify(j.result ?? {}, null, 2)}</pre>
                        </details>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </SectionShell>
  );
};

/* ── Sub-componentes auxiliares ───────────────────────────── */

const SubCard = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
  <div className="border border-border rounded-lg p-3 bg-background">
    <div className="flex items-center gap-2 mb-2">{icon}<h4 className="text-xs font-semibold text-foreground">{title}</h4></div>
    {children}
  </div>
);

const Kv = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex gap-2"><span className="text-muted-foreground w-20 shrink-0">{k}</span><span className="flex-1">{v}</span></div>
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

const ReferenciaCell = ({ ex }: { ex: any }) => {
  const linhas: any[] = Array.isArray(ex?.referenciaLinhas) ? ex.referenciaLinhas : [];
  if (linhas.length > 0) {
    return (
      <table className="w-full text-[11px] border border-border rounded">
        <thead className="bg-muted/30 text-muted-foreground"><tr><th className="text-left px-1.5 py-0.5">Categoria</th><th className="text-left px-1.5 py-0.5">Faixa</th></tr></thead>
        <tbody>
          {linhas.map((l, i) => {
            const cat = [l.categoria1, l.categoria2, l.categoria3, l.categoria4].filter(Boolean).join(" / ") || "—";
            const range = l.valor1 && l.valor2 ? `${l.valor1} a ${l.valor2}` : l.valor1 ? `≥ ${l.valor1}` : l.valor2 ? `≤ ${l.valor2}` : "—";
            const param = l.parametro1 && l.parametro2 ? ` (${l.parametro1}${l.unidadeDoParametro1 ? l.unidadeDoParametro1 : ""}–${l.parametro2}${l.unidadeDoParametro2 ?? ""})` : l.parametro1 ? ` (${l.parametro1}${l.unidadeDoParametro1 ?? ""})` : "";
            return (
              <tr key={i} className="border-t border-border">
                <td className="px-1.5 py-0.5">{cat}{param}</td>
                <td className="px-1.5 py-0.5 whitespace-nowrap">{range}{l.unidadeDoValor ? ` ${l.unidadeDoValor}` : ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }
  if (ex?.referenciaTexto) return <span className="text-muted-foreground">{ex.referenciaTexto}</span>;
  if (ex?.referencia) return <span className="text-muted-foreground">{ex.referencia}</span>;
  return <span className="text-muted-foreground">—</span>;
};

function abrirLaudoDoPayload(resultado: LaudoPayload | null | undefined) {
  if (!resultado) return;
  if (resultado.laudoPdfUrl) { window.open(resultado.laudoPdfUrl, "_blank", "noopener,noreferrer"); return; }
  if (resultado.laudoPdfBase64) {
    try {
      const bin = atob(resultado.laudoPdfBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) { console.error("[IntegracoesApoioTab] base64 inválido", e); }
  }
}

export default IntegracoesApoioTab;
