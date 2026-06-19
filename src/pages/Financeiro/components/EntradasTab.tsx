// EntradasTab — V3 (refinado, compacto, design system unificado).
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

const TH = "text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em]";

function statusTone(status: string): { label: string; cls: string; dot: string } {
  const s = (status || "").toLowerCase();
  if (s.includes("parcial")) {
    return { label: "Parcial", dot: "bg-amber-500", cls: "bg-amber-50 text-amber-700 border-amber-200/70 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900" };
  }
  if (s.includes("pago") || s.includes("efetuado") || s === "") {
    return { label: "Pago", dot: "bg-emerald-500", cls: "bg-emerald-50 text-emerald-700 border-emerald-200/70 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900" };
  }
  return { label: status, dot: "bg-muted-foreground", cls: "bg-muted text-foreground border-border" };
}

function StatusBadge({ tone }: { tone: ReturnType<typeof statusTone> }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 h-6 rounded-md border text-[11px] font-medium", tone.cls)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
      {tone.label}
    </span>
  );
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
    <div className="space-y-3">
      {/* Chips de período (minimalistas) */}
      <div className="inline-flex items-center gap-0.5 p-1 bg-muted/40 rounded-lg border border-border/40">
        {PERIODOS.map(p => {
          const active = periodoRapido === p.key;
          return (
            <button
              key={p.key}
              onClick={() => aplicarPeriodoRapido(p.key)}
              className={cn(
                "px-3 h-7 rounded-md text-xs font-medium transition-all whitespace-nowrap",
                active
                  ? "bg-background text-foreground shadow-sm border border-border/60"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Tabela */}
      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/40 bg-muted/15">
                <th className={TH}>Data</th>
                <th className={TH}>Paciente</th>
                <th className={TH}>Protocolo</th>
                <th className={TH}>Forma</th>
                <th className={cn(TH, "text-right")}>Valor</th>
                <th className={cn(TH, "text-center")}>Status</th>
                <th className={cn(TH, "text-center w-[100px]")}></th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-14 text-sm text-muted-foreground">Nenhum recebimento no período</td></tr>
              ) : paginatedData.map((entry) => {
                const tone = statusTone(entry.statusPagamento || "Pago");
                return (
                  <tr
                    key={entry.protocolo + entry.data}
                    className="border-b border-border/15 last:border-0 even:bg-muted/[0.04] hover:bg-primary/[0.04] transition-colors group cursor-pointer"
                    onClick={() => handleDetailClick(entry)}
                  >
                    <td className="px-4 py-2.5 text-[13px] text-foreground tabular-nums whitespace-nowrap">{entry.data}</td>
                    <td className="px-4 py-2.5 text-[13px] text-foreground max-w-[260px] truncate">{entry.cliente || "—"}</td>
                    <td className="px-4 py-2.5 text-[13px] font-medium text-foreground tabular-nums">{entry.protocolo}</td>
                    <td className="px-4 py-2.5 text-[13px] text-muted-foreground">{entry.pagamento || "—"}</td>
                    <td className="px-4 py-2.5 text-[13px] font-semibold text-foreground tabular-nums text-right">
                      {fmtBRL(entry.valorTotal)}
                    </td>
                    <td className="px-4 py-2.5 text-center"><StatusBadge tone={tone} /></td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                          onClick={(e) => { e.stopPropagation(); handleDetailClick(entry); }}
                          title="Ver detalhes">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                          onClick={(e) => { e.stopPropagation(); handleDeleteClick(entry); }}
                          title="Estornar">
                          <Undo2 className="h-3.5 w-3.5 text-amber-600" />
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
            <div className="text-center py-14 text-sm text-muted-foreground">Nenhum recebimento no período</div>
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
                  <StatusBadge tone={tone} />
                </div>
                <div className="text-sm text-foreground truncate">{entry.cliente || "—"}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-muted-foreground tabular-nums">{entry.data} · {entry.pagamento || "—"}</span>
                  <span className="text-sm font-semibold text-foreground tabular-nums">{fmtBRL(entry.valorTotal)}</span>
                </div>
              </button>
            );
          })}
        </div>

        {filteredLength > itemsPerPage && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-border/40 bg-muted/[0.06]">
            <span className="text-[11px] text-muted-foreground tabular-nums">{start + 1}–{end} de {filteredLength}</span>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" className="h-7 w-7 p-0 rounded-md"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-[11px] text-muted-foreground px-2 tabular-nums">{currentPage} / {totalPages}</span>
              <Button size="sm" variant="outline" className="h-7 w-7 p-0 rounded-md"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage >= totalPages}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
