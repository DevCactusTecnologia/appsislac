import { PageHeader } from "@/components/shared/PageHeader";
/**
 * IA-FIRST OWNERSHIP HEADER
 * ─────────────────────────
 * Estoque = laboratory inventory operations (insumos, lotes, movimentações).
 * NOT an ERP. NOT a financial system. NOT supplier management.
 * - Insumos / Lotes:   primary operational tabs (this page).
 * - Movimentações:     audit log — exposed via "Histórico" drawer (not a tab).
 * - Fornecedores:      institutional registry — lives in /configuracoes (auxiliary).
 * Multi-tenant: every store call resolves tenant_id server-side via current_tenant_id().
 */
import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { Package, Plus, Search, AlertTriangle, TrendingDown, Boxes, Calendar, Layers, ArrowDownUp, Pencil, Trash2, History, Sparkles, ShieldAlert, PackageX, Activity, ChevronRight, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn, searchNormalize } from "@/lib/utils";
import {
  CATEGORIAS_INSUMO,
  type Fornecedor,
  type Insumo,
  type Lote,
  type Movimentacao,
  diasParaVencer,
  excluirInsumo,
  excluirLote,
  listarFornecedores,
  listarInsumos,
  listarLotes,
  listarMovimentacoes,
  statusValidade,
  totalEstoque,
} from "@/data/estoqueStore";
// Dialogs lazy-loaded — só baixam chunks quando abertos.
const InsumoDialog = lazy(() => import("@/components/estoque/InsumoDialog"));
const LoteDialog = lazy(() => import("@/components/estoque/LoteDialog"));
const MovimentacaoDialog = lazy(() => import("@/components/estoque/MovimentacaoDialog"));
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

