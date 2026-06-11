// CaixaTab — JSX da aba "Livro Caixa" extraído de Financeiro.tsx
// (Architectural Split Program — Fase 3 / Parte 2).
// Sem mudança de comportamento: recebe state já derivado como props.

import { CircleDollarSign, Printer, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { cn, fmtBRL } from "@/lib/utils";
import type { CaixaLinhaComSaldo } from "../types";

interface CaixaTotais {
  totalEntradas: number;
  totalSaidas: number;
  saldoFinal: number;
}

interface CaixaTabProps {
  caixaTotais: CaixaTotais;
  caixaSaldoInicial: number;
  caixaPaginated: CaixaLinhaComSaldo[];
  caixaLinhasComSaldo: CaixaLinhaComSaldo[];
  caixaTotalPages: number;
  currentPage: number;
  setCurrentPage: (updater: (p: number) => number) => void;
  setCurrentPageDirect: (page: number) => void;
  dateFrom: Date | undefined;
  itemsPerPage: number;
  imprimirLivroCaixa: () => void;
}

export default function CaixaTab({
  caixaTotais,
  caixaSaldoInicial,
  caixaPaginated,
  caixaLinhasComSaldo,
  caixaTotalPages,
  currentPage,
  setCurrentPage,
  setCurrentPageDirect,
  dateFrom,
  itemsPerPage,
  imprimirLivroCaixa,
}: CaixaTabProps) {
  return (
    <div className="space-y-6">
      {/* Resumo + ação imprimir */}
      <div className="rounded-3xl border border-border/60 bg-card p-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/8 flex items-center justify-center">
              <CircleDollarSign className="h-6 w-6 text-primary" />
            </div>
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Saldo do período</span>
              <p className={cn("text-2xl font-bold", caixaTotais.saldoFinal >= 0 ? "text-foreground" : "text-destructive")}>{fmtBRL(caixaTotais.saldoFinal)}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 w-full lg:w-auto">
            <div className="px-4 py-3 rounded-2xl border border-border/60 bg-muted/30">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Saldo inicial</p>
              <p className="text-sm font-bold text-foreground tabular-nums">{fmtBRL(caixaSaldoInicial)}</p>
            </div>
            <div className="px-4 py-3 rounded-2xl border border-border/60 bg-status-success/5">
              <p className="text-[10px] font-semibold text-status-success uppercase tracking-wider">Entradas</p>
              <p className="text-sm font-bold text-foreground tabular-nums">+ {fmtBRL(caixaTotais.totalEntradas)}</p>
            </div>
            <div className="px-4 py-3 rounded-2xl border border-border/60 bg-destructive/5">
              <p className="text-[10px] font-semibold text-destructive uppercase tracking-wider">Saídas</p>
              <p className="text-sm font-bold text-foreground tabular-nums">- {fmtBRL(caixaTotais.totalSaidas)}</p>
            </div>
          </div>
          <Button onClick={imprimirLivroCaixa} disabled={caixaLinhasComSaldo.length === 0} className="rounded-2xl h-11 gap-2 px-6">
            <Printer className="h-4 w-4" />Imprimir
          </Button>
        </div>
      </div>

      {/* Tabela cronológica */}
      <div className="rounded-3xl border border-border/60 bg-card overflow-hidden">
        {/* Desktop */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/40 bg-muted/20">
                <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Protocolo</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Descrição</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pagamento</th>
                <th className="text-right px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Entrada</th>
                <th className="text-right px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Saída</th>
                <th className="text-right px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {dateFrom && currentPage === 1 && (
                <tr className="border-b border-border/30 bg-muted/15">
                  <td className="px-5 py-3 text-xs text-muted-foreground" colSpan={5}>
                    Saldo inicial em {format(dateFrom, "dd/MM/yyyy")}
                  </td>
                  <td className="px-5 py-3 text-sm text-right font-bold text-foreground tabular-nums">{fmtBRL(caixaSaldoInicial)}</td>
                </tr>
              )}
              {caixaPaginated.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-16 text-sm text-muted-foreground">Nenhuma movimentação no período</td></tr>
              ) : caixaPaginated.map((m, idx) => (
                <tr key={idx} className="border-b border-border/20 last:border-0 hover:bg-muted/15 transition-colors">
                  <td className="px-5 py-3 text-foreground tabular-nums whitespace-nowrap align-top">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold text-foreground tabular-nums">{m.protocolo}</span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">{m.data}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-foreground max-w-[280px] align-top">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium truncate">{m.descricao}</span>
                      <span className="text-[11px] text-muted-foreground">{m.categoria}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-[11px] text-muted-foreground align-top">{m.pagamento}</td>
                  <td className="px-5 py-3 text-sm text-right font-bold tabular-nums text-status-success align-top">{m.tipo === "entrada" ? `+ ${fmtBRL(m.valor)}` : "—"}</td>
                  <td className="px-5 py-3 text-sm text-right font-bold tabular-nums text-destructive align-top">{m.tipo === "saida" ? `- ${fmtBRL(m.valor)}` : "—"}</td>
                  <td className={cn("px-5 py-3 text-sm text-right font-extrabold tabular-nums align-top", m.saldoAcumulado >= 0 ? "text-foreground" : "text-destructive")}>{fmtBRL(m.saldoAcumulado)}</td>
                </tr>
              ))}
            </tbody>
            {caixaLinhasComSaldo.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border/60 bg-muted/30">
                  <td colSpan={3} className="px-5 py-4 text-sm font-bold text-foreground text-right">Totais do período</td>
                  <td className="px-5 py-4 text-sm text-right font-bold text-status-success tabular-nums">+ {fmtBRL(caixaTotais.totalEntradas)}</td>
                  <td className="px-5 py-4 text-sm text-right font-bold text-destructive tabular-nums">- {fmtBRL(caixaTotais.totalSaidas)}</td>
                  <td className={cn("px-5 py-4 text-sm text-right font-extrabold tabular-nums", caixaTotais.saldoFinal >= 0 ? "text-foreground" : "text-destructive")}>{fmtBRL(caixaTotais.saldoFinal)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Mobile */}
        <div className="md:hidden divide-y divide-border/30">
          {caixaPaginated.length === 0 ? (
            <div className="p-16 text-center text-sm text-muted-foreground">Nenhuma movimentação no período</div>
          ) : caixaPaginated.map((m, idx) => (
            <div key={idx} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{m.descricao}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">{m.protocolo} · {m.data}</p>
                </div>
                <p className={cn("text-sm font-bold shrink-0 tabular-nums", m.tipo === "entrada" ? "text-status-success" : "text-destructive")}>
                  {m.tipo === "entrada" ? "+" : "-"} {fmtBRL(m.valor)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground font-medium">{m.categoria}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-muted/40 text-muted-foreground">{m.pagamento}</span>
                <span className="ml-auto text-[11px] text-muted-foreground">Saldo: <span className={cn("font-bold tabular-nums", m.saldoAcumulado >= 0 ? "text-foreground" : "text-destructive")}>{fmtBRL(m.saldoAcumulado)}</span></span>
              </div>
            </div>
          ))}
        </div>

        {/* Paginação */}
        {caixaTotalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-border/30">
            <span className="text-xs text-muted-foreground">{((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, caixaLinhasComSaldo.length)} de {caixaLinhasComSaldo.length}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-xl hover:bg-muted transition-colors disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
              {Array.from({ length: Math.min(caixaTotalPages, 5) }, (_, i) => i + 1).map(page => (
                <button key={page} onClick={() => setCurrentPageDirect(page)} className={cn("h-8 w-8 rounded-xl text-xs font-semibold transition-all", currentPage === page ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>{page}</button>
              ))}
              {caixaTotalPages > 5 && <span className="text-xs text-muted-foreground px-1">…</span>}
              <button onClick={() => setCurrentPage(p => Math.min(caixaTotalPages, p + 1))} disabled={currentPage === caixaTotalPages} className="p-2 rounded-xl hover:bg-muted transition-colors disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
