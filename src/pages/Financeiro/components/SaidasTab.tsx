// SaidasTab — Fase 6 V2 (Despesas enxutas).
//
// Filosofia: olhou, entendeu, usou.
//   • Filtro por status: Todas · Aberta · Paga · Cancelada (chips).
//   • Tabela enxuta: Descrição · Categoria · Forma · Vencimento · Valor · Status (+ ações).
//   • Sem cards de resumo (Painel cobre o macro), sem busca textual extra,
//     sem filtros adicionais.
//   • Status oficial: aberta | paga | cancelada (vindo de financeiro_saidas.status).
import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, CheckCircle2, XCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { cn, fmtBRL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useFinanceiroContext } from "../FinanceiroContext";
import { getSaidas, updateSaida } from "@/data/financeiroStore";
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

function StatusPill({ status, vencida }: { status: "aberta" | "paga" | "cancelada"; vencida: boolean }) {
  if (status === "paga") {
    return <span className="inline-flex items-center px-2.5 h-7 rounded-full border text-[11px] font-medium bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900">Paga</span>;
  }
  if (status === "cancelada") {
    return <span className="inline-flex items-center px-2.5 h-7 rounded-full border text-[11px] font-medium bg-muted text-muted-foreground border-border">Cancelada</span>;
  }
  // aberta
  if (vencida) {
    return <span className="inline-flex items-center px-2.5 h-7 rounded-full border text-[11px] font-medium bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900">Vencida</span>;
  }
  return <span className="inline-flex items-center px-2.5 h-7 rounded-full border text-[11px] font-medium bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900">Aberta</span>;
}

export default function SaidasTab() {
  const {
    handleEditClick, handleDeleteClick,
    tiposDespesa, formasPagamento, destinosPagamento,
    currentPage, setCurrentPage, itemsPerPage,
  } = useFinanceiroContext();

  const [filter, setFilter] = useState<StatusFilter>("todas");
  const [novaOpen, setNovaOpen] = useState(false);

  const todas = useMemo(() => getSaidas().map(saidaToEntry), []);
  // O store atualiza por subscribe; mas para simplicidade usamos um tick local
  // disparado por re-mount do dialog. (Os outros tabs também leem do store.)

  const filtered = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
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
      await updateSaida(entry.protocolo, {
        status: "paga",
        foiPago: "Sim",
        dataPagamento: hojeBR,
      });
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
    <div className="space-y-4">
      {/* ─── Header: chips + nova despesa ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-2xl border border-border/30 w-fit">
          {FILTROS.map(f => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => { setFilter(f.key); setCurrentPage(1); }}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/60",
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        <Button onClick={() => setNovaOpen(true)} className="rounded-2xl h-10 gap-2 text-xs font-semibold px-5">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nova despesa</span>
          <span className="sm:hidden">Adicionar</span>
        </Button>
      </div>

      {/* ─── Tabela ─── */}
      <div className="rounded-3xl border border-border/60 bg-card overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/40 bg-muted/20">
                <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Descrição</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Categoria</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Forma</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vencimento</th>
                <th className="text-right px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Valor</th>
                <th className="text-center px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-center px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[140px]"></th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-16 text-sm text-muted-foreground">Nenhuma despesa encontrada</td></tr>
              ) : paginated.map(entry => {
                const status = (entry.statusSaida ?? (entry.foiPago === "Sim" ? "paga" : "aberta")) as "aberta" | "paga" | "cancelada";
                const today = new Date(); today.setHours(0, 0, 0, 0);
                const venc = entry.dataVencimento ? parseDate(entry.dataVencimento) : null;
                const vencida = status === "aberta" && venc !== null && venc < today;
                return (
                  <tr key={entry.protocolo} className="border-b border-border/20 last:border-0 hover:bg-muted/15 transition-colors group">
                    <td className="px-5 py-4 max-w-[280px]">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-foreground truncate">{entry.descricao || entry.cliente || "—"}</span>
                        <span className="text-[11px] text-muted-foreground tabular-nums">{entry.protocolo}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-muted-foreground">{entry.tipoDespesa || "—"}</td>
                    <td className="px-5 py-4 text-sm text-muted-foreground">{entry.pagamento || "—"}</td>
                    <td className="px-5 py-4 text-sm text-foreground tabular-nums">{entry.dataVencimento || "—"}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-foreground tabular-nums text-right">
                      {fmtBRL(entry.valorTotal)}
                    </td>
                    <td className="px-5 py-4 text-center"><StatusPill status={status} vencida={vencida} /></td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {status === "aberta" && (
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Marcar como paga"
                            onClick={() => marcarPaga(entry)}>
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          </Button>
                        )}
                        {status === "aberta" && (
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Cancelar despesa"
                            onClick={() => cancelar(entry)}>
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Editar"
                          onClick={() => handleEditClick(entry)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Excluir"
                          onClick={() => handleDeleteClick(entry.protocolo)}>
                          <Trash2 className="h-4 w-4 text-rose-600" />
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
            <div className="p-16 text-center text-sm text-muted-foreground">Nenhuma despesa encontrada</div>
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
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      {entry.tipoDespesa || "—"} · venc {entry.dataVencimento || "—"}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-foreground shrink-0 tabular-nums">{fmtBRL(entry.valorTotal)}</p>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <StatusPill status={status} vencida={vencida} />
                  <div className="flex items-center gap-1">
                    {status === "aberta" && (
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => marcarPaga(entry)}>
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      </Button>
                    )}
                    {status === "aberta" && (
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => cancelar(entry)}>
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleEditClick(entry)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Paginação */}
        {filtered.length > itemsPerPage && (
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-border/40 bg-muted/10">
            <span className="text-xs text-muted-foreground tabular-nums">
              {start + 1}–{end} de {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" className="h-8 w-8 p-0 rounded-lg"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground px-2 tabular-nums">{currentPage} / {totalPages}</span>
              <Button size="sm" variant="outline" className="h-8 w-8 p-0 rounded-lg"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage >= totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Nova despesa */}
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
