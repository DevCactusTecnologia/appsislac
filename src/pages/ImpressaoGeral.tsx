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
  const unidadesAtivas = useMemo(() => getUnidades().filter(u => u.ativo), []);
  const unidades = useMemo(() => unidadesAtivas.map(u => u.nome), [unidadesAtivas]);
  const [selectedUnidade, setSelectedUnidade] = useState<string>(unidades[0] || "");
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
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

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-primary/8 flex items-center justify-center"><FileText className="h-5 w-5 text-primary" /></div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Impressão Geral</h1>
            <p className="text-xs text-muted-foreground">Resumo de atendimentos por unidade</p>
          </div>
        </div>
        {summary.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-muted/40 border border-border/30 text-sm">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="font-bold text-foreground">{totals.exames.toLocaleString()}</span>
            <span className="text-muted-foreground text-xs">exames no total</span>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      {summary.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: "Pacientes", value: totals.pacientes, icon: Users, color: "text-primary", bg: "bg-primary/8" },
            { label: "Exames", value: totals.exames, icon: TestTube, color: "text-[hsl(var(--status-success))]", bg: "bg-[hsl(var(--status-success))]/10" },
            { label: "Cancelados", value: totals.cancelados, icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
          ].map((card) => (
            <div key={card.label} className="p-4 rounded-3xl border border-border/60 bg-card flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-2xl flex items-center justify-center shrink-0", card.bg)}>
                <card.icon className={cn("h-5 w-5", card.color)} />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-medium">{card.label}</p>
                <p className="text-xl font-bold text-foreground">{card.value.toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="p-5 rounded-3xl border border-border/60 bg-card">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_220px_auto] items-end gap-4">
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-2 block">Unidade</label>
            <div className="flex flex-wrap gap-2">
              {unidades.map((u) => (
                <button key={u} onClick={() => setSelectedUnidade(u)}
                  className={cn("px-4 py-2.5 rounded-2xl text-sm font-medium border transition-all", selectedUnidade === u ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-card text-foreground border-border/60 hover:border-primary/40")}>
                  {u}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-2 block">Data</label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal h-10 rounded-2xl">
                  <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                  {date ? format(date, "dd MMM, yyyy", { locale: ptBR }) : "Selecionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={date} onSelect={(d) => { setDate(d); setCalendarOpen(false); }} locale={ptBR} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
          <Button className="h-10 rounded-2xl px-6 gap-2"><Search className="h-4 w-4" /> Buscar</Button>
        </div>
      </div>

      {/* Results */}
      <div className="rounded-3xl border border-border/60 bg-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border/40 bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /><span className="text-sm font-semibold text-foreground">Resultados</span></div>
          <span className="text-xs text-muted-foreground">{summary.length} unidade</span>
        </div>

        {summary.length === 0 ? (
          <div className="p-16 text-center">
            <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3"><FileText className="h-6 w-6 text-muted-foreground/50" /></div>
            <p className="text-sm text-muted-foreground">Selecione uma unidade e data.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {summary.map((row) => (
              <div key={row.unidade} className="p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">{row.unidade}</p>
                  <span className="text-xs text-muted-foreground">{row.data}</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Pacientes", value: row.totalPacientes, cls: "text-primary bg-primary/8" },
                    { label: "Exames", value: row.totalExames, cls: "text-[hsl(var(--status-success))] bg-[hsl(var(--status-success))]/10" },
                    { label: "Cancelados", value: row.cancelados, cls: "text-destructive bg-destructive/10" },
                  ].map((m) => (
                    <div key={m.label} className="text-center p-3 rounded-2xl bg-muted/30">
                      <p className="text-[10px] text-muted-foreground mb-1">{m.label}</p>
                      <span className={cn("inline-flex items-center justify-center px-2 py-0.5 rounded-xl font-bold text-sm", m.cls)}>{m.value}</span>
                    </div>
                  ))}
                </div>
                <button className="w-full sm:w-auto px-4 py-2 rounded-2xl border border-border/60 text-xs font-medium text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-1.5">
                  <Printer className="h-3.5 w-3.5" /> Imprimir resultados
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImpressaoGeral;
