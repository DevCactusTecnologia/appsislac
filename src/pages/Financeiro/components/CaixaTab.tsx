// CaixaTab — V3 (refinado, compacto, design system unificado).
//
// Resumo em grid uniforme de 4 cards (saldo, inicial, entradas, saídas) +
// tabela cronológica densa com zebra leve.

import { CircleDollarSign, Printer, ChevronLeft, ChevronRight, ArrowDownCircle, ArrowUpCircle, Wallet } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { cn, fmtBRL } from "@/lib/utils";
import { useFinanceiroContext } from "../FinanceiroContext";

const TH = "text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em]";

function ResumoCard({
  label, value, Icon, tone, dim,
}: {
  label: string; value: string; Icon: typeof Wallet;
  tone: "primary" | "positive" | "negative" | "neutral";
  dim?: boolean;
}) {
  const dotCls = {
    primary:  "bg-primary",
    positive: "bg-emerald-500",
    negative: "bg-rose-500",
    neutral:  "bg-muted-foreground/40",
  }[tone];
  const valueCls = {
    primary:  "text-foreground",
    positive: "text-foreground",
    negative: "text-rose-600 dark:text-rose-400",
    neutral:  "text-foreground",
  }[tone];
  return (
    <div className={cn("rounded-xl border border-border/50 bg-card p-4 flex flex-col gap-2", dim && "bg-muted/20")}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("h-1.5 w-1.5 rounded-full", dotCls)} />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        </div>
        <Icon className="h-4 w-4 text-muted-foreground/70" strokeWidth={1.75} />
      </div>
      <div className={cn("text-[20px] font-semibold tabular-nums leading-tight", valueCls)}>{value}</div>
    </div>
  );
}

