// AReceberTab — V3 (refinado, compacto, design system unificado).
import { Wallet, ChevronLeft, ChevronRight } from "lucide-react";
import { cn, fmtBRL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useFinanceiroContext } from "../FinanceiroContext";

const TH = "text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em]";

function formatBR(d: string | null | undefined): string {
  if (!d) return "—";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) return d;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("pt-BR");
}

function diasDesde(d: string | null | undefined): number | null {
  if (!d) return null;
  let dt: Date;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) {
    const [dd, mm, yyyy] = d.split("/").map(Number);
    dt = new Date(yyyy, mm - 1, dd);
  } else {
    dt = new Date(d);
  }
  if (Number.isNaN(dt.getTime())) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  dt.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((today.getTime() - dt.getTime()) / 86_400_000));
}

function StatusPill({ kind }: { kind: "parcial" | "pendente" }) {
  const map = {
    parcial:  { label: "Parcial",  dot: "bg-amber-500", cls: "bg-amber-50 text-amber-700 border-amber-200/70 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900" },
    pendente: { label: "Pendente", dot: "bg-rose-500",  cls: "bg-rose-50 text-rose-700 border-rose-200/70 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900" },
  }[kind];
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 h-6 rounded-md border text-[11px] font-medium", map.cls)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", map.dot)} />
      {map.label}
    </span>
  );
}

export default function AReceberTab() {
  const {
    aReceberPaginated,
    aReceberFilteredLength, aReceberTotalPages,
    currentPage, setCurrentPage, itemsPerPage,
    handleAReceberPagar,
  } = useFinanceiroContext();

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/40 bg-muted/15">
                <th className={TH}>Quem</th>
                <th className={cn(TH, "text-right")}>Quanto</th>
                <th className={TH}>Desde</th>
                <th className={cn(TH, "text-center")}>Status</th>
                <th className={cn(TH, "text-center w-[110px]")}></th>
              </tr>
            </thead>
            <tbody>
              {aReceberPaginated.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-14 text-sm text-muted-foreground">Nenhum paciente com saldo em aberto</td></tr>
              ) : aReceberPaginated.map((row) => {
                const dias = diasDesde(row.data);
                return (
                  <tr key={row.protocolo} className="border-b border-border/15 last:border-0 even:bg-muted/[0.04] hover:bg-primary/[0.04] transition-colors group">
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col gap-0.5 max-w-[280px]">
                        <span className="text-[13px] font-medium text-foreground truncate">{row.cliente}</span>
                        <span className="text-[11px] text-muted-foreground tabular-nums truncate">
                          {row.protocolo}{row.atendimento.convenio !== "Particular" ? ` · ${row.convenio}` : ""}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex flex-col gap-0.5 items-end">
                        <span className="text-[13px] font-semibold text-foreground tabular-nums">{fmtBRL(row.saldo)}</span>
                        <span className="text-[11px] text-muted-foreground tabular-nums">de {fmtBRL(row.valorTotal)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-foreground tabular-nums">
                      <div className="flex flex-col gap-0.5">
                        <span>{formatBR(row.data)}</span>
                        {dias !== null && (
                          <span className="text-[11px] text-muted-foreground">
                            {dias === 0 ? "Hoje" : `há ${dias} dia${dias === 1 ? "" : "s"}`}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center"><StatusPill kind={row.status} /></td>
                    <td className="px-4 py-2.5 text-center">
                      <Button size="sm" onClick={() => handleAReceberPagar(row)} className="rounded-md h-7 text-[11px] gap-1.5 px-3">
                        <Wallet className="h-3 w-3" />
                        Receber
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile */}
        <div className="md:hidden divide-y divide-border/30">
          {aReceberPaginated.length === 0 ? (
            <div className="p-14 text-center text-sm text-muted-foreground">Nenhum paciente com saldo em aberto</div>
          ) : aReceberPaginated.map((row) => (
            <div key={row.protocolo} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{row.cliente}</p>
                  <p className="text-[11px] text-muted-foreground tabular-nums truncate">{row.protocolo} · {formatBR(row.data)}</p>
                </div>
                <p className="text-sm font-semibold text-foreground shrink-0 tabular-nums">{fmtBRL(row.saldo)}</p>
              </div>
              <div className="flex items-center justify-between gap-2">
                <StatusPill kind={row.status} />
                <Button size="sm" onClick={() => handleAReceberPagar(row)} className="rounded-md h-7 text-[11px] gap-1.5 px-3">
                  <Wallet className="h-3 w-3" /> Receber
                </Button>
              </div>
            </div>
          ))}
        </div>

        {aReceberTotalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/40 bg-muted/[0.06]">
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, aReceberFilteredLength)} de {aReceberFilteredLength}
            </span>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" className="h-7 w-7 p-0 rounded-md"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-[11px] text-muted-foreground px-2 tabular-nums">{currentPage} / {aReceberTotalPages}</span>
              <Button size="sm" variant="outline" className="h-7 w-7 p-0 rounded-md"
                onClick={() => setCurrentPage(p => Math.min(aReceberTotalPages, p + 1))} disabled={currentPage >= aReceberTotalPages}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
