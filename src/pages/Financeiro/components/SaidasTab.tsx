// SaidasTab — V3 (refinado, compacto, design system unificado).
import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Undo2, CheckCircle2, XCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { cn, fmtBRL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useFinanceiroContext } from "../FinanceiroContext";
import { getSaidas, updateSaida, subscribeFinanceiro } from "@/data/financeiroStore";
import type { FinanceiroEntry } from "../types";
import { saidaToEntry, parseDate } from "../helpers";
import NovaDespesaDialog from "./dialogs/NovaDespesaDialog";
import { toast } from "@/hooks/use-toast";

type StatusFilter = "todas" | "aberta" | "paga" | "cancelada";

const FILTROS: Array<{ key: StatusFilter; label: string }> = [
  { key: "todas",     label: "Todas" },
  { key: "aberta",    label: "Aberta" },
  { key: "paga",      label: "Paga" },
  { key: "cancelada", label: "Cancelada" },
];

const TH = "text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em]";

function StatusPill({ status, vencida }: { status: "aberta" | "paga" | "cancelada"; vencida: boolean }) {
  const cfg = (() => {
    if (status === "paga")      return { label: "Paga",      dot: "bg-emerald-500", cls: "bg-emerald-50 text-emerald-700 border-emerald-200/70 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900" };
    if (status === "cancelada") return { label: "Cancelada", dot: "bg-muted-foreground/50", cls: "bg-muted text-muted-foreground border-border" };
    if (vencida)                return { label: "Vencida",   dot: "bg-rose-500",    cls: "bg-rose-50 text-rose-700 border-rose-200/70 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900" };
    return                              { label: "Aberta",   dot: "bg-amber-500",   cls: "bg-amber-50 text-amber-700 border-amber-200/70 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900" };
  })();
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 h-6 rounded-md border text-[11px] font-medium", cfg.cls)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

export default function SaidasTab() {
  const {
    handleEditClick, handleDeleteClick,
    tiposDespesa, formasPagamento, destinosPagamento,
    currentPage, setCurrentPage, itemsPerPage,
  } = useFinanceiroContext();

  const [filter, setFilter] = useState<StatusFilter>("todas");
  const [novaOpen, setNovaOpen] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => subscribeFinanceiro(() => setTick(t => t + 1)), []);

  const todas = useMemo(() => getSaidas().map(saidaToEntry), [tick]);

  const filtered = useMemo(() => {
    return todas.filter(e => {
      const status = (e.statusSaida ?? (e.foiPago === "Sim" ? "paga" : "aberta")) as "aberta" | "paga" | "cancelada";
      if (filter !== "todas" && status !== filter) return false;
      return true;
    });
  }, [todas, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const start = (currentPage - 1) * itemsPerPage;
  const end = start + paginated.length;

  const marcarPaga = async (entry: FinanceiroEntry) => {
    try {
      const hojeBR = new Date().toLocaleDateString("pt-BR");
      await updateSaida(entry.protocolo, { status: "paga", foiPago: "Sim", dataPagamento: hojeBR });
      toast({ title: "Despesa marcada como paga" });
    } catch (e) {
      toast({ title: "Falha ao atualizar", description: (e as Error)?.message, variant: "destructive" });
    }
  };

  const cancelar = async (entry: FinanceiroEntry) => {
    try {
      await updateSaida(entry.protocolo, { status: "cancelada", foiPago: "Não" });
      toast({ title: "Despesa cancelada" });
    } catch (e) {
      toast({ title: "Falha ao cancelar", description: (e as Error)?.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-0.5 p-1 bg-muted/40 rounded-lg border border-border/40">
          {FILTROS.map(f => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => { setFilter(f.key); setCurrentPage(1); }}
                className={cn(
                  "px-3 h-7 rounded-md text-xs font-medium transition-all whitespace-nowrap",
                  active
                    ? "bg-background text-foreground shadow-sm border border-border/60"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        <Button onClick={() => setNovaOpen(true)} size="sm" className="rounded-lg h-8 gap-1.5 text-xs font-medium px-3">
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Nova despesa</span>
          <span className="sm:hidden">Adicionar</span>
        </Button>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/40 bg-muted/15">
                <th className={TH}>Descrição</th>
                <th className={TH}>Categoria</th>
                <th className={TH}>Forma</th>
                <th className={TH}>Vencimento</th>
                <th className={cn(TH, "text-right")}>Valor</th>
                <th className={cn(TH, "text-center")}>Status</th>
                <th className={cn(TH, "text-center w-[130px]")}></th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-14 text-sm text-muted-foreground">Nenhuma despesa encontrada</td></tr>
              ) : paginated.map(entry => {
                const status = (entry.statusSaida ?? (entry.foiPago === "Sim" ? "paga" : "aberta")) as "aberta" | "paga" | "cancelada";
                const today = new Date(); today.setHours(0, 0, 0, 0);
                const venc = entry.dataVencimento ? parseDate(entry.dataVencimento) : null;
                const vencida = status === "aberta" && venc !== null && venc < today;
                return (
                  <tr key={entry.protocolo} className="border-b border-border/15 last:border-0 even:bg-muted/[0.04] hover:bg-primary/[0.04] transition-colors group">
                    <td className="px-4 py-2.5 max-w-[260px]">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[13px] font-medium text-foreground truncate">{entry.descricao || entry.cliente || "—"}</span>
                        <span className="text-[11px] text-muted-foreground tabular-nums">{entry.protocolo}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-muted-foreground">{entry.tipoDespesa || "—"}</td>
                    <td className="px-4 py-2.5 text-[13px] text-muted-foreground">{entry.pagamento || "—"}</td>
                    <td className="px-4 py-2.5 text-[13px] text-foreground tabular-nums">{entry.dataVencimento || "—"}</td>
                    <td className="px-4 py-2.5 text-[13px] font-semibold text-foreground tabular-nums text-right">{fmtBRL(entry.valorTotal)}</td>
                    <td className="px-4 py-2.5 text-center"><StatusPill status={status} vencida={vencida} /></td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {status === "aberta" && (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Marcar como paga" onClick={() => marcarPaga(entry)}>
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          </Button>
                        )}
                        {status === "aberta" && (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Cancelar" onClick={() => cancelar(entry)}>
                            <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Editar" onClick={() => handleEditClick(entry)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Estornar" onClick={() => handleDeleteClick(entry)}>
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
          {paginated.length === 0 ? (
            <div className="p-14 text-center text-sm text-muted-foreground">Nenhuma despesa encontrada</div>
          ) : paginated.map(entry => {
            const status = (entry.statusSaida ?? (entry.foiPago === "Sim" ? "paga" : "aberta")) as "aberta" | "paga" | "cancelada";
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const venc = entry.dataVencimento ? parseDate(entry.dataVencimento) : null;
            const vencida = status === "aberta" && venc !== null && venc < today;
            return (
              <div key={entry.protocolo} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{entry.descricao || entry.cliente || "—"}</p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">{entry.tipoDespesa || "—"} · venc {entry.dataVencimento || "—"}</p>
                  </div>
                  <p className="text-sm font-semibold text-foreground shrink-0 tabular-nums">{fmtBRL(entry.valorTotal)}</p>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <StatusPill status={status} vencida={vencida} />
                  <div className="flex items-center gap-0.5">
                    {status === "aberta" && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => marcarPaga(entry)}>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      </Button>
                    )}
                    {status === "aberta" && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => cancelar(entry)}>
                        <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleEditClick(entry)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length > itemsPerPage && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-border/40 bg-muted/[0.06]">
            <span className="text-[11px] text-muted-foreground tabular-nums">{start + 1}–{end} de {filtered.length}</span>
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

      {novaOpen && (
        <NovaDespesaDialog
          open={novaOpen}
          onClose={() => setNovaOpen(false)}
          tiposDespesa={tiposDespesa}
          formasPagamento={formasPagamento}
          destinosPagamento={destinosPagamento}
        />
      )}
    </div>
  );
}
