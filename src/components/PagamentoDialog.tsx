import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  X, Trash2, Banknote, CreditCard, QrCode, CalendarIcon,
  TrendingUp, CheckCircle2, AlertTriangle, Receipt, DollarSign,
  Gift, Percent, Plus,
} from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { fireSuccessConfetti } from "@/lib/confetti";
import type { PagamentoRealizado } from "@/data/types";
import { fmtBRL } from "@/lib/utils";

/* ── Types ── */
type Unidade = "BRL" | "PCT";

interface Pagamento {
  tipo: string;
  valor: string;
  data: Date;
  /** Apenas para Desconto/Acréscimo: forma do valor */
  unidade?: Unidade;
  /** Apenas para Desconto/Acréscimo: alvo (null = Total geral, número = índice em exames) */
  exameIdx?: number | null;
}

export interface ExameInfoPagamento {
  nome: string;
  valor: number;
}

interface PagamentoDialogProps {
  open: boolean;
  onClose: () => void;
  itens?: number;
  subtotal?: number;
  desconto?: number;
  total?: number;
  valorPago?: number;
  saldoDevedor?: number;
  /** Lista de exames cobrados do paciente — usada para desconto por exame. */
  exames?: ExameInfoPagamento[];
  onConfirm?: (resultado: { valorPago: number; desconto: number; novosPagamentos: PagamentoRealizado[] }) => void;
  pagamentosRealizados?: PagamentoRealizado[];
  onRemovePagamentoRealizado?: (index: number) => void;
  isEditing?: boolean;
  /** Data em que o desconto foi aplicado (formato BR dd/MM/yyyy ...). Usado para exibir
   *  uma linha do desconto histórico na seção "Pagamentos realizados". */
  descontoData?: string;
}

/* ── Constants ── */
const METHODS = [
  { label: "Dinheiro", icon: Banknote, hue: "var(--status-success)" },
  { label: "Débito", icon: CreditCard, hue: "var(--accent)" },
  { label: "Crédito", icon: CreditCard, hue: "var(--status-purple)" },
  { label: "PIX", icon: QrCode, hue: "var(--status-teal)" },
] as const;

const isAdjustment = (tipo: string) => tipo === "Desconto" || tipo === "Acréscimo";

/* ── Helpers ── */
const parse = (v: string) => { const n = parseFloat(v.replace(",", ".")); return isNaN(n) ? 0 : n; };
const hsl = (token: string) => `hsl(${token})`;

const effectiveValor = (p: Pagamento, subtotal: number, exames: ExameInfoPagamento[]): number => {
  const raw = parse(p.valor);
  if (isAdjustment(p.tipo) && p.unidade === "PCT") {
    const base = (p.exameIdx != null ? exames[p.exameIdx]?.valor : subtotal) ?? 0;
    return Math.round(base * raw) / 100;
  }
  return raw;
};

