// AReceberTab — Fase 7 (slim, pacientes-only).
//
// Filosofia: olhou, entendeu, usou.
//   • A aba "A Receber" agora trata exclusivamente de saldos de PACIENTES.
//   • Convênios ganharam área dedicada em ./ConveniosTab.
//   • Estrutura: Quem · Quanto · Desde · Status · ação "Receber".
import { Wallet, ChevronLeft, ChevronRight } from "lucide-react";
import { cn, fmtBRL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useFinanceiroContext } from "../FinanceiroContext";

const COL_HEADER =
  "text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider";

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
    parcial:  { label: "Parcial",  cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900" },
    pendente: { label: "Pendente", cls: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900" },
  }[kind];
  return (
    <span className={cn("inline-flex items-center px-2.5 h-7 rounded-full border text-[11px] font-medium", map.cls)}>
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
    <div className="space-y-4">
      <div className="rounded-3xl border border-border/60 bg-card overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/40 bg-muted/20">
                <th className={COL_HEADER}>Quem</th>
                <th className={COL_HEADER + " text-right"}>Quanto</th>
                <th className={COL_HEADER}>Desde</th>
                <th className={COL_HEADER + " text-center"}>Status</th>
                <th className={COL_HEADER + " text-center w-[120px]"}></th>
              </tr>
            </thead>
            <tbody>
              {aReceberPaginated.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-16 text-sm text-muted-foreground">Nenhum paciente com saldo em aberto</td></tr>
              ) : aReceberPaginated.map((row) => {
                const dias = diasDesde(row.data);
                return (
                  <tr key={row.protocolo} className="border-b border-border/20 last:border-0 hover:bg-muted/15 transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-0.5 max-w-[280px]">
                        <span className="text-sm font-medium text-foreground truncate">{row.cliente}</span>
                        <span className="text-[11px] text-muted-foreground tabular-nums truncate">
                          {row.protocolo}{row.atendimento.convenio !== "Particular" ? ` · ${row.convenio}` : ""}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex flex-col gap-0.5 items-end">
                        <span className="text-sm font-semibold text-foreground tabular-nums">{fmtBRL(row.saldo)}</span>
                        <span className="text-[11px] text-muted-foreground tabular-nums">de {fmtBRL(row.valorTotal)}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-foreground tabular-nums">
                      <div className="flex flex-col gap-0.5">
                        <span>{formatBR(row.data)}</span>
                        {dias !== null && (
                          <span className="text-[11px] text-muted-foreground">
                            {dias === 0 ? "Hoje" : `há ${dias} dia${dias === 1 ? "" : "s"}`}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <StatusPill kind={row.status} />
                    </td>
                    <td className="px-5 py-4 text-center">
                      <Button size="sm" onClick={() => handleAReceberPagar(row)} className="rounded-xl h-8 text-xs gap-1.5">
                        <Wallet className="h-3.5 w-3.5" />
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
            <div className="p-16 text-center text-sm text-muted-foreground">Nenhum paciente com saldo em aberto</div>
          ) : aReceberPaginated.map((row) => (
            <div key={row.protocolo} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{row.cliente}</p>
                  <p className="text-[11px] text-muted-foreground tabular-nums truncate">
                    {row.protocolo} · {formatBR(row.data)}
                  </p>
                </div>
                <p className="text-sm font-semibold text-foreground shrink-0 tabular-nums">{fmtBRL(row.saldo)}</p>
              </div>
              <div className="flex items-center justify-between gap-2">
                <StatusPill kind={row.status} />
                <Button size="sm" onClick={() => handleAReceberPagar(row)} className="rounded-xl h-8 text-xs gap-1.5">
                  <Wallet className="h-3.5 w-3.5" />
                  Receber
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Paginação */}
        {aReceberTotalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border/40 bg-muted/10">
            <span className="text-xs text-muted-foreground tabular-nums">
              {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, aReceberFilteredLength)} de {aReceberFilteredLength}
            </span>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" className="h-8 w-8 p-0 rounded-lg"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground px-2 tabular-nums">{currentPage} / {aReceberTotalPages}</span>
              <Button size="sm" variant="outline" className="h-8 w-8 p-0 rounded-lg"
                onClick={() => setCurrentPage(p => Math.min(aReceberTotalPages, p + 1))} disabled={currentPage >= aReceberTotalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
