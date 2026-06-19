import { PageHeader } from "@/components/shared/PageHeader";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  ShieldCheck, Search, Clock, User, FileText, FlaskConical,
  ClipboardList, Printer, AlertTriangle, X,
  ArrowUpDown, ArrowLeft, Eye, Settings, Database,
} from "lucide-react";
import { FileDown } from "lucide-react";
import { gerarDossieRastreabilidade } from "@/lib/dossieRastreabilidade";
import { toast } from "sonner";
import {
  fetchAuditPacientes,
  fetchAuditLogsByProtocolo,
  fetchAppSettingsAudit,
  type AuditLog,
  type AuditPaciente,
  type AuditTipo,
} from "@/data/auditoriaStore";
import AuditoriaTecnicaTab from "@/components/auditoria/AuditoriaTecnicaTab";
import { fetchAtendimentoRelatedIds } from "@/data/auditLogsStore";
import { supabase } from "@/integrations/supabase/client";

const tipoConfig: Record<AuditTipo, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  atendimento: { label: "Atendimento", icon: User, color: "text-primary", bg: "bg-primary/8" },
  coleta: { label: "Coleta", icon: ClipboardList, color: "text-[hsl(var(--status-success))]", bg: "bg-status-success-bg" },
  analise: { label: "Análise", icon: FlaskConical, color: "text-[hsl(var(--status-info))]", bg: "bg-status-info-bg" },
  resultado: { label: "Resultado", icon: FileText, color: "text-[hsl(var(--status-success))]", bg: "bg-status-success-bg" },
  cancelamento: { label: "Cancelamento", icon: AlertTriangle, color: "text-[hsl(var(--status-danger))]", bg: "bg-status-danger-bg" },
  impressao: { label: "Impressão", icon: Printer, color: "text-[hsl(var(--status-purple))]", bg: "bg-[hsl(var(--status-purple))]/8" },
  alteracao: { label: "Alteração", icon: ArrowUpDown, color: "text-[hsl(var(--status-warning))]", bg: "bg-status-warning-bg" },
  configuracao: { label: "Configuração", icon: Settings, color: "text-[hsl(var(--status-info))]", bg: "bg-status-info-bg" },
};

const normalize = (v: string) =>
  v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function avatarClass(iniciais: string): string {
  // hash simples → escolha de cor semântica
  const h = iniciais.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const palette = [
    "bg-primary/10 text-primary",
    "bg-status-success-bg text-[hsl(var(--status-success))]",
    "bg-status-warning-bg text-[hsl(var(--status-warning))]",
    "bg-status-info-bg text-[hsl(var(--status-info))]",
  ];
  return palette[h % palette.length];
}