type Tab = "insumos" | "lotes";
type SmartFilter = null | "vencidos" | "vencendo" | "baixo" | "zerados";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "insumos", label: "Insumos", icon: Boxes },
  { id: "lotes", label: "Lotes", icon: Layers },
];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("pt-BR");
}
function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function Estoque() {
  const [tab, setTab] = useState<Tab>("insumos");
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState<string>("TODAS");
  const [smartFilter, setSmartFilter] = useState<SmartFilter>(null);

  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [movs, setMovs] = useState<Movimentacao[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);

  // dialogs
  const [insumoDialog, setInsumoDialog] = useState<{ open: boolean; insumo: Insumo | null }>({ open: false, insumo: null });
  const [loteDialog, setLoteDialog] = useState<{ open: boolean; lote: Lote | null; insumoId?: string }>({ open: false, lote: null });
  const [movDialog, setMovDialog] = useState<{ open: boolean; insumoId?: string; loteId?: string }>({ open: false });
  const [confirmExcluir, setConfirmExcluir] = useState<{ tipo: "insumo" | "lote"; id: string; nome: string } | null>(null);
  // Histórico (Movimentações) agora vive em drawer — não é mais aba.
  const [historicoOpen, setHistoricoOpen] = useState(false);

  async function carregar() {
    setLoading(true);
    const [i, l, m, f] = await Promise.all([
      listarInsumos(),
      listarLotes(),
      listarMovimentacoes({ limit: 200 }),
      listarFornecedores(),
    ]);
    setInsumos(i);
    setLotes(l);
    setMovs(m);
    setFornecedores(f);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  const fornMap = useMemo(() => new Map(fornecedores.map((f) => [f.id, f])), [fornecedores]);
  const insumoMap = useMemo(() => new Map(insumos.map((i) => [i.id, i])), [insumos]);

  // KPIs
  const kpis = useMemo(() => {
    const totalInsumos = insumos.filter((i) => i.ativo).length;
    const lotesAtivos = lotes.filter((l) => l.status === "ativo");
    const venceEmBreve = lotesAtivos.filter((l) => statusValidade(l.data_validade, insumoMap.get(l.insumo_id)?.alerta_validade_dias ?? 30) === "vence_em_breve").length;
    const vencidos = lotes.filter((l) => l.status === "vencido" || statusValidade(l.data_validade) === "vencido").length;
    const abaixoMinimo = insumos.filter((i) => {
      if (!i.ativo || i.estoque_minimo <= 0) return false;
      return totalEstoque(lotes, i.id) < i.estoque_minimo;
    }).length;
    return { totalInsumos, venceEmBreve, vencidos, abaixoMinimo };
  }, [insumos, lotes, insumoMap]);

  /* ─── INTELIGÊNCIA: consumo, ruptura, sugestões ─── */
  const smart = useMemo(() => {
    // Consumo (saídas + descartes) últimos 30 dias por insumo
    const agora = Date.now();
    const trintaDiasMs = 30 * 86_400_000;
    const consumo30d = new Map<string, number>();
    let consumoTotal30d = 0;
    let descarte30d = 0;
    movs.forEach((m) => {
      const t = new Date(m.data).getTime();
      if (agora - t > trintaDiasMs) return;
      if (m.tipo === "saida" || m.tipo === "descarte") {
        consumo30d.set(m.insumo_id, (consumo30d.get(m.insumo_id) ?? 0) + Number(m.quantidade));
        consumoTotal30d += Number(m.quantidade);
      }
      if (m.tipo === "descarte") descarte30d += Number(m.quantidade);
    });

    // Por insumo: saldo, dias de cobertura, status
    type LinhaInteligencia = {
      insumo: Insumo;
      saldo: number;
      consumoMedioDia: number;
      diasCobertura: number | null;
      status: "vencido" | "vencendo" | "zerado" | "baixo" | "ok";
      proximoVencimento: { dias: number; lote: Lote } | null;
    };
    const linhas: LinhaInteligencia[] = insumos
      .filter((i) => i.ativo)
      .map((i) => {
        const saldo = totalEstoque(lotes, i.id);
        const cons = consumo30d.get(i.id) ?? 0;
        const consumoMedioDia = cons / 30;
        const diasCobertura = consumoMedioDia > 0 ? Math.floor(saldo / consumoMedioDia) : null;
        // Próximo vencimento entre lotes ativos
        const ativos = lotes
          .filter((l) => l.insumo_id === i.id && l.status === "ativo" && l.quantidade_atual > 0)
          .sort((a, b) => new Date(a.data_validade).getTime() - new Date(b.data_validade).getTime());
        const prox = ativos[0] ? { dias: diasParaVencer(ativos[0].data_validade), lote: ativos[0] } : null;

        let status: LinhaInteligencia["status"] = "ok";
        if (prox && prox.dias < 0) status = "vencido";
        else if (saldo === 0) status = "zerado";
        else if (i.estoque_minimo > 0 && saldo < i.estoque_minimo) status = "baixo";
        else if (prox && prox.dias <= (i.alerta_validade_dias ?? 30)) status = "vencendo";

        return { insumo: i, saldo, consumoMedioDia, diasCobertura, status, proximoVencimento: prox };
      });

    const criticos = linhas
      .filter((l) => l.status !== "ok")
      .sort((a, b) => {
        const rank: Record<string, number> = { vencido: 0, zerado: 1, baixo: 2, vencendo: 3, ok: 4 };
        return rank[a.status] - rank[b.status];
      });

    const zerados = linhas.filter((l) => l.status === "zerado").length;

    // Top consumo (últimos 30 dias)
    const topConsumo = Array.from(consumo30d.entries())
      .map(([id, qtd]) => ({ insumo: insumoMap.get(id), qtd }))
      .filter((x) => x.insumo)
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 5);

    // Valor estimado em estoque (custo unitário × saldo)
    const valorEstoque = lotes
      .filter((l) => l.status === "ativo")
      .reduce((s, l) => s + Number(l.custo_unitario || 0) * Number(l.quantidade_atual || 0), 0);

    return { linhas, criticos, zerados, consumoTotal30d, descarte30d, topConsumo, valorEstoque };
  }, [insumos, lotes, movs, insumoMap]);

  // filtros
  const insumosFiltrados = useMemo(() => {
    const q = searchNormalize(busca);
    const idsSmart = smartFilter
      ? new Set(
          smart.linhas
            .filter((l) => {
              if (smartFilter === "vencidos") return l.status === "vencido";
              if (smartFilter === "vencendo") return l.status === "vencendo";
              if (smartFilter === "baixo") return l.status === "baixo";
              if (smartFilter === "zerados") return l.status === "zerado";
              return true;
            })
            .map((l) => l.insumo.id),
        )
      : null;
    return insumos.filter((i) => {
      if (idsSmart && !idsSmart.has(i.id)) return false;
      if (categoria !== "TODAS" && i.categoria !== categoria) return false;
      if (!q) return true;
      return searchNormalize(i.nome).includes(q) || searchNormalize(i.codigo).includes(q);
    });
  }, [insumos, busca, categoria, smartFilter, smart]);

  const lotesFiltrados = useMemo(() => {
    const q = searchNormalize(busca);
    return lotes.filter((l) => {
      const ins = insumoMap.get(l.insumo_id);
      if (categoria !== "TODAS" && ins?.categoria !== categoria) return false;
      if (!q) return true;
      return searchNormalize(l.numero_lote).includes(q) || (searchNormalize(ins?.nome).includes(q) ?? false);
    });
  }, [lotes, busca, categoria, insumoMap]);

  async function handleExcluir() {
    if (!confirmExcluir) return;
    const { tipo, id } = confirmExcluir;
    const fn = tipo === "insumo" ? excluirInsumo : excluirLote;
    const res = await fn(id);
    if (!res.ok) {
      toast.error(res.error ?? "Erro ao excluir");
      return;
    }
    toast.success("Excluído com sucesso");
    setConfirmExcluir(null);
    carregar();
  }

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 min-w-0">
      <PageHeader
        eyebrow="Operacional"
        title="Estoque"
        description="Gestão estratégica de insumos, lotes e validades."
        actions={
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Button variant="outline" size="sm" onClick={() => setHistoricoOpen(true)} className="flex-1 sm:flex-none min-w-0">
              <History className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Histórico</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setMovDialog({ open: true })} className="flex-1 sm:flex-none min-w-0">
              <ArrowDownUp className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Movimentar</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setLoteDialog({ open: true, lote: null })} className="flex-1 sm:flex-none min-w-0">
              <Layers className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Novo lote</span>
            </Button>
            <Button size="sm" onClick={() => setInsumoDialog({ open: true, insumo: null })} className="flex-1 sm:flex-none min-w-0">
              <Plus className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Novo insumo</span>
            </Button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={Boxes}
          label="Insumos ativos"
          value={kpis.totalInsumos}
          hint={`R$ ${smart.valorEstoque.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} em estoque`}
        />
          <KpiCard
            icon={AlertTriangle}
            label="Validade crítica"
            value={kpis.vencidos + kpis.venceEmBreve}
            hint={`${kpis.vencidos} vencidos · ${kpis.venceEmBreve} vencendo`}
            tone="danger"
            active={smartFilter === "vencidos" || smartFilter === "vencendo"}
            onClick={() => {
              const next = smartFilter === "vencidos" || smartFilter === "vencendo" ? null : (kpis.vencidos > 0 ? "vencidos" : "vencendo");
              setSmartFilter(next);
              setTab("insumos");
            }}
          />
          <KpiCard
            icon={TrendingDown}
            label="Abaixo do mínimo"
            value={kpis.abaixoMinimo}
            tone="warning"
            active={smartFilter === "baixo"}
            onClick={() => { setSmartFilter(smartFilter === "baixo" ? null : "baixo"); setTab("insumos"); }}
          />
          <KpiCard
            icon={PackageX}
            label="Sem estoque"
            value={smart.zerados}
            tone="danger"
            active={smartFilter === "zerados"}
            onClick={() => { setSmartFilter(smartFilter === "zerados" ? null : "zerados"); setTab("insumos"); }}
          />
      </div>

      {/* Painel de Inteligência / Decisão */}
      {!loading && (smart.criticos.length > 0 || smart.topConsumo.length > 0) && (
        <DecisionPanel
          criticos={smart.criticos}
          topConsumo={smart.topConsumo}
          consumoTotal={smart.consumoTotal30d}
          descarte={smart.descarte30d}
          onAcaoNovoLote={(insumoId) => setLoteDialog({ open: true, lote: null, insumoId })}
          onAcaoMovimentar={(insumoId) => setMovDialog({ open: true, insumoId })}
          onAbrirInsumo={(id) => { setSmartFilter(null); setBusca(insumoMap.get(id)?.nome ?? ""); setTab("insumos"); }}
        />
      )}

      {/* Tabs pill + filtros */}
      <div className="rounded-3xl border border-border/60 bg-card p-3 sm:p-4 space-y-4">
        {smartFilter && (
          <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2 text-[12.5px]">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-foreground font-medium">Filtro inteligente ativo:</span>
              <span className="text-muted-foreground">
                {smartFilter === "vencidos" && "Insumos com lotes vencidos"}
                {smartFilter === "vencendo" && "Insumos com lotes vencendo em breve"}
                {smartFilter === "baixo" && "Insumos abaixo do estoque mínimo"}
                {smartFilter === "zerados" && "Insumos sem estoque"}
              </span>
            </div>
            <button
              onClick={() => setSmartFilter(null)}
              className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" /> limpar
            </button>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted/50 p-1 w-full sm:w-auto sm:inline-flex">
            {TABS.map((t) => {
              const ativo = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "inline-flex items-center justify-center gap-1.5 px-2 sm:px-3.5 py-1.5 rounded-xl text-[11px] sm:text-[12.5px] font-medium transition-colors min-w-0",
                    ativo
                      ? "bg-card text-foreground shadow-[0_1px_3px_-1px_hsl(var(--foreground)/0.15)]"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <t.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span className="truncate">{t.label}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="h-9 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 min-w-0 flex-1 sm:flex-none"
              >
                <option value="TODAS">Todas categorias</option>
                {CATEGORIAS_INSUMO.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            <div className="relative flex-1 sm:flex-none">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar..."
                className="pl-9 h-9 w-full sm:w-56 rounded-xl"
              />
            </div>
          </div>
        </div>

        {/* Conteúdo */}
        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="h-7 w-7 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>
        ) : tab === "insumos" ? (
          <InsumosTabela
            insumos={insumosFiltrados}
            lotes={lotes}
            fornMap={fornMap}
            onEditar={(i) => setInsumoDialog({ open: true, insumo: i })}
            onExcluir={(i) => setConfirmExcluir({ tipo: "insumo", id: i.id, nome: i.nome })}
            onNovoLote={(i) => setLoteDialog({ open: true, lote: null, insumoId: i.id })}
            onMovimentar={(i) => setMovDialog({ open: true, insumoId: i.id })}
          />
        ) : (
          <LotesTabela
            lotes={lotesFiltrados}
            insumoMap={insumoMap}
            fornMap={fornMap}
            onEditar={(l) => setLoteDialog({ open: true, lote: l })}
            onExcluir={(l) => setConfirmExcluir({ tipo: "lote", id: l.id, nome: `Lote ${l.numero_lote}` })}
            onMovimentar={(l) => setMovDialog({ open: true, insumoId: l.insumo_id, loteId: l.id })}
          />
        )}
      </div>

      {/* Dialogs (lazy + conditional) */}
      <Suspense fallback={null}>
      {insumoDialog.open && (
      <InsumoDialog
        open={insumoDialog.open}
        onClose={() => setInsumoDialog({ open: false, insumo: null })}
        insumo={insumoDialog.insumo}
        fornecedores={fornecedores}
        onSaved={carregar}
      />
      )}
      {loteDialog.open && (
      <LoteDialog
        open={loteDialog.open}
        onClose={() => setLoteDialog({ open: false, lote: null })}
        lote={loteDialog.lote}
        insumos={insumos}
        fornecedores={fornecedores}
        insumoIdInicial={loteDialog.insumoId}
        onSaved={carregar}
      />
      )}
      {movDialog.open && (
      <MovimentacaoDialog
        open={movDialog.open}
        onClose={() => setMovDialog({ open: false })}
        insumos={insumos}
        lotes={lotes}
        insumoIdInicial={movDialog.insumoId}
        loteIdInicial={movDialog.loteId}
        onSaved={carregar}
      />
      )}
      </Suspense>

      {/* Histórico de movimentações — drawer (não é mais aba) */}
      <Sheet open={historicoOpen} onOpenChange={setHistoricoOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Histórico de movimentações</SheetTitle>
            <SheetDescription>Últimas 200 movimentações do estoque (entradas, saídas, descartes e ajustes).</SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <MovimentacoesTabela movs={movs} insumoMap={insumoMap} lotes={lotes} />
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!confirmExcluir} onOpenChange={(v) => !v && setConfirmExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{confirmExcluir?.nome}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluir} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ─── KPI Card ─── */
function KpiCard({ icon: Icon, label, value, tone, hint, active, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; tone?: "warning" | "danger"; hint?: string; active?: boolean; onClick?: () => void }) {
  const toneCls = tone === "danger"
    ? "text-red-600 bg-red-500/10"
    : tone === "warning"
    ? "text-amber-600 bg-amber-500/10"
    : "text-primary bg-primary/10";
  const ringCls = active
    ? tone === "danger"
      ? "ring-2 ring-red-500/40 border-red-500/40"
      : tone === "warning"
      ? "ring-2 ring-amber-500/40 border-amber-500/40"
      : "ring-2 ring-primary/40 border-primary/40"
    : "";
  const Wrapper: any = onClick ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        "text-left rounded-2xl border border-border/60 bg-card p-2.5 sm:p-4 flex items-center gap-2 sm:gap-3 transition-all w-full min-w-0",
        onClick && "hover:border-border hover:shadow-sm cursor-pointer",
        ringCls,
      )}
    >
      <div className={cn("w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0", toneCls)}>
        <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.1em] sm:tracking-[0.12em] text-muted-foreground font-semibold truncate">{label}</p>
        <p className="text-base sm:text-2xl font-bold text-foreground tabular-nums leading-tight mt-0.5">{value}</p>
        {hint && <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate hidden sm:block">{hint}</p>}
      </div>
    </Wrapper>
  );
}

/* ─── Tabelas ─── */
function InsumosTabela({ insumos, lotes, fornMap, onEditar, onExcluir, onNovoLote, onMovimentar }: {
  insumos: Insumo[]; lotes: Lote[]; fornMap: Map<string, Fornecedor>;
  onEditar: (i: Insumo) => void; onExcluir: (i: Insumo) => void; onNovoLote: (i: Insumo) => void; onMovimentar: (i: Insumo) => void;
}) {
  if (insumos.length === 0) return <EmptyState icon={Boxes} text="Nenhum insumo cadastrado" />;
  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Insumo</th>
              <th className="text-left px-4 py-3 font-semibold">Categoria</th>
              <th className="text-right px-4 py-3 font-semibold">Estoque</th>
              <th className="text-right px-4 py-3 font-semibold">Mínimo</th>
              <th className="text-left px-4 py-3 font-semibold">Fornecedor</th>
              <th className="text-right px-4 py-3 font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {insumos.map((i) => {
              const total = totalEstoque(lotes, i.id);
              const baixo = i.estoque_minimo > 0 && total < i.estoque_minimo;
              return (
                <tr key={i.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{i.nome}</p>
                    {i.codigo && <p className="text-[11px] text-muted-foreground">Cód. {i.codigo}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-border bg-muted/40 text-[11px] font-medium text-muted-foreground">{i.categoria}</span>
                  </td>
                  <td className={cn("px-4 py-3 text-right font-semibold tabular-nums", baixo && "text-amber-600")}>
                    {total} <span className="text-[11px] font-normal text-muted-foreground">{i.unidade_medida}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">{i.estoque_minimo > 0 ? i.estoque_minimo : "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{i.fornecedor_id ? fornMap.get(i.fornecedor_id)?.nome ?? "—" : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => onMovimentar(i)} title="Movimentar"><ArrowDownUp className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => onNovoLote(i)} title="Novo lote"><Layers className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => onEditar(i)} title="Editar"><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => onExcluir(i)} title="Excluir" className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LotesTabela({ lotes, insumoMap, fornMap, onEditar, onExcluir, onMovimentar }: {
  lotes: Lote[]; insumoMap: Map<string, Insumo>; fornMap: Map<string, Fornecedor>;
  onEditar: (l: Lote) => void; onExcluir: (l: Lote) => void; onMovimentar: (l: Lote) => void;
}) {
  if (lotes.length === 0) return <EmptyState icon={Layers} text="Nenhum lote registrado" />;
  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Insumo</th>
              <th className="text-left px-4 py-3 font-semibold">Lote</th>
              <th className="text-left px-4 py-3 font-semibold">Validade</th>
              <th className="text-right px-4 py-3 font-semibold">Saldo</th>
              <th className="text-left px-4 py-3 font-semibold">Status</th>
              <th className="text-left px-4 py-3 font-semibold">Fornecedor</th>
              <th className="text-right px-4 py-3 font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {lotes.map((l) => {
              const ins = insumoMap.get(l.insumo_id);
              const dias = diasParaVencer(l.data_validade);
              const sv = statusValidade(l.data_validade, ins?.alerta_validade_dias ?? 30);
              return (
                <tr key={l.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{ins?.nome ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-[12px]">{l.numero_lote}</td>
                  <td className="px-4 py-3">
                    <p className="text-foreground">{fmtDate(l.data_validade)}</p>
                    <p className={cn(
                      "text-[11px]",
                      sv === "vencido" ? "text-red-600" : sv === "vence_em_breve" ? "text-amber-600" : "text-muted-foreground",
                    )}>
                      {dias < 0 ? `${Math.abs(dias)}d vencido` : dias === 0 ? "vence hoje" : `${dias}d restantes`}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {l.quantidade_atual} <span className="text-[11px] font-normal text-muted-foreground">{ins?.unidade_medida}</span>
                  </td>
                  <td className="px-4 py-3"><LoteBadge status={l.status} sv={sv} /></td>
                  <td className="px-4 py-3 text-muted-foreground">{l.fornecedor_id ? fornMap.get(l.fornecedor_id)?.nome ?? "—" : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => onMovimentar(l)} title="Movimentar"><ArrowDownUp className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => onEditar(l)} title="Editar"><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => onExcluir(l)} title="Excluir" className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LoteBadge({ status, sv }: { status: string; sv: string }) {
  const map: Record<string, string> = {
    ativo: sv === "vencido" ? "bg-red-500/10 text-red-600 border-red-500/20" : sv === "vence_em_breve" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    esgotado: "bg-muted text-muted-foreground border-border",
    vencido: "bg-red-500/10 text-red-600 border-red-500/20",
    descartado: "bg-muted text-muted-foreground border-border",
  };
  const label = status === "ativo" && sv === "vencido" ? "Vencido" : status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={cn("inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-md border", map[status])}>{label}</span>;
}

function MovimentacoesTabela({ movs, insumoMap, lotes }: { movs: Movimentacao[]; insumoMap: Map<string, Insumo>; lotes: Lote[] }) {
  if (movs.length === 0) return <EmptyState icon={History} text="Nenhuma movimentação registrada" />;
  const loteMap = new Map(lotes.map((l) => [l.id, l]));
  const tipoLabel: Record<string, { label: string; cls: string }> = {
    entrada: { label: "Entrada", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
    saida: { label: "Saída", cls: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
    descarte: { label: "Descarte", cls: "bg-red-500/10 text-red-600 border-red-500/20" },
    ajuste: { label: "Ajuste", cls: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  };
  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Data</th>
              <th className="text-left px-4 py-3 font-semibold">Tipo</th>
              <th className="text-left px-4 py-3 font-semibold">Insumo</th>
              <th className="text-left px-4 py-3 font-semibold">Lote</th>
              <th className="text-right px-4 py-3 font-semibold">Quantidade</th>
              <th className="text-left px-4 py-3 font-semibold">Motivo</th>
              <th className="text-left px-4 py-3 font-semibold">Usuário</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {movs.map((m) => {
              const ins = insumoMap.get(m.insumo_id);
              const lote = m.lote_id ? loteMap.get(m.lote_id) : null;
              const t = tipoLabel[m.tipo];
              return (
                <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground">{fmtDateTime(m.data)}</td>
                  <td className="px-4 py-3"><span className={cn("inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-md border", t.cls)}>{t.label}</span></td>
                  <td className="px-4 py-3 font-medium text-foreground">{ins?.nome ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-[12px] text-muted-foreground">{lote?.numero_lote ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{m.quantidade}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.motivo || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground text-[12px]">{m.usuario_email || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// FornecedoresTabela removida — fornecedores agora vivem em /configuracoes (cadastro auxiliar).

function EmptyState({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-12 text-center">
      <Icon className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

/* ─── Painel de Decisão (Inteligência) ─── */
type CriticoLinha = {
  insumo: Insumo;
  saldo: number;
  consumoMedioDia: number;
  diasCobertura: number | null;
  status: "vencido" | "vencendo" | "zerado" | "baixo" | "ok";
  proximoVencimento: { dias: number; lote: Lote } | null;
};

function DecisionPanel({
  criticos,
  topConsumo,
  consumoTotal,
  descarte,
  onAcaoNovoLote,
  onAcaoMovimentar,
  onAbrirInsumo,
}: {
  criticos: CriticoLinha[];
  topConsumo: { insumo?: Insumo; qtd: number }[];
  consumoTotal: number;
  descarte: number;
  onAcaoNovoLote: (insumoId: string) => void;
  onAcaoMovimentar: (insumoId: string) => void;
  onAbrirInsumo: (id: string) => void;
}) {
  const top5 = criticos.slice(0, 5);
  const taxaDescarte = consumoTotal > 0 ? (descarte / consumoTotal) * 100 : 0;

  const statusMeta: Record<CriticoLinha["status"], { label: string; cls: string; icon: React.ComponentType<{ className?: string }>; acao: string }> = {
    vencido:  { label: "Vencido",       cls: "bg-red-500/10 text-red-600 border-red-500/20",       icon: ShieldAlert, acao: "Descartar lote" },
    zerado:   { label: "Sem estoque",   cls: "bg-red-500/10 text-red-600 border-red-500/20",       icon: PackageX,    acao: "Comprar urgente" },
    baixo:    { label: "Abaixo mínimo", cls: "bg-amber-500/10 text-amber-600 border-amber-500/20", icon: TrendingDown, acao: "Reabastecer" },
    vencendo: { label: "Vencendo",      cls: "bg-amber-500/10 text-amber-600 border-amber-500/20", icon: Calendar,    acao: "Priorizar uso" },
    ok:       { label: "OK",            cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", icon: Activity, acao: "" },
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      {/* Alertas Críticos — coluna larga */}
      <div className="lg:col-span-2 rounded-3xl border border-border/60 bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-[14px] font-semibold text-foreground leading-tight">Inteligência de Estoque</h2>
              <p className="text-[11.5px] text-muted-foreground">Itens que exigem decisão imediata</p>
            </div>
          </div>
          <span className="text-[11px] text-muted-foreground">{criticos.length} {criticos.length === 1 ? "alerta" : "alertas"}</span>
        </div>

        {top5.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-8 text-center">
            <Activity className="w-8 h-8 mx-auto text-emerald-600 mb-2" />
            <p className="text-[13px] text-foreground font-medium">Estoque saudável</p>
            <p className="text-[11.5px] text-muted-foreground mt-0.5">Nenhum alerta crítico no momento.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border/40 -mx-1">
            {top5.map((c) => {
              const meta = statusMeta[c.status];
              const Icon = meta.icon;
              const acaoFn = c.status === "vencido" || c.status === "vencendo" ? onAcaoMovimentar : onAcaoNovoLote;
              const acaoLabel = c.status === "vencido" ? "Descartar" : c.status === "vencendo" ? "Movimentar" : "Repor lote";
              return (
                <li key={c.insumo.id} className="flex items-center gap-3 px-1 py-2.5">
                  <div className={cn("w-9 h-9 rounded-xl border flex items-center justify-center shrink-0", meta.cls)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <button
                    onClick={() => onAbrirInsumo(c.insumo.id)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <p className="text-[13px] font-medium text-foreground truncate">{c.insumo.nome}</p>
                    <p className="text-[11.5px] text-muted-foreground truncate">
                      <span className={cn("inline-block px-1.5 py-px rounded text-[10.5px] mr-1.5 border", meta.cls)}>{meta.label}</span>
                      {c.status === "zerado" && "Saldo zerado"}
                      {c.status === "baixo" && `Saldo ${c.saldo} ${c.insumo.unidade_medida} (mín. ${c.insumo.estoque_minimo})`}
                      {c.status === "vencendo" && c.proximoVencimento && `Vence em ${c.proximoVencimento.dias}d — lote ${c.proximoVencimento.lote.numero_lote}`}
                      {c.status === "vencido" && c.proximoVencimento && `${Math.abs(c.proximoVencimento.dias)}d vencido — lote ${c.proximoVencimento.lote.numero_lote}`}
                      {c.diasCobertura !== null && c.status === "baixo" && ` · cobertura ~${c.diasCobertura}d`}
                    </p>
                  </button>
                  <Button size="sm" variant="outline" onClick={() => acaoFn(c.insumo.id)} className="shrink-0 h-8 text-[11.5px]">
                    {acaoLabel} <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        {criticos.length > 5 && (
          <p className="text-[11.5px] text-muted-foreground mt-3 px-1">
            +{criticos.length - 5} {criticos.length - 5 === 1 ? "alerta adicional" : "alertas adicionais"}. Use os filtros acima para ver a lista completa.
          </p>
        )}
      </div>

      {/* Indicadores 30d */}
      <div className="rounded-3xl border border-border/60 bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-[14px] font-semibold text-foreground leading-tight">Últimos 30 dias</h2>
            <p className="text-[11.5px] text-muted-foreground">Consumo & desperdício</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-muted/30 border border-border/60 p-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">Saídas</p>
            <p className="text-xl font-bold text-foreground tabular-nums mt-1">{consumoTotal.toLocaleString("pt-BR")}</p>
          </div>
          <div className="rounded-2xl bg-muted/30 border border-border/60 p-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">Descartes</p>
            <p className={cn("text-xl font-bold tabular-nums mt-1", taxaDescarte >= 5 ? "text-amber-600" : "text-foreground")}>
              {descarte.toLocaleString("pt-BR")}
            </p>
            <p className="text-[10.5px] text-muted-foreground mt-0.5">{taxaDescarte.toFixed(1)}% do consumo</p>
          </div>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-semibold mb-2">Top consumo</p>
          {topConsumo.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">Sem movimentações no período.</p>
          ) : (
            <ul className="space-y-2">
              {topConsumo.map((t, idx) => {
                const max = topConsumo[0].qtd || 1;
                const pct = (t.qtd / max) * 100;
                return (
                  <li key={t.insumo!.id} className="space-y-1">
                    <div className="flex items-center justify-between text-[11.5px]">
                      <button onClick={() => onAbrirInsumo(t.insumo!.id)} className="text-foreground hover:text-primary truncate text-left flex-1 min-w-0">
                        <span className="text-muted-foreground tabular-nums mr-1.5">{idx + 1}.</span>{t.insumo!.nome}
                      </button>
                      <span className="text-muted-foreground tabular-nums shrink-0 ml-2">{t.qtd}</span>
                    </div>
                    <div className="h-1 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary/60 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
