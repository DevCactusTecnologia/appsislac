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
import { supabase } from "@/integrations/supabase/client";
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
    <div className="p-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto">
      <div className="bg-card border border-border/60 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        {/* Header chassis: título + métrica + ação */}
        <div className="px-5 py-3 border-b border-border/50 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-foreground tracking-tight leading-tight">Impressão Geral</h1>
              <p className="text-[11px] text-muted-foreground leading-tight">Resumo diário de atendimentos por unidade</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {summary.length > 0 && (
              <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md bg-muted/60 border border-border/50 text-[11px]">
                <TrendingUp className="h-3 w-3 text-primary" />
                <span className="font-bold text-foreground tabular-nums">{totals.exames.toLocaleString()}</span>
                <span className="text-muted-foreground">exames</span>
              </div>
            )}
            <button
              type="button"
              onClick={handleImprimirLote}
              disabled={gerando || summary.length === 0}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {gerando
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Preparando…</>
                : <><Printer className="h-3.5 w-3.5" /> Imprimir resultados</>}
            </button>
          </div>
        </div>

        {/* Toolbar de filtros densa */}
        <div className="px-5 py-2.5 bg-muted/30 border-b border-border/50 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Unidade</span>
            <div className="flex bg-card border border-border/60 rounded-md p-0.5 overflow-x-auto no-scrollbar">
              {unidades.map((u) => {
                const active = selectedUnidade === u;
                return (
                  <button
                    key={u}
                    onClick={() => setSelectedUnidade(u)}
                    className={cn(
                      "px-2.5 h-7 rounded-[5px] text-xs font-semibold whitespace-nowrap transition-colors",
                      active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {u}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Data</span>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-8 px-2.5 text-xs font-medium rounded-md gap-1.5 bg-card">
                  <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  {date ? format(date, "dd MMM, yyyy", { locale: ptBR }) : "Selecionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar mode="single" selected={date} onSelect={(d) => { setDate(d); setCalendarOpen(false); }} locale={ptBR} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Área de conteúdo */}
        {summary.length === 0 || (useServer && serverLoading) ? (
          <div className="p-12 text-center">
            <div className="h-12 w-12 rounded-lg bg-muted/60 flex items-center justify-center mx-auto mb-3">
              {serverLoading
                ? <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
                : <FileText className="h-5 w-5 text-muted-foreground/60" />}
            </div>
            <p className="text-xs text-muted-foreground">
              {serverLoading ? "Carregando resumo…" : "Selecione uma unidade e data para visualizar o resumo."}
            </p>
          </div>
        ) : (
          <>
            {/* KPIs compactos */}
            <div className="px-5 py-3 grid grid-cols-3 gap-2 border-b border-border/50">
              {[
                { label: "Pacientes", value: totals.pacientes, icon: Users, color: "text-primary", bg: "bg-primary/10" },
                { label: "Exames", value: totals.exames, icon: TestTube, color: "text-[hsl(var(--status-success))]", bg: "bg-[hsl(var(--status-success))]/10" },
                { label: "Cancelados", value: totals.cancelados, icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
              ].map((card) => (
                <div key={card.label} className="flex items-center gap-2.5 px-3 py-2 rounded-md border border-border/50 bg-card">
                  <div className={cn("h-8 w-8 rounded-md flex items-center justify-center shrink-0", card.bg)}>
                    <card.icon className={cn("h-4 w-4", card.color)} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider leading-tight">{card.label}</p>
                    <p className="text-lg font-bold text-foreground tabular-nums leading-tight">{card.value.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Lista densa por unidade */}
            <div className="divide-y divide-border/40">
              {summary.map((row) => (
                <div key={row.unidade} className="px-5 py-3 flex items-center gap-4 hover:bg-muted/20 transition-colors">
                  <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{row.unidade}</p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">{row.data}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="inline-flex items-center gap-1 px-2 h-6 rounded-md bg-primary/10 text-primary font-bold tabular-nums">
                      <Users className="h-3 w-3" /> {row.totalPacientes}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 h-6 rounded-md bg-[hsl(var(--status-success))]/10 text-[hsl(var(--status-success))] font-bold tabular-nums">
                      <TestTube className="h-3 w-3" /> {row.totalExames}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 h-6 rounded-md bg-destructive/10 text-destructive font-bold tabular-nums">
                      <XCircle className="h-3 w-3" /> {row.cancelados}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ImpressaoGeral;