const Auditoria = () => {
  const [activeTab, setActiveTab] = useState<"rastreabilidade" | "tecnica">("rastreabilidade");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<AuditPaciente[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [selectedPatient, setSelectedPatient] = useState<AuditPaciente | null>(null);
  const [timelineLogs, setTimelineLogs] = useState<AuditLog[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  const [showConfigLogs, setShowConfigLogs] = useState(false);
  const [configLogs, setConfigLogs] = useState<AuditLog[]>([]);
  const [configLoading, setConfigLoading] = useState(false);

  const [detailLog, setDetailLog] = useState<AuditLog | null>(null);
  // Filtro propagado para a aba técnica quando há paciente selecionado
  const [atendimentoCtx, setAtendimentoCtx] = useState<{
    atendimentoId: string;
    exameIds: string[];
    pagamentoIds: string[];
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Click outside fecha dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Busca pacientes (server-side)
  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    setSearchLoading(true);
    fetchAuditPacientes(q)
      .then((res) => {
        if (cancelled) return;
        // refina filtro client-side por CPF normalizado
        const digits = q.replace(/\D/g, "");
        const qn = normalize(q);
        const filtered = res.filter(
          (p) =>
            normalize(p.paciente).includes(qn) ||
            p.protocolo.toLowerCase().includes(q.toLowerCase()) ||
            (digits.length > 0 && p.cpf.replace(/\D/g, "").includes(digits))
        );
        setSearchResults(filtered);
      })
      .finally(() => !cancelled && setSearchLoading(false));
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  // Carrega timeline ao selecionar paciente
  useEffect(() => {
    if (!selectedPatient) {
      setTimelineLogs([]);
      setAtendimentoCtx(null);
      return;
    }
    let cancelled = false;
    setTimelineLoading(true);
    fetchAuditLogsByProtocolo(selectedPatient.protocolo)
      .then((logs) => !cancelled && setTimelineLogs(logs))
      .finally(() => !cancelled && setTimelineLoading(false));

    // Resolve atendimento_id (numérico) + ids relacionados para a aba técnica
    (async () => {
      const { data } = await supabase
        .from("atendimentos")
        .select("id")
        .eq("protocolo", selectedPatient.protocolo)
        .maybeSingle();
      if (cancelled || !data?.id) return;
      const idStr = String(data.id);
      const related = await fetchAtendimentoRelatedIds(data.id);
      if (cancelled) return;
      setAtendimentoCtx({
        atendimentoId: idStr,
        exameIds: related.exameIds,
        pagamentoIds: related.pagamentoIds,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedPatient]);

  // Carrega logs de configuração sob demanda
  useEffect(() => {
    if (!showConfigLogs) return;
    let cancelled = false;
    setConfigLoading(true);
    fetchAppSettingsAudit(50)
      .then((logs) => !cancelled && setConfigLogs(logs))
      .finally(() => !cancelled && setConfigLoading(false));
    return () => {
      cancelled = true;
    };
  }, [showConfigLogs]);

  const handleSelect = useCallback((p: AuditPaciente) => {
    setSelectedPatient(p);
    setSearchQuery("");
    setIsSearchOpen(false);
    setShowConfigLogs(false);
  }, []);

  const handleBack = useCallback(() => setSelectedPatient(null), []);

  const detailJson = useMemo(() => {
    if (!detailLog) return null;
    if (detailLog.operacao === "INSERT" && detailLog.newValue) return JSON.stringify(detailLog.newValue, null, 2);
    if (detailLog.operacao === "DELETE" && detailLog.oldValue) return JSON.stringify(detailLog.oldValue, null, 2);
    if (detailLog.operacao === "UPDATE") {
      const diff: Record<string, { de: unknown; para: unknown }> = {};
      const oldObj = (detailLog.oldValue ?? {}) as Record<string, unknown>;
      const newObj = (detailLog.newValue ?? {}) as Record<string, unknown>;
      const keys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
      keys.forEach((k) => {
        if (JSON.stringify(oldObj[k]) !== JSON.stringify(newObj[k])) {
          diff[k] = { de: oldObj[k], para: newObj[k] };
        }
      });
      return JSON.stringify(diff, null, 2);
    }
    return null;
  }, [detailLog]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <PageHeader
          eyebrow="Governança"
          title="Auditoria"
          description="Pesquise por paciente, protocolo ou CPF — ou consulte alterações de configuração."
          actions={activeTab === "rastreabilidade" ? (
            <button
              onClick={() => {
                setShowConfigLogs((v) => !v);
                setSelectedPatient(null);
              }}
              className={`inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold transition-colors border ${
                showConfigLogs
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-foreground border-border/60 hover:bg-accent/40"
              }`}
            >
              <Settings className="h-4 w-4" />
              Configurações do sistema
            </button>
          ) : undefined}
        />

        {/* Tabs */}
        <div className="mb-8 flex items-center gap-1 p-1 bg-muted/40 border border-border/60 rounded-2xl w-fit">
          <button
            onClick={() => setActiveTab("rastreabilidade")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              activeTab === "rastreabilidade"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            Rastreabilidade
          </button>
          <button
            onClick={() => setActiveTab("tecnica")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              activeTab === "tecnica"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Database className="h-4 w-4" />
            Auditoria técnica
          </button>
        </div>

        {/* === Aba: Auditoria técnica === */}
        {activeTab === "tecnica" && (
          <AuditoriaTecnicaTab atendimentoFilter={atendimentoCtx ?? undefined} />
        )}

        {/* === Aba: Rastreabilidade (conteúdo original preservado) === */}
        {activeTab === "rastreabilidade" && (<>
        {/* Search */}
        {!showConfigLogs && (
          <div ref={containerRef} className="relative max-w-2xl mx-auto mb-10">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchOpen(true);
                  if (e.target.value.trim()) setSelectedPatient(null);
                }}
                onFocus={() => searchQuery.trim() && setIsSearchOpen(true)}
                placeholder="Buscar por Nome, CPF ou Protocolo…"
                className="pl-12 pr-10 py-4 w-full bg-card border border-border/60 rounded-2xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setIsSearchOpen(false);
                    inputRef.current?.focus();
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {isSearchOpen && debouncedQuery.trim() && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border/60 rounded-2xl shadow-[0_24px_80px_-12px_rgba(0,0,0,0.18)] z-50 overflow-hidden">
                {searchLoading ? (
                  <div className="px-4 py-10 text-center text-sm text-muted-foreground">Buscando…</div>
                ) : searchResults.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                    <ShieldCheck className="h-8 w-8 text-muted-foreground/25 mx-auto mb-2" />
                    Nenhum paciente encontrado
                  </div>
                ) : (
                  <ul className="py-1 max-h-[320px] overflow-y-auto">
                    {searchResults.map((r) => (
                      <li key={r.protocolo}>
                        <button
                          onClick={() => handleSelect(r)}
                          className="w-full flex items-start gap-3 px-5 py-3.5 text-left hover:bg-accent/40 transition-colors"
                        >
                          <div className="p-2 rounded-xl bg-primary/8 text-primary mt-0.5">
                            <User className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground">{r.paciente}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              CPF: {r.cpf || "—"} — <span className="font-mono">{r.protocolo}</span>
                            </p>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="px-5 py-2.5 border-t border-border/40 text-xs text-muted-foreground">
                  {searchResults.length} resultado{searchResults.length !== 1 ? "s" : ""}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Configurações do sistema */}
        {showConfigLogs ? (
          <div className="max-w-3xl mx-auto">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Últimas alterações de configuração
            </h2>
            {configLoading ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : configLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p>
            ) : (
              <div className="space-y-0">
                {configLogs.map((log, idx) => {
                  const cfg = tipoConfig[log.tipo];
                  return (
                    <div key={log.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`p-2 rounded-xl ${cfg.bg} z-10 border-2 border-background`}>
                          <cfg.icon className={`h-4 w-4 ${cfg.color}`} />
                        </div>
                        {idx < configLogs.length - 1 && <div className="w-px flex-1 bg-border/60" />}
                      </div>
                      <div className="flex-1 pb-5">
                        <div className="bg-card rounded-2xl border border-border/60 p-4 hover:shadow-sm transition-all duration-200">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-foreground">{log.acao}</p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-lg border border-border/60 text-[10px] font-semibold text-muted-foreground">
                                  {cfg.label}
                                </span>
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {log.dataHora}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => setDetailLog(log)}
                              className="p-1.5 rounded-xl hover:bg-accent transition-colors text-muted-foreground hover:text-foreground shrink-0"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold ${avatarClass(log.iniciais)}`}>
                              {log.iniciais}
                            </span>
                            <span className="text-xs text-muted-foreground">{log.usuario}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : !selectedPatient ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="p-6 rounded-2xl bg-primary/4 mb-5">
              <ShieldCheck className="h-16 w-16 text-primary/25" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">Rastreabilidade de Atendimentos</h2>
            <p className="text-sm text-muted-foreground text-center max-w-md leading-relaxed">
              Pesquise pelo nome, CPF ou protocolo para ver a linha do tempo completa do atendimento.
            </p>
          </div>
        ) : (
          <div>
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar à pesquisa
            </button>

            <div className="bg-card rounded-2xl border border-border/60 p-6 mb-8">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-primary/8">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">{selectedPatient.paciente}</h2>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="text-xs text-muted-foreground">CPF: {selectedPatient.cpf || "—"}</span>
                    <span className="text-xs font-mono text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-lg">
                      {selectedPatient.protocolo}
                    </span>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    try {
                      toast.info("Gerando dossiê...");
                      await gerarDossieRastreabilidade(selectedPatient.protocolo);
                    } catch (e: any) {
                      toast.error(e?.message ?? "Falha ao gerar dossiê");
                    }
                  }}
                  className="ml-auto inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
                  title="Exportar dossiê de rastreabilidade RDC 978/2025"
                >
                  <FileDown className="h-4 w-4" />
                  Dossiê PDF
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {timelineLoading ? "Carregando…" : `${timelineLogs.length} registro${timelineLogs.length !== 1 ? "s" : ""}`}
              </div>
            </div>

            {/* Timeline */}
            {timelineLoading ? (
              <p className="text-sm text-muted-foreground">Carregando linha do tempo…</p>
            ) : timelineLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum registro de auditoria para este protocolo.</p>
            ) : (
              <div className="space-y-0 max-w-3xl">
                {timelineLogs.map((log, idx) => {
                  const cfg = tipoConfig[log.tipo];
                  const hasDetalhes = log.oldValue || log.newValue;
                  return (
                    <div key={log.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`p-2 rounded-xl ${cfg.bg} z-10 border-2 border-background`}>
                          <cfg.icon className={`h-4 w-4 ${cfg.color}`} />
                        </div>
                        {idx < timelineLogs.length - 1 && <div className="w-px flex-1 bg-border/60" />}
                      </div>
                      <div className="flex-1 pb-5">
                        <div className={`bg-card rounded-2xl border p-4 hover:shadow-sm transition-all duration-200 ${log.posFinalizacao ? "border-[hsl(var(--status-warning))]/40 ring-1 ring-[hsl(var(--status-warning))]/20" : "border-border/60"}`}>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-foreground">{log.acao}</p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-lg border border-border/60 text-[10px] font-semibold text-muted-foreground">
                                  {cfg.label}
                                </span>
                                {log.posFinalizacao && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-status-warning-bg text-[hsl(var(--status-warning))] text-[10px] font-bold">
                                    <AlertTriangle className="h-2.5 w-2.5" />
                                    Edição pós-finalização
                                  </span>
                                )}
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {log.dataHora}
                                </span>
                              </div>
                            </div>
                            {Boolean(hasDetalhes) && (
                              <button
                                onClick={() => setDetailLog(log)}
                                className="p-1.5 rounded-xl hover:bg-accent transition-colors text-muted-foreground hover:text-foreground shrink-0"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold ${avatarClass(log.iniciais)}`}>
                              {log.iniciais}
                            </span>
                            <span className="text-xs text-muted-foreground">{log.usuario}</span>
                          </div>
                          {log.justificativa && (
                            <div className="mt-2.5 p-2.5 rounded-xl bg-muted/40 border border-border/40">
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Justificativa</p>
                              <p className="text-xs text-foreground leading-relaxed">{log.justificativa}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        </>)}
      </div>

      {/* Detail dialog */}
      {detailLog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-foreground/30 backdrop-blur-[3px]" onClick={() => setDetailLog(null)} />
          <div className="relative bg-card rounded-3xl border border-border shadow-[0_24px_80px_-12px_hsl(var(--foreground)/0.18)] w-full max-w-lg max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] overflow-y-auto p-8 animate-fade-in-up">
            <div className="flex items-center gap-3 mb-6">
              {(() => {
                const cfg = tipoConfig[detailLog.tipo];
                return (
                  <div className={`p-2 rounded-xl ${cfg.bg}`}>
                    <cfg.icon className={`h-5 w-5 ${cfg.color}`} />
                  </div>
                );
              })()}
              <h2 className="text-lg font-bold text-foreground">Detalhes do Registro</h2>
              <button
                onClick={() => setDetailLog(null)}
                className="ml-auto p-1.5 rounded-xl hover:bg-accent transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm mb-5">
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Data/Hora</p>
                <p className="font-medium text-foreground">{detailLog.dataHora}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Usuário</p>
                <div className="flex items-center gap-2">
                  <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold ${avatarClass(detailLog.iniciais)}`}>
                    {detailLog.iniciais}
                  </span>
                  <span className="font-medium text-foreground">{detailLog.usuario}</span>
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Paciente</p>
                <p className="font-medium text-foreground">{detailLog.paciente || "—"}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Protocolo</p>
                {detailLog.protocolo ? (
                  <span className="font-mono text-sm text-foreground bg-muted/60 px-2 py-0.5 rounded-lg">
                    {detailLog.protocolo}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </div>
            </div>
            <div className="mb-4">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Ação</p>
              <p className="text-sm font-semibold text-foreground">{detailLog.acao}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {detailLog.entidade} / {detailLog.operacao}
              </p>
              {detailLog.posFinalizacao && (
                <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-lg bg-status-warning-bg text-[hsl(var(--status-warning))] text-[10px] font-bold">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  Edição pós-finalização
                </span>
              )}
            </div>
            {detailLog.justificativa && (
              <div className="mb-4 p-3 rounded-2xl bg-status-warning-bg/40 border border-[hsl(var(--status-warning))]/30">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Justificativa</p>
                <p className="text-sm text-foreground leading-relaxed">{detailLog.justificativa}</p>
              </div>
            )}
            {detailJson && (
              <div className="bg-muted/30 rounded-2xl p-4 border border-border/40">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  {detailLog.operacao === "UPDATE" ? "Alterações" : "Dados"}
                </p>
                <pre className="text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed max-h-[40vh] overflow-y-auto">
                  {detailJson}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Auditoria;
