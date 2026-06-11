import { useState, useMemo } from "react";
import { X, Trash2, Banknote, CreditCard, QrCode, CalendarIcon, TrendingUp, TrendingDown, CheckCircle2, AlertTriangle, Receipt, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { fireSuccessConfetti } from "@/lib/confetti";
import type { PagamentoRealizado } from "@/data/types";

import { fmtBRL } from "@/lib/utils";
/* ── Types ── */
interface Pagamento {
  tipo: string;
  valor: string;
  data: Date;
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
  onConfirm?: (resultado: { valorPago: number; desconto: number; novosPagamentos: PagamentoRealizado[] }) => void;
  pagamentosRealizados?: PagamentoRealizado[];
  onRemovePagamentoRealizado?: (index: number) => void;
  isEditing?: boolean;
}

/* ── Constants ── */
const METHODS = [
  { label: "Dinheiro", icon: Banknote, hue: "var(--status-success)" },
  { label: "Débito", icon: CreditCard, hue: "var(--accent)" },
  { label: "Crédito", icon: CreditCard, hue: "var(--status-purple)" },
  { label: "PIX", icon: QrCode, hue: "var(--status-teal)" },
] as const;

/* ── Helpers ── */
const parse = (v: string) => { const n = parseFloat(v.replace(",", ".")); return isNaN(n) ? 0 : n; };
const hsl = (token: string) => `hsl(${token})`;

/* ── Component ── */
const PagamentoDialog = ({
  open, onClose, itens = 0, subtotal = 0, desconto: descontoProp = 0,
  valorPago: valorPagoProp = 0, onConfirm,
  pagamentosRealizados = [], onRemovePagamentoRealizado, isEditing = false,
}: PagamentoDialogProps) => {
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  useBodyScrollLock(open);

  const add = (tipo: string) => setPagamentos(p => [...p, { tipo, valor: "", data: new Date() }]);
  const remove = (i: number) => setPagamentos(p => p.filter((_, idx) => idx !== i));
  const setVal = (i: number, v: string) => setPagamentos(p => p.map((x, idx) => idx === i ? { ...x, valor: v.replace(/[^0-9,]/g, "") } : x));
  const setDate = (i: number, d: Date | undefined) => { if (d) setPagamentos(p => p.map((x, idx) => idx === i ? { ...x, data: d } : x)); };

  const { totalPag, totalDesc, totalAcre } = useMemo(() => {
    let pag = 0, desc = 0, acre = 0;
    pagamentos.forEach(p => { const v = parse(p.valor); if (p.tipo === "Desconto") desc += v; else if (p.tipo === "Acréscimo") acre += v; else pag += v; });
    return { totalPag: pag, totalDesc: desc, totalAcre: acre };
  }, [pagamentos]);

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
      .filter(p => p.tipo !== "Desconto" && p.tipo !== "Acréscimo" && parse(p.valor) > 0)
      .map(p => ({ tipo: p.tipo, valor: parse(p.valor), data: format(p.data, "dd/MM/yyyy") }));
    onConfirm?.({ valorPago: valorPagoTotal, desconto: descontoTotal, novosPagamentos });
    if (quitado && totalAjustado > 0) fireSuccessConfetti();
    setPagamentos([]);
    onClose();
  };

  const methodColor = (tipo: string) => {
    const m = METHODS.find(x => x.label === tipo);
    return m ? hsl(m.hue) : hsl("var(--primary)");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Overlay */}
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-[3px]" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-[520px] max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] flex flex-col bg-card rounded-3xl border border-border shadow-[0_24px_80px_-12px_hsl(var(--foreground)/0.18)] overflow-hidden">

        {/* ─── Sticky Header ─── */}
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

        {/* ─── Single scrollable area ─── */}
        <div className="flex-1 overflow-y-auto">
          {/* Summary Row */}
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

          {/* Lists + Add Section */}
          <div className="px-5 sm:px-6 py-4 space-y-5">

          {/* Realized payments */}
          {pagamentosRealizados.length > 0 && (
            <section>
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pagamentos realizados</h3>
              <div className="space-y-2">
                {pagamentosRealizados.map((pr, i) => {
                  const meta = METHODS.find(m => m.label === pr.tipo);
                  const Icon = meta?.icon ?? Banknote;
                  return (
                    <div key={i} className="group flex items-center justify-between px-4 py-3 rounded-2xl bg-card border border-border hover:border-primary/40 hover:shadow-sm transition-all duration-200">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${methodColor(pr.tipo)}10` }}>
                          <Icon className="h-4 w-4" style={{ color: methodColor(pr.tipo) }} />
                        </div>
                        <div>
                          <span className="text-[13px] font-medium text-foreground">{pr.tipo}</span>
                          <p className="text-[11px] text-muted-foreground">{pr.data}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold" style={{ color: hsl("var(--status-success)") }}>{fmtBRL(pr.valor)}</span>
                        {onRemovePagamentoRealizado && (
                          <button onClick={() => onRemovePagamentoRealizado(i)} className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-all duration-200">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* New entries */}
          {pagamentos.length > 0 && (
            <section>
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Novos lançamentos</h3>
              <div className="space-y-2">
                {pagamentos.map((p, i) => {
                  const isDesc = p.tipo === "Desconto";
                  const isAcre = p.tipo === "Acréscimo";
                  const color = isDesc ? hsl("var(--status-success)") : isAcre ? hsl("var(--status-danger)") : methodColor(p.tipo);
                  const meta = METHODS.find(m => m.label === p.tipo);
                  const Icon = isDesc ? TrendingDown : isAcre ? TrendingUp : meta?.icon ?? Banknote;

                  return (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card border border-border hover:border-primary/40 transition-all duration-200">
                      <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}10` }}>
                        <Icon className="h-4 w-4" style={{ color }} />
                      </div>
                      <span className="text-[12px] font-semibold text-foreground w-16 shrink-0 truncate">{p.tipo}</span>

                      {/* Value input */}
                      <div className="flex items-center flex-1 min-w-0 h-9 rounded-xl border border-border bg-card overflow-hidden focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20 transition-all duration-200">
                        <span className="px-3 text-[11px] font-medium text-muted-foreground">R$</span>
                        <input
                          type="text"
                          value={p.valor}
                          onChange={e => setVal(i, e.target.value)}
                          placeholder="0,00"
                          className="flex-1 h-full bg-transparent text-sm font-semibold text-foreground focus:outline-none placeholder:text-muted-foreground/40"
                        />
                      </div>

                      {/* Date picker */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="h-9 px-3 rounded-xl border border-border bg-card flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all duration-200 shrink-0">
                            <CalendarIcon className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">{format(p.data, "dd/MM/yy")}</span>
                            <span className="sm:hidden">{format(p.data, "dd/MM")}</span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={p.data} onSelect={d => setDate(i, d)} initialFocus className="p-3 pointer-events-auto" />
                        </PopoverContent>
                      </Popover>

                      <button onClick={() => remove(i)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200 shrink-0">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ─── Add Payment Grid ─── */}
          <section>
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Adicionar</h3>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {/* Desconto */}
              <button
                onClick={() => add("Desconto")}
                className="flex flex-col items-center gap-1.5 p-3 rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all duration-200"
              >
                <TrendingDown className="h-4 w-4" style={{ color: hsl("var(--status-success)") }} />
                <span className="text-[10px] font-semibold text-muted-foreground">Desconto</span>
              </button>
              {/* Acréscimo */}
              <button
                onClick={() => add("Acréscimo")}
                className="flex flex-col items-center gap-1.5 p-3 rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all duration-200"
              >
                <TrendingUp className="h-4 w-4" style={{ color: hsl("var(--status-danger)") }} />
                <span className="text-[10px] font-semibold text-muted-foreground">Acréscimo</span>
              </button>
              {/* Methods */}
              {METHODS.map(m => (
                <button
                  key={m.label}
                  onClick={() => add(m.label)}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all duration-200"
                >
                  <m.icon className="h-4 w-4" style={{ color: hsl(m.hue) }} />
                  <span className="text-[10px] font-semibold text-muted-foreground">{m.label}</span>
                </button>
              ))}
            </div>
          </section>
          </div>
        </div>

        <div className="h-px bg-border/50" />

        {/* ─── Footer ─── */}
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
    </div>
  );
};

export default PagamentoDialog;
