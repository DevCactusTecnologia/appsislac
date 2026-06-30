import { useState, useMemo, useEffect } from "react";
import { Printer, Search, Calendar as CalendarIcon, FileText, Users, TestTube, XCircle, TrendingUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getAtendimentos, subscribe as subscribeAtendimentos } from "@/data/atendimentoStore";
import { getUnidades } from "@/data/unidadeStore";
import { cn } from "@/lib/utils";
import { useFeatureFlag, isFeatureEnabled } from "@/lib/featureFlags";
import { db as supabase } from "@/runtime/db";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { gerarLaudoLotePdf } from "@/lib/laudoBatchPdf";

const ImpressaoGeral = () => {
  const { user: authUser } = useAuth();
  const unidadesAtivas = useMemo(() => getUnidades().filter(u => u.ativo), []);
  const unidades = useMemo(() => unidadesAtivas.map(u => u.nome), [unidadesAtivas]);
  const [selectedUnidade, setSelectedUnidade] = useState<string>(unidades[0] || "");
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [, setTick] = useState(0);

  // ── Branch por flag ──────────────────────────────────────────────────
  // ON  + !LEGACY → RPC `impressao_geral_resumo` (server-driven)
  // OFF / USE_LEGACY_STORE → mantém o caminho legado com `getAtendimentos`
  const flagPaginated = useFeatureFlag("paginated_atendimentos");
  const flagLegacy = useFeatureFlag("USE_LEGACY_STORE");
  const useServer = flagPaginated && !flagLegacy && !isFeatureEnabled("USE_LEGACY_STORE");

  // Legacy: assina o store global para reagir a mudanças locais
  useEffect(() => {
    if (useServer) return;
    return subscribeAtendimentos(() => setTick(t => t + 1));
  }, [useServer]);

  // Server: estado do resumo carregado via RPC
  const [serverSummary, setServerSummary] = useState<
    { unidade: string; totalPacientes: number; totalExames: number; cancelados: number; data: string }[]
  >([]);
  const [serverLoading, setServerLoading] = useState(false);

  useEffect(() => {
    if (!useServer) return;
    if (!date || !selectedUnidade) {
      setServerSummary([]);
      return;
    }
    const unidade = unidadesAtivas.find(u => u.nome === selectedUnidade);
    if (!unidade) {
      setServerSummary([]);
      return;
    }
    let cancelled = false;
    setServerLoading(true);
    const isoDate = format(date, "yyyy-MM-dd");
    const dateStr = format(date, "dd/MM/yyyy");
    (async () => {
      try {
        const { data: rows, error } = await supabase.rpc("impressao_geral_resumo", {
          _date: isoDate,
          _unidade_id: unidade.id,
        });
        if (cancelled) return;
        if (error) throw error;
        const row = (rows ?? [])[0] as
          | { total_pacientes: number; total_exames: number; cancelados: number }
          | undefined;
        setServerSummary([{
          unidade: selectedUnidade,
          totalPacientes: Number(row?.total_pacientes ?? 0),
          totalExames: Number(row?.total_exames ?? 0),
          cancelados: Number(row?.cancelados ?? 0),
          data: dateStr,
        }]);
      } catch (e) {
        if (cancelled) return;
        logger.warn("ImpressaoGeral", "RPC impressao_geral_resumo falhou", {
          error: (e as Error)?.message,
        });
        setServerSummary([{
          unidade: selectedUnidade,
          totalPacientes: 0,
          totalExames: 0,
          cancelados: 0,
          data: dateStr,
        }]);
      } finally {
        if (!cancelled) setServerLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [useServer, date, selectedUnidade, unidadesAtivas]);

  const legacySummary = useMemo(() => {
    if (useServer) return [];
    if (!date || !selectedUnidade) return [];
    const dateStr = format(date, "dd/MM/yyyy");
    const unidade = getUnidades().find(u => u.nome === selectedUnidade);
    const atendimentosForDate = getAtendimentos().filter((a) => {
      const matchesDate = a.data.startsWith(dateStr);
      const matchesUnidade = unidade ? a.unidadeId === unidade.id : true;
      return matchesDate && matchesUnidade;
    });
    const totalPacientes = atendimentosForDate.length;
    const totalExames = atendimentosForDate.reduce((sum, a) => sum + (a.exames?.length || 0), 0);
    const cancelados = atendimentosForDate.filter(a => a.statusAtendimento.label === "Cancelado").length;
    return [{ unidade: selectedUnidade, totalPacientes, totalExames, cancelados, data: dateStr }];
  }, [useServer, selectedUnidade, date]);

  const summary = useServer ? serverSummary : legacySummary;

  const totals = useMemo(() => ({
    pacientes: summary.reduce((s, r) => s + r.totalPacientes, 0),
    exames: summary.reduce((s, r) => s + r.totalExames, 0),
    cancelados: summary.reduce((s, r) => s + r.cancelados, 0),
  }), [summary]);

  const computeIniciais = (nome: string): string => {
    const parts = (nome || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const fetchProtocolosFinalizados = async (unidadeId: string | undefined, selectedDate: Date): Promise<string[]> => {
    const start = new Date(selectedDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    let query = supabase
      .from("atendimentos")
      .select("protocolo, atendimento_exames!inner(status)")
      .gte("data", start.toISOString())
      .lt("data", end.toISOString())
      .eq("atendimento_exames.status", "finalizado")
      .neq("status_atendimento", "Cancelado")
      .neq("status_atendimento", "Pedido cancelado");

    if (unidadeId) query = query.eq("unidade_id", unidadeId);

    const { data: rows, error } = await query;
    if (error) throw error;

    return Array.from(new Set(
      ((rows ?? []) as Array<{ protocolo?: string | null }>)
        .map((r) => r.protocolo)
        .filter((p): p is string => !!p),
    )).sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
  };

  const handleImprimirLote = async () => {
    if (gerando) return;
    if (!date || !selectedUnidade) {
      toast.error("Selecione unidade e data antes de imprimir.");
      return;
    }
    const unidade = unidadesAtivas.find(u => u.nome === selectedUnidade);
    const dateStr = format(date, "dd/MM/yyyy");

    let protocolosElegiveis: string[] = [];
    try {
      protocolosElegiveis = await fetchProtocolosFinalizados(unidade?.id, date);
    } catch (error) {
      logger.warn("ImpressaoGeral", "consulta server-side de protocolos finalizados falhou; usando cache local", {
        error: (error as Error)?.message,
      });
      protocolosElegiveis = getAtendimentos()
        .filter(a => a.data.startsWith(dateStr))
        .filter(a => !unidade || a.unidadeId === unidade.id)
        .filter(a => a.statusAtendimento.label !== "Cancelado" && a.statusAtendimento.label !== "Pedido cancelado")
        .filter(a => a.examesCobranca?.some((e) => ["Digitado", "Impresso", "Retificado"].includes(e.status ?? "")))
        .map(a => a.protocolo)
        .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
    }

    if (protocolosElegiveis.length === 0) {
      toast.error("Nenhum resultado finalizado encontrado para essa unidade e data.");
      return;
    }
    // Resolve assinatura do usuário logado (mesma lógica do laudo individual).
    let assinaturaLaudo: { tipo: "carimbo" | "imagem"; conselho: string | null; url: string | null } = {
      tipo: "carimbo", conselho: null, url: null,
    };
    const uid = authUser?.id;
    if (uid && typeof uid === "string") {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("assinatura_tipo,assinatura_imagem_key,assinatura_conselho")
          .eq("user_id", uid)
          .maybeSingle();
        if (data) {
          const p = data as { assinatura_tipo?: string; assinatura_imagem_key?: string | null; assinatura_conselho?: string | null };
          const tipo: "carimbo" | "imagem" = p.assinatura_tipo === "imagem" ? "imagem" : "carimbo";
          let url: string | null = null;
          if (tipo === "imagem" && p.assinatura_imagem_key) {
            const r = await supabase.functions.invoke("assinatura-url", { body: { userId: uid } });
            url = (r.data as { url?: string | null } | null)?.url ?? null;
          }
          assinaturaLaudo = { tipo, conselho: p.assinatura_conselho ?? null, url };
        }
      } catch { /* segue sem assinatura */ }
    }
    const nome = authUser?.nome || "Analista";
    const analistaAtual = { nome, iniciais: computeIniciais(nome) };
    const isoDate = format(date, "yyyy-MM-dd");
    const safeUnidade = selectedUnidade.replace(/[\\/:*?"<>|]+/g, " ").trim() || "Unidade";
    const filename = `Resultados_${safeUnidade}_${isoDate}`;
    setGerando(true);
    const toastId = toast.loading(`Preparando laudos (${protocolosElegiveis.length} atendimentos)…`);
    try {
      const result = await gerarLaudoLotePdf({
        protocolos: protocolosElegiveis,
        analistaAtual,
        assinaturaLaudo,
        filename,
        onProgress: (frac, msg) => {
          toast.loading(`${msg ?? "Preparando…"} (${Math.round(frac * 100)}%)`, { id: toastId });
        },
      });
      toast.success(
        `Laudo enviado para impressão · ${result.totalAtendimentos} atendimentos · ${result.totalExames} exames. No diálogo, escolha "Salvar como PDF".`,
        { id: toastId, duration: 7000 },
      );

      logger.info("ImpressaoGeral", "lote gerado", {
        unidade: selectedUnidade, data: dateStr,
        totalAtendimentos: result.totalAtendimentos, totalExames: result.totalExames,
        ms: Math.round(result.ms),
      });
    } catch (e) {
      const msg = (e as Error)?.message || "Falha ao gerar PDF.";
      toast.error(msg, { id: toastId });
      logger.warn("ImpressaoGeral", "falha ao gerar lote", { error: msg });
    } finally {
      setGerando(false);
    }
  };


  return (
    <div className="min-h-full w-full bg-muted/30 p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-5xl mx-auto bg-card rounded-xl shadow-sm border border-border/60 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border/40 flex items-center justify-between gap-4 flex-wrap bg-card">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-foreground tracking-tight">Impressão Geral</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Gerenciamento e emissão de laudos em lote</p>
          </div>
          <button
            type="button"
            onClick={handleImprimirLote}
            disabled={gerando || summary.length === 0}
            className="inline-flex items-center justify-center px-4 h-9 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-lg transition-colors shadow-sm gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {gerando
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Preparando…</>
              : <><Printer className="h-4 w-4" /> Imprimir resultados</>}
          </button>
        </div>

        {/* Filter Bar */}
        <div className="px-6 py-4 bg-muted/30 border-b border-border/40 flex flex-wrap items-end gap-6">
          <div className="flex-1 min-w-[260px]">
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Unidade de Atendimento</label>
            <div className="flex flex-wrap gap-2">
              {unidades.map((u) => {
                const active = selectedUnidade === u;
                return (
                  <button
                    key={u}
                    onClick={() => setSelectedUnidade(u)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-card text-muted-foreground border border-border/60 hover:border-border hover:text-foreground"
                    )}
                  >
                    {u}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="w-52">
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Data de Referência</label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="w-full inline-flex items-center justify-between px-3 h-9 bg-card border border-border/60 rounded-lg text-xs font-medium text-foreground hover:border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                >
                  <span>{date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}</span>
                  <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar mode="single" selected={date} onSelect={(d) => { setDate(d); setCalendarOpen(false); }} locale={ptBR} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* KPIs ou empty state */}
        {summary.length === 0 || (useServer && serverLoading) ? (
          <div className="p-16 text-center">
            <div className="h-12 w-12 rounded-xl bg-muted/60 flex items-center justify-center mx-auto mb-3">
              {serverLoading
                ? <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
                : <FileText className="h-5 w-5 text-muted-foreground/60" />}
            </div>
            <p className="text-sm text-muted-foreground">
              {serverLoading ? "Carregando resumo…" : "Selecione uma unidade e data para visualizar o resumo."}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-6 py-6">
              <div className="bg-card p-4 rounded-xl border border-border/50 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col">
                <span className="text-xs font-medium text-muted-foreground mb-1">Pacientes</span>
                <div className="flex items-end justify-between">
                  <span className="text-2xl font-bold text-foreground leading-none tabular-nums">{totals.pacientes.toLocaleString()}</span>
                  <Users className="h-4 w-4 text-primary/60" />
                </div>
              </div>
              <div className="bg-card p-4 rounded-xl border border-border/50 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col">
                <span className="text-xs font-medium text-muted-foreground mb-1">Exames Concluídos</span>
                <div className="flex items-end justify-between">
                  <span className="text-2xl font-bold text-foreground leading-none tabular-nums">{totals.exames.toLocaleString()}</span>
                  <TestTube className="h-4 w-4 text-[hsl(var(--status-success))]/70" />
                </div>
              </div>
              <div className="bg-card p-4 rounded-xl border border-border/50 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col">
                <span className="text-xs font-medium text-muted-foreground mb-1">Cancelados</span>
                <div className="flex items-end justify-between">
                  <span className={cn("text-2xl font-bold leading-none tabular-nums", totals.cancelados > 0 ? "text-destructive" : "text-foreground")}>
                    {totals.cancelados.toLocaleString()}
                  </span>
                  <XCircle className="h-4 w-4 text-destructive/60" />
                </div>
              </div>
            </div>

            {/* Tabela densa */}
            <div className="px-6 pb-6 overflow-hidden">
              <div className="border border-border/50 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border/50">
                      <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Unidade</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">Pacientes</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">Exames</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">Cancelados</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">Status</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {summary.map((row) => {
                      const ok = row.totalExames > 0;
                      return (
                        <tr key={row.unidade} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="text-sm font-semibold text-foreground">{row.unidade}</div>
                            <div className="text-[11px] text-muted-foreground italic">Resumo do dia</div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-sm font-medium text-foreground tabular-nums">{row.totalPacientes}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-primary/10 text-primary tabular-nums">
                              {row.totalExames}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded text-xs font-bold tabular-nums",
                              row.cancelados > 0 ? "bg-destructive/10 text-destructive" : "text-muted-foreground"
                            )}>
                              {row.cancelados}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={cn(
                                "inline-block w-2 h-2 rounded-full",
                                ok ? "bg-[hsl(var(--status-success))] animate-pulse" : "bg-muted-foreground/40"
                              )}
                              title={ok ? "Pronto para impressão" : "Sem exames"}
                            />
                          </td>
                          <td className="px-4 py-3 text-right text-[11px] text-muted-foreground tabular-nums">
                            {row.data}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ImpressaoGeral;