/* ── Component ── */
const PagamentoDialog = ({
  open, onClose, itens = 0, subtotal = 0, desconto: descontoProp = 0,
  valorPago: valorPagoProp = 0, exames = [], onConfirm,
  pagamentosRealizados = [], onRemovePagamentoRealizado, isEditing = false,
  descontoData,
}: PagamentoDialogProps) => {
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [stagingValor, setStagingValor] = useState("");
  const [stagingData, setStagingData] = useState<Date>(new Date());
  const [stagingUnidade, setStagingUnidade] = useState<Unidade>("BRL");
  const [stagingExameIdx, setStagingExameIdx] = useState<number | null>(null);
  const [descontoHistRemovido, setDescontoHistRemovido] = useState(false);
  useBodyScrollLock(open);

  // Desconto histórico efetivo (zera quando o usuário remove o card).
  const descontoHistorico = descontoHistRemovido ? 0 : descontoProp;

  const resetStaging = () => {
    setStagingValor("");
    setStagingData(new Date());
    setStagingUnidade("BRL");
    setStagingExameIdx(null);
    setSelectedMethod(null);
  };

  const handleSelectMethod = (tipo: string) => {
    if (tipo === "Cortesia") {
      // Cortesia auto-aplica saldo restante
      const subtotalLocal = subtotal;
      const descAtual = pagamentos
        .filter(p => p.tipo === "Desconto" || p.tipo === "Cortesia")
        .reduce((s, p) => s + effectiveValor(p, subtotalLocal, exames), 0);
      const acreAtual = pagamentos
        .filter(p => p.tipo === "Acréscimo")
        .reduce((s, p) => s + effectiveValor(p, subtotalLocal, exames), 0);
      const pagoAtual = pagamentos
        .filter(p => !isAdjustment(p.tipo) && p.tipo !== "Cortesia")
        .reduce((s, p) => s + parse(p.valor), 0);
      const totalAjust = subtotalLocal - descontoProp - descAtual + acreAtual;
      const saldoAtual = Math.max(0, totalAjust - valorPagoProp - pagoAtual);
      if (saldoAtual <= 0) return;
      setPagamentos(p => [...p, {
        tipo: "Cortesia",
        valor: saldoAtual.toFixed(2).replace(".", ","),
        data: new Date(),
        unidade: "BRL",
      }]);
      return;
    }
    setSelectedMethod(prev => (prev === tipo ? null : tipo));
    setStagingValor("");
    setStagingData(new Date());
    setStagingUnidade("BRL");
    setStagingExameIdx(null);
  };

  const handleAddStaging = () => {
    if (!selectedMethod) return;
    const num = parse(stagingValor);
    if (num <= 0) return;
    const adj = isAdjustment(selectedMethod);
    setPagamentos(p => [...p, {
      tipo: selectedMethod,
      valor: stagingValor,
      data: stagingData,
      ...(adj ? { unidade: stagingUnidade, exameIdx: stagingExameIdx } : {}),
    }]);
    resetStaging();
  };

  const remove = (i: number) => setPagamentos(p => p.filter((_, idx) => idx !== i));


  const { totalPag, totalDesc, totalAcre } = useMemo(() => {
    let pag = 0, desc = 0, acre = 0;
    pagamentos.forEach(p => {
      const v = effectiveValor(p, subtotal, exames);
      if (p.tipo === "Desconto" || p.tipo === "Cortesia") desc += v;
      else if (p.tipo === "Acréscimo") acre += v;
      else pag += parse(p.valor);
    });
    return { totalPag: pag, totalDesc: desc, totalAcre: acre };
  }, [pagamentos, subtotal, exames]);

  const descontoTotal = descontoProp + totalDesc;
  const totalAjustado = subtotal - descontoTotal + totalAcre;
  const valorPagoTotal = valorPagoProp + totalPag;
  const saldo = totalAjustado - valorPagoTotal;
  const excedente = valorPagoTotal > totalAjustado && totalAjustado > 0;
  const quitado = saldo === 0 && !excedente;
  const pct = totalAjustado > 0 ? Math.min((valorPagoTotal / totalAjustado) * 100, 100) : 0;

  if (!open) return null;

  const confirm = () => {
    const novosPagamentos: PagamentoRealizado[] = pagamentos
      .filter(p => !isAdjustment(p.tipo) && p.tipo !== "Cortesia" && parse(p.valor) > 0)
      .map(p => ({ tipo: p.tipo, valor: parse(p.valor), data: format(p.data, "dd/MM/yyyy") }));
    onConfirm?.({ valorPago: valorPagoTotal, desconto: descontoTotal, novosPagamentos });
    if (quitado && totalAjustado > 0) fireSuccessConfetti();
    setPagamentos([]);
    onClose();
  };

  const methodColor = (tipo: string) => {
    if (tipo === "Cortesia") return hsl("var(--status-warning, var(--accent))");
    const m = METHODS.find(x => x.label === tipo);
    return m ? hsl(m.hue) : hsl("var(--primary)");
  };

  const hasExames = exames.length > 0;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">

      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-[3px]" onClick={onClose} />

      <div className="relative w-full max-w-[560px] max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] flex flex-col bg-card rounded-3xl border border-border shadow-[0_24px_80px_-12px_hsl(var(--foreground)/0.18)] overflow-hidden">

        {/* Header */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-5 sm:px-6 py-4 sm:py-5 bg-card border-b border-border/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold text-foreground tracking-tight truncate">Pagamento</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{itens} {itens === 1 ? "item" : "itens"}</p>
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all duration-200 shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scroll area */}
        <div className="flex-1 overflow-y-auto">
          {/* Summary */}
          <div className="px-5 sm:px-6 py-4 flex items-end justify-between gap-3 flex-wrap">
            <div className="flex gap-6">
              <div>
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Subtotal</span>
                <p className="text-sm font-semibold text-foreground mt-0.5">{fmtBRL(subtotal)}</p>
              </div>
              {descontoTotal > 0 && (
                <div>
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Desconto</span>
                  <p className="text-sm font-semibold mt-0.5" style={{ color: hsl("var(--status-success)") }}>−{fmtBRL(descontoTotal)}</p>
                </div>
              )}
              {totalAcre > 0 && (
                <div>
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Acréscimo</span>
                  <p className="text-sm font-semibold mt-0.5" style={{ color: hsl("var(--status-danger)") }}>+{fmtBRL(totalAcre)}</p>
                </div>
              )}
            </div>
            <div className="text-right">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Total</span>
              <p className="text-xl font-bold text-foreground tracking-tight mt-0.5">{fmtBRL(totalAjustado)}</p>
            </div>
          </div>

          {/* Progress */}
          <div className="px-5 sm:px-6 pb-4">
            <div className="rounded-2xl bg-card border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium text-muted-foreground">Progresso</span>
                <span className="text-xs font-semibold text-foreground">{fmtBRL(valorPagoTotal)} / {fmtBRL(totalAjustado)}</span>
              </div>
              <div className="h-2 rounded-full bg-border/50 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: excedente ? hsl("var(--status-danger)") : quitado ? hsl("var(--status-success)") : hsl("var(--primary)"),
                  }}
                />
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-muted-foreground">{pct.toFixed(0)}%</span>
                {quitado ? (
                  <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: hsl("var(--status-success)") }}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Quitado
                  </span>
                ) : excedente ? (
                  <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: hsl("var(--status-danger)") }}>
                    <AlertTriangle className="h-3.5 w-3.5" /> Excedente
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-muted-foreground">Saldo: {fmtBRL(saldo)}</span>
                )}
              </div>

              {excedente && (!isEditing || pagamentos.length > 0) && (
                <div className="mt-3 px-3 py-2.5 rounded-xl flex items-center gap-2" style={{ backgroundColor: `${hsl("var(--status-danger)")}08`, border: `1px solid ${hsl("var(--status-danger)")}20` }}>
                  <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: hsl("var(--status-danger)") }} />
                  <p className="text-xs font-medium" style={{ color: hsl("var(--status-danger)") }}>
                    Devolver <strong>{fmtBRL(valorPagoTotal - totalAjustado)}</strong> ao cliente
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="h-px bg-border/50" />

          {/* Lists */}
          <div className="px-5 sm:px-6 py-4 space-y-5">

            {/* Realized payments */}
            {(pagamentosRealizados.length > 0 || descontoProp > 0) && (
              <section>
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pagamentos realizados</h3>
                <div className="space-y-1.5">
                  {/* Linha de desconto histórico — exibida no topo quando houver. */}
                  {descontoProp > 0 && (
                    <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-card border border-border">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${hsl("var(--status-success)")}10` }}
                        >
                          <Percent className="h-3.5 w-3.5" style={{ color: hsl("var(--status-success)") }} />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[12px] font-medium text-foreground block leading-tight">Desconto</span>
                          {descontoData && (
                            <p className="text-[10px] text-muted-foreground leading-tight">{descontoData}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-[13px] font-semibold tabular-nums" style={{ color: hsl("var(--status-success)") }}>
                        − {fmtBRL(descontoProp)}
                      </span>
                    </div>
                  )}
                  {pagamentosRealizados.map((pr, i) => {
                    const meta = METHODS.find(m => m.label === pr.tipo);
                    const Icon = meta?.icon ?? Banknote;
                    return (
                      <div key={i} className="group flex items-center justify-between px-3 py-2 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${methodColor(pr.tipo)}10` }}>
                            <Icon className="h-3.5 w-3.5" style={{ color: methodColor(pr.tipo) }} />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[12px] font-medium text-foreground block leading-tight">{pr.tipo}</span>
                            <p className="text-[10px] text-muted-foreground leading-tight">{pr.data}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[13px] font-semibold tabular-nums" style={{ color: hsl("var(--status-success)") }}>{fmtBRL(pr.valor)}</span>
                          {onRemovePagamentoRealizado && (
                            <button onClick={() => onRemovePagamentoRealizado(i)} className="p-1 rounded-md hover:bg-destructive/10 transition-colors">
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Confirmed entries */}
            {pagamentos.length > 0 && (
              <section>
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pagamentos</h3>
                <div className="space-y-2">
                  {pagamentos.map((p, i) => {
                    const isDesc = p.tipo === "Desconto";
                    const isAcre = p.tipo === "Acréscimo";
                    const isCort = p.tipo === "Cortesia";
                    const color = isDesc || isCort ? hsl("var(--status-success)")
                      : isAcre ? hsl("var(--status-danger)")
                      : methodColor(p.tipo);
                    const meta = METHODS.find(m => m.label === p.tipo);
                    const Icon = isCort ? Gift : isDesc ? Percent : isAcre ? TrendingUp : meta?.icon ?? Banknote;
                    const eff = effectiveValor(p, subtotal, exames);
                    const sign = isDesc || isCort ? "−" : isAcre ? "+" : "";
                    const exameAlvo = (isDesc && p.exameIdx != null) ? exames[p.exameIdx]?.nome : null;
                    const detalheUnidade = (isDesc || isAcre) && p.unidade === "PCT" ? `${parse(p.valor)}%` : null;

                    return (
                      <div key={i} className="group flex items-center justify-between px-4 py-3 rounded-2xl bg-card border border-border hover:border-primary/40 hover:shadow-sm transition-all duration-200">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}10` }}>
                            <Icon className="h-4 w-4" style={{ color }} />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[13px] font-medium text-foreground truncate block">
                              {p.tipo}
                              {detalheUnidade && <span className="text-[11px] text-muted-foreground ml-1">({detalheUnidade})</span>}
                            </span>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {format(p.data, "dd/MM/yy")}
                              {exameAlvo && ` · ${exameAlvo}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm font-semibold tabular-nums" style={{ color }}>{sign}{fmtBRL(eff)}</span>
                          <button onClick={() => remove(i)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Staging row — visible when a method is selected */}
            {selectedMethod && selectedMethod !== "Cortesia" && (() => {
              const adj = isAdjustment(selectedMethod);
              const meta = METHODS.find(m => m.label === selectedMethod);
              const Icon = selectedMethod === "Desconto" ? Percent
                : selectedMethod === "Acréscimo" ? TrendingUp
                : meta?.icon ?? Banknote;
              const color = selectedMethod === "Desconto" ? hsl("var(--status-success)")
                : selectedMethod === "Acréscimo" ? hsl("var(--status-danger)")
                : methodColor(selectedMethod);
              const stagingNum = parse(stagingValor);
              const stagingEff = adj && stagingUnidade === "PCT"
                ? Math.round(((stagingExameIdx != null ? exames[stagingExameIdx]?.valor ?? 0 : subtotal) * stagingNum)) / 100
                : stagingNum;
              return (
                <div className="rounded-2xl bg-muted/20 border border-border/60 p-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}10` }}>
                      <Icon className="h-4 w-4" style={{ color }} />
                    </div>
                    <span className="text-[12px] font-semibold text-foreground w-16 shrink-0 truncate">{selectedMethod}</span>

                    <div className="flex items-center flex-1 min-w-0 h-9 rounded-xl border border-border bg-card overflow-hidden focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20 transition-all duration-200">
                      <span className="px-3 text-[11px] font-semibold text-foreground select-none">
                        {adj && stagingUnidade === "PCT" ? "%" : "R$"}
                      </span>
                      <input
                        type="text"
                        value={stagingValor}
                        onChange={e => setStagingValor(e.target.value.replace(/[^0-9,.]/g, ""))}
                        onKeyDown={e => { if (e.key === "Enter") handleAddStaging(); }}
                        placeholder={adj && stagingUnidade === "PCT" ? "0" : "0,00"}
                        autoFocus
                        className="flex-1 h-full bg-transparent text-sm font-semibold text-foreground focus:outline-none placeholder:text-muted-foreground/40"
                      />
                      {adj && stagingUnidade === "PCT" && stagingEff > 0 && (
                        <span className="px-2 text-[10px] tabular-nums text-muted-foreground">≈ {fmtBRL(stagingEff)}</span>
                      )}
                    </div>

                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="h-9 px-3 rounded-xl border border-border bg-card flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all duration-200 shrink-0">
                          <CalendarIcon className="h-3.5 w-3.5" />
                          <span>{format(stagingData, "dd/MM/yy")}</span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={stagingData} onSelect={d => d && setStagingData(d)} initialFocus className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>

                    <button
                      onClick={handleAddStaging}
                      disabled={stagingNum <= 0}
                      className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                      aria-label="Adicionar pagamento"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Adjustment options */}
                  {adj && (
                    <div className="flex flex-wrap items-center gap-2 pl-11">
                      <div className="inline-flex h-7 rounded-lg border border-border overflow-hidden">
                        <button
                          onClick={() => setStagingUnidade("BRL")}
                          className={`px-2.5 text-[11px] font-semibold transition-colors ${stagingUnidade === "BRL" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
                        >R$</button>
                        <button
                          onClick={() => setStagingUnidade("PCT")}
                          className={`px-2.5 text-[11px] font-semibold transition-colors border-l border-border ${stagingUnidade === "PCT" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
                        >%</button>
                      </div>

                      {hasExames && stagingUnidade === "PCT" && selectedMethod === "Desconto" && (
                        <Select
                          value={stagingExameIdx == null ? "__total__" : String(stagingExameIdx)}
                          onValueChange={(v) => setStagingExameIdx(v === "__total__" ? null : Number(v))}
                        >
                          <SelectTrigger className="h-7 text-[11px] rounded-lg border-border w-[220px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__total__">Aplicar no Total</SelectItem>
                            {exames.map((e, idx) => (
                              <SelectItem key={idx} value={String(idx)}>
                                {e.nome} ({fmtBRL(e.valor)})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Method selector */}
            <section>
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Forma de pagamento</h3>
              <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
                {[
                  { label: "Desconto", icon: Percent, hue: "var(--status-success)" },
                  { label: "Acréscimo", icon: TrendingUp, hue: "var(--status-danger)" },
                  { label: "Cortesia", icon: Gift, hue: "var(--status-success)" },
                  ...METHODS,
                ].map(m => {
                  const isSelected = selectedMethod === m.label;
                  return (
                    <button
                      key={m.label}
                      onClick={() => handleSelectMethod(m.label)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all duration-200 ${
                        isSelected
                          ? "border-primary bg-primary/10 shadow-sm"
                          : "border-border bg-card hover:border-primary/40 hover:shadow-sm"
                      }`}
                    >
                      <m.icon className="h-4 w-4" style={{ color: hsl(m.hue) }} />
                      <span className={`text-[10px] font-semibold ${isSelected ? "text-primary" : "text-muted-foreground"}`}>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </div>


        <div className="h-px bg-border/50" />

        {/* Footer */}
        <div className="sticky bottom-0 z-20 px-5 sm:px-6 py-4 flex items-center gap-3 bg-card border-t border-border/50">
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-2xl border border-border bg-card flex items-center justify-center gap-2 text-[13px] font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all duration-200"
          >
            <QrCode className="h-4 w-4 text-primary" />
            Gerar QRCode
          </button>
          <button
            onClick={confirm}
            className="flex-1 h-11 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center gap-2 text-[13px] font-semibold hover:opacity-90 transition-all duration-200 shadow-sm"
          >
            <Receipt className="h-4 w-4" />
            {pagamentosRealizados.length > 0 ? "Atualizar" : "Confirmar"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );

};

export default PagamentoDialog;
