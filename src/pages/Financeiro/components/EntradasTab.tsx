// EntradasTab — Fase 4 V2 (Recebimentos enxutos).
//
// Filosofia: olhou, entendeu, usou.
//   • 4 chips de período: Hoje, Semana, Mês, Período (custom).
//   • Tabela enxuta: Data · Paciente · Protocolo · Forma · Valor · Status.
//   • Sem cards de resumo (Painel cobre isso), sem busca, sem filtros extras,
//     sem botão "Nova entrada" (recebimentos são lançados via Atendimento).
//
// Read-only: a aba Entradas reflete `financeiro_entradas` (view derivada de
// `atendimento_pagamentos`). Edição acontece sempre no Atendimento.
import { Eye, Undo2, ChevronLeft, ChevronRight } from "lucide-react";
import { cn, fmtBRL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useFinanceiroContext } from "../FinanceiroContext";

const PERIODOS: Array<{ key: string; label: string }> = [
  { key: "hoje",   label: "Hoje" },
  { key: "7d",     label: "Semana" },
  { key: "mes",    label: "Mês" },
  { key: "custom", label: "Período" },
];

function statusTone(status: string): { label: string; cls: string } {
  const s = (status || "").toLowerCase();
  if (s.includes("parcial")) {
    return { label: "Parcial", cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900" };
  }
  if (s.includes("pago") || s.includes("efetuado") || s === "") {
    return { label: "Pago", cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900" };
  }
  return { label: status, cls: "bg-muted text-foreground border-border" };
}

export default function EntradasTab() {
  const {
    paginatedData, filteredLength, totalPages, currentPage, setCurrentPage, itemsPerPage,
    handleDetailClick, handleDeleteClick,
    periodoRapido, aplicarPeriodoRapido,
  } = useFinanceiroContext();

  const start = (currentPage - 1) * itemsPerPage;
  const end = start + paginatedData.length;

  return (
    <div className="space-y-4">
      {/* ─── Filtros (apenas período) ─── */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-muted/40 rounded-2xl border border-border/30 w-fit">
        {PERIODOS.map(p => {
          const active = periodoRapido === p.key;
          return (
            <button
              key={p.key}
              onClick={() => aplicarPeriodoRapido(p.key)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/60",
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* ─── Tabela enxuta ─── */}
      <div className="rounded-3xl border border-border/60 bg-card overflow-hidden">
        {/* Desktop */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/40 bg-muted/20">
                <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Paciente</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Protocolo</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Forma</th>
                <th className="text-right px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Valor</th>
                <th className="text-center px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-center px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[110px]"></th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-sm text-muted-foreground">
                    Nenhum recebimento no período
                  </td>
                </tr>
              ) : paginatedData.map((entry) => {
                const tone = statusTone(entry.statusPagamento || "Pago");
                return (
                  <tr
                    key={entry.protocolo + entry.data}
                    className="border-b border-border/20 last:border-0 hover:bg-muted/15 transition-colors group cursor-pointer"
                    onClick={() => handleDetailClick(entry)}
                  >
                    <td className="px-5 py-4 text-sm text-foreground tabular-nums">{entry.data}</td>
                    <td className="px-5 py-4 text-sm text-foreground max-w-[280px] truncate">{entry.cliente || "—"}</td>
                    <td className="px-5 py-4 text-sm font-medium text-foreground tabular-nums">{entry.protocolo}</td>
                    <td className="px-5 py-4 text-sm text-muted-foreground">{entry.pagamento || "—"}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-foreground tabular-nums text-right">
                      {fmtBRL(entry.valorTotal)}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={cn("inline-flex items-center px-2.5 h-7 rounded-full border text-[11px] font-medium", tone.cls)}>
                        {tone.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={(e) => { e.stopPropagation(); handleDetailClick(entry); }}
                          title="Ver detalhes"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={(e) => { e.stopPropagation(); handleDeleteClick(entry); }}
                          title="Estornar"
                        >
                          <Undo2 className="h-4 w-4 text-amber-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile */}
        <div className="md:hidden divide-y divide-border/30">
          {paginatedData.length === 0 ? (
            <div className="text-center py-16 text-sm text-muted-foreground">
              Nenhum recebimento no período
            </div>
          ) : paginatedData.map((entry) => {
            const tone = statusTone(entry.statusPagamento || "Pago");
            return (
              <button
                key={entry.protocolo + entry.data}
                onClick={() => handleDetailClick(entry)}
                className="w-full text-left px-4 py-3 hover:bg-muted/15 transition-colors"
              >
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="text-sm font-semibold text-foreground tabular-nums">{entry.protocolo}</span>
                  <span className={cn("inline-flex items-center px-2 h-6 rounded-full border text-[10px] font-medium", tone.cls)}>
                    {tone.label}
                  </span>
                </div>
                <div className="text-sm text-foreground truncate">{entry.cliente || "—"}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {entry.data} · {entry.pagamento || "—"}
                  </span>
                  <span className="text-sm font-semibold text-foreground tabular-nums">
                    {fmtBRL(entry.valorTotal)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Paginação */}
        {filteredLength > itemsPerPage && (
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-border/40 bg-muted/10">
            <span className="text-xs text-muted-foreground tabular-nums">
              {start + 1}–{end} de {filteredLength}
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="sm" variant="outline"
                className="h-8 w-8 p-0 rounded-lg"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground px-2 tabular-nums">
                {currentPage} / {totalPages}
              </span>
              <Button
                size="sm" variant="outline"
                className="h-8 w-8 p-0 rounded-lg"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