export default function CaixaTab() {
  const {
    caixaTotais,
    caixaSaldoInicial,
    caixaPaginated,
    caixaLinhasComSaldo,
    caixaTotalPages,
    currentPage,
    setCurrentPage,
    dateFrom,
    itemsPerPage,
    imprimirLivroCaixa,
  } = useFinanceiroContext();

  return (
    <div className="space-y-3">
      {/* Resumo em grid uniforme */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <ResumoCard
          label="Saldo do período"
          value={fmtBRL(caixaTotais.saldoFinal)}
          Icon={CircleDollarSign}
          tone={caixaTotais.saldoFinal >= 0 ? "primary" : "negative"}
        />
        <ResumoCard label="Saldo inicial"  value={fmtBRL(caixaSaldoInicial)}        Icon={Wallet}          tone="neutral"  dim />
        <ResumoCard label="Entradas"       value={`+ ${fmtBRL(caixaTotais.totalEntradas)}`} Icon={ArrowDownCircle} tone="positive" />
        <ResumoCard label="Saídas"         value={`- ${fmtBRL(caixaTotais.totalSaidas)}`}   Icon={ArrowUpCircle}   tone="negative" />
      </div>

      <div className="flex items-center justify-end">
        <Button onClick={imprimirLivroCaixa} disabled={caixaLinhasComSaldo.length === 0} size="sm" className="rounded-lg h-8 gap-1.5 text-xs px-3">
          <Printer className="h-3.5 w-3.5" /> Imprimir
        </Button>
      </div>

      {/* Tabela cronológica */}
      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/40 bg-muted/15">
                <th className={TH}>Protocolo</th>
                <th className={TH}>Descrição</th>
                <th className={TH}>Pagamento</th>
                <th className={cn(TH, "text-right")}>Entrada</th>
                <th className={cn(TH, "text-right")}>Saída</th>
                <th className={cn(TH, "text-right")}>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {dateFrom && currentPage === 1 && (
                <tr className="border-b border-border/20 bg-muted/[0.06]">
                  <td className="px-4 py-2 text-[11px] text-muted-foreground" colSpan={5}>
                    Saldo inicial em {format(dateFrom, "dd/MM/yyyy")}
                  </td>
                  <td className="px-4 py-2 text-[13px] text-right font-semibold text-foreground tabular-nums">{fmtBRL(caixaSaldoInicial)}</td>
                </tr>
              )}
              {caixaPaginated.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-14 text-sm text-muted-foreground">Nenhuma movimentação no período</td></tr>
              ) : caixaPaginated.map((m, idx) => (
                <tr key={idx} className="border-b border-border/15 last:border-0 even:bg-muted/[0.04] hover:bg-primary/[0.04] transition-colors">
                  <td className="px-4 py-2.5 tabular-nums whitespace-nowrap align-top">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[13px] font-medium text-foreground tabular-nums">{m.protocolo}</span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">{m.data}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 max-w-[260px] align-top">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[13px] text-foreground truncate">{m.descricao}</span>
                      <span className="text-[11px] text-muted-foreground">{m.categoria}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-[11px] text-muted-foreground align-top">{m.pagamento}</td>
                  <td className="px-4 py-2.5 text-[13px] text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400 align-top">{m.tipo === "entrada" ? `+ ${fmtBRL(m.valor)}` : "—"}</td>
                  <td className="px-4 py-2.5 text-[13px] text-right font-semibold tabular-nums text-rose-600 dark:text-rose-400 align-top">{m.tipo === "saida" ? `- ${fmtBRL(m.valor)}` : "—"}</td>
                  <td className={cn("px-4 py-2.5 text-[13px] text-right font-bold tabular-nums align-top", m.saldoAcumulado >= 0 ? "text-foreground" : "text-rose-600 dark:text-rose-400")}>{fmtBRL(m.saldoAcumulado)}</td>
                </tr>
              ))}
            </tbody>
            {caixaLinhasComSaldo.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border/50 bg-muted/[0.08]">
                  <td colSpan={3} className="px-4 py-3 text-[12px] font-semibold text-foreground text-right">Totais do período</td>
                  <td className="px-4 py-3 text-[13px] text-right font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">+ {fmtBRL(caixaTotais.totalEntradas)}</td>
                  <td className="px-4 py-3 text-[13px] text-right font-bold text-rose-600 dark:text-rose-400 tabular-nums">- {fmtBRL(caixaTotais.totalSaidas)}</td>
                  <td className={cn("px-4 py-3 text-[13px] text-right font-extrabold tabular-nums", caixaTotais.saldoFinal >= 0 ? "text-foreground" : "text-rose-600 dark:text-rose-400")}>{fmtBRL(caixaTotais.saldoFinal)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Mobile */}
        <div className="md:hidden divide-y divide-border/30">
          {caixaPaginated.length === 0 ? (
            <div className="p-14 text-center text-sm text-muted-foreground">Nenhuma movimentação no período</div>
          ) : caixaPaginated.map((m, idx) => (
            <div key={idx} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{m.descricao}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">{m.protocolo} · {m.data}</p>
                </div>
                <p className={cn("text-sm font-bold shrink-0 tabular-nums", m.tipo === "entrada" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                  {m.tipo === "entrada" ? "+" : "-"} {fmtBRL(m.valor)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground font-medium">{m.categoria}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-muted/40 text-muted-foreground">{m.pagamento}</span>
                <span className="ml-auto text-[11px] text-muted-foreground">Saldo: <span className={cn("font-bold tabular-nums", m.saldoAcumulado >= 0 ? "text-foreground" : "text-rose-600 dark:text-rose-400")}>{fmtBRL(m.saldoAcumulado)}</span></span>
              </div>
            </div>
          ))}
        </div>

        {caixaTotalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/40 bg-muted/[0.06]">
            <span className="text-[11px] text-muted-foreground tabular-nums">{((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, caixaLinhasComSaldo.length)} de {caixaLinhasComSaldo.length}</span>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" className="h-7 w-7 p-0 rounded-md"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              {Array.from({ length: Math.min(caixaTotalPages, 5) }, (_, i) => i + 1).map(page => (
                <button key={page} onClick={() => setCurrentPage(page)}
                  className={cn("h-7 w-7 rounded-md text-[11px] font-semibold transition-all",
                    currentPage === page ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
                  {page}
                </button>
              ))}
              {caixaTotalPages > 5 && <span className="text-[11px] text-muted-foreground px-1">…</span>}
              <Button size="sm" variant="outline" className="h-7 w-7 p-0 rounded-md"
                onClick={() => setCurrentPage(p => Math.min(caixaTotalPages, p + 1))} disabled={currentPage === caixaTotalPages}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
