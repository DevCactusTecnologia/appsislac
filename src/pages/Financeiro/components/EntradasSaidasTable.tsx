// Tabela compartilhada por Entradas e Saídas (Fase 4 — Passo 3).
// JSX preservado literalmente de Financeiro.tsx (linhas 944-1196).
// Consome estado/handlers via FinanceiroContext.
import { Pencil, Trash2, Eye, Receipt, ChevronLeft, ChevronRight } from "lucide-react";
import { cn, fmtBRL } from "@/lib/utils";
import { parseDate } from "../helpers";
import { useFinanceiroContext } from "../FinanceiroContext";

export default function EntradasSaidasTable() {
  const {
    activeTab, paginatedData, filteredLength, totalPages, currentPage, setCurrentPage, itemsPerPage,
    saidasSelecionadas,
    handleEditClick, handleDeleteClick, handleDetailClick,
    setFaturaDetalheAlvo, setFaturaDetalheOpen,
  } = useFinanceiroContext();

  return (
    <div className="rounded-3xl border border-border/60 bg-card overflow-hidden">
      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/40 bg-muted/20">
              {activeTab === "saida" ? (
                <>
                  <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Protocolo</th>
                  <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Descrição</th>
                  <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vencimento</th>
                  <th className="text-center px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-center px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
                </>
              ) : (
                <>
                  <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Protocolo</th>
                  <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cliente</th>
                  <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recebimento</th>
                  <th className="text-center px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-center px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-16 text-sm text-muted-foreground">Nenhum registro encontrado</td></tr>
            ) : paginatedData.map((entry, idx) => {
              const today = new Date(); today.setHours(0, 0, 0, 0);
              const venc = entry.dataVencimento ? parseDate(entry.dataVencimento) : null;
              const paga = entry.foiPago === "Sim";
              const vencida = !paga && venc !== null && venc < today;
              const diasVenc = venc ? Math.round((venc.getTime() - today.getTime()) / 86400000) : null;
              const vencendo = !paga && diasVenc !== null && diasVenc >= 0 && diasVenc <= 7;
              const sel = saidasSelecionadas.has(entry.protocolo);
              const statusEntrada = entry.statusPagamento || (entry.tipo === "entrada" ? "Pago" : "");
              const entradaPago = statusEntrada === "Pago" || statusEntrada === "Pagamento efetuado";
              const entradaParcial = statusEntrada === "Parcial" || statusEntrada === "Pagamento parcial";
              return (
                <tr key={idx} className={cn("border-b border-border/20 last:border-0 hover:bg-muted/15 transition-colors group", sel && "bg-primary/5")}>
                  {activeTab === "saida" ? (
                    <>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-semibold text-foreground tabular-nums">{entry.protocolo}</span>
                          <span className="text-[11px] text-muted-foreground tabular-nums">{entry.data}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-foreground max-w-[260px]">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium text-foreground">{entry.tipoDespesa || "—"}</span>
                          {(entry.descricao || entry.cliente) && (
                            <span className="text-[11px] text-muted-foreground truncate">
                              {entry.descricao || entry.cliente}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-bold text-destructive tabular-nums">- {fmtBRL(entry.valorTotal)}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-muted-foreground">{entry.dataVencimento || "—"}</span>
                            {vencida && diasVenc !== null && (
                              <span className="text-[11px] font-semibold text-destructive">há {Math.abs(diasVenc)}d</span>
                            )}
                            {vencendo && diasVenc !== null && (
                              <span className="text-[11px] font-semibold text-amber-600">em {diasVenc}d</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleDetailClick(entry)}
                          className={cn(
                            "text-xs font-semibold px-3 py-1 rounded-full transition-all hover:ring-2 hover:ring-offset-1 hover:ring-offset-background cursor-pointer",
                            paga ? "bg-status-success/10 text-status-success hover:ring-status-success/30"
                              : vencida ? "bg-destructive/10 text-destructive hover:ring-destructive/30"
                              : vencendo ? "bg-amber-500/10 text-amber-700 hover:ring-amber-500/30"
                              : "bg-muted/60 text-muted-foreground hover:ring-border",
                          )}
                          title="Ver detalhes"
                        >
                          {paga ? "Pago" : vencida ? "Vencida" : vencendo ? "Vence em breve" : "Pendente"}
                        </button>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleEditClick(entry)} className="p-2 rounded-xl hover:bg-muted transition-colors"><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></button>
                          <button onClick={() => handleDeleteClick(entry.protocolo)} className="p-2 rounded-xl hover:bg-destructive/10 transition-colors"><Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" /></button>
                          <button onClick={() => handleDetailClick(entry)} className="p-2 rounded-xl hover:bg-muted transition-colors"><Eye className="h-3.5 w-3.5 text-muted-foreground" /></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-semibold text-foreground tabular-nums flex items-center gap-1.5">
                            {entry.protocolo}
                            {entry.origem === "fatura_convenio" && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-bold uppercase tracking-wider">Fatura</span>
                            )}
                          </span>
                          <span className="text-[11px] text-muted-foreground tabular-nums">{entry.data}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-foreground max-w-[260px]">
                        <div className="flex flex-col gap-0.5">
                          {entry.origem === "fatura_convenio" ? (
                            <>
                              <span className="text-sm font-medium text-foreground truncate">{entry.convenio || entry.cliente}</span>
                              <span className="text-[11px] text-muted-foreground truncate">Pagamento agregado de fatura</span>
                            </>
                          ) : (
                            <>
                              <span className="text-sm font-medium text-foreground truncate">{entry.cliente}</span>
                              {entry.convenio && (
                                <span className="text-[11px] text-muted-foreground truncate">{entry.convenio}</span>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-bold text-status-success tabular-nums">+ {fmtBRL(entry.valorTotal)}</span>
                          <span className="text-[11px] text-muted-foreground">{entry.pagamento || "—"}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleDetailClick(entry)}
                          className={cn(
                            "text-xs font-semibold px-3 py-1 rounded-full transition-all hover:ring-2 hover:ring-offset-1 hover:ring-offset-background cursor-pointer",
                            entradaPago ? "bg-status-success/10 text-status-success hover:ring-status-success/30"
                              : entradaParcial ? "bg-amber-500/10 text-amber-700 hover:ring-amber-500/30"
                              : "bg-muted/60 text-muted-foreground hover:ring-border",
                          )}
                          title="Ver detalhes"
                        >
                          {entradaPago ? "Pago" : entradaParcial ? "Parcial" : (statusEntrada || "Pendente")}
                        </button>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                          {entry.origem === "fatura_convenio" && entry.faturaId ? (
                            <button
                              onClick={() => {
                                setFaturaDetalheAlvo({
                                  id: entry.faturaId!,
                                  codigo: entry.protocolo,
                                  convenio: entry.convenio || entry.cliente,
                                  total: entry.valorTotal,
                                });
                                setFaturaDetalheOpen(true);
                              }}
                              className="px-2.5 py-1 rounded-xl hover:bg-muted transition-colors text-[11px] font-medium text-primary flex items-center gap-1"
                              title="Ver atendimentos da fatura"
                            >
                              <Receipt className="h-3.5 w-3.5" />
                              Ver itens
                            </button>
                          ) : (
                            <button onClick={() => handleDetailClick(entry)} className="p-2 rounded-xl hover:bg-muted transition-colors"><Eye className="h-3.5 w-3.5 text-muted-foreground" /></button>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="md:hidden divide-y divide-border/30">
        {paginatedData.length === 0 ? (
          <div className="p-16 text-center text-sm text-muted-foreground">Nenhum registro encontrado</div>
        ) : paginatedData.map((entry, idx) => {
          const today = new Date(); today.setHours(0, 0, 0, 0);
          const venc = entry.dataVencimento ? parseDate(entry.dataVencimento) : null;
          const paga = entry.foiPago === "Sim";
          const vencida = !paga && venc !== null && venc < today;
          const diasVenc = venc ? Math.round((venc.getTime() - today.getTime()) / 86400000) : null;
          const vencendo = !paga && diasVenc !== null && diasVenc >= 0 && diasVenc <= 7;
          const sel = saidasSelecionadas.has(entry.protocolo);
          return (
            <div key={idx} className={cn("p-4 space-y-3", sel && "bg-primary/5")}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{activeTab === "saida" ? (entry.descricao || entry.cliente) : entry.cliente}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">{entry.protocolo} · {entry.data}</p>
                </div>
                <p className={cn("text-sm font-bold shrink-0 tabular-nums", entry.tipo === "saida" ? "text-destructive" : "text-status-success")}>
                  {entry.tipo === "saida" ? "- " : "+ "}{fmtBRL(entry.valorTotal)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground font-medium">{entry.pagamento}</span>
                {activeTab === "saida" && entry.tipoDespesa && <span className="text-[11px] px-2 py-0.5 rounded-md bg-accent/60 text-accent-foreground font-medium">{entry.tipoDespesa}</span>}
                {activeTab === "saida" && (
                  <button
                    type="button"
                    onClick={() => handleDetailClick(entry)}
                    className={cn(
                      "text-[11px] px-2 py-0.5 rounded-md font-semibold transition-all hover:opacity-80",
                      paga ? "bg-status-success/10 text-status-success"
                        : vencida ? "bg-destructive/10 text-destructive"
                        : vencendo ? "bg-amber-500/10 text-amber-700"
                        : "bg-muted/60 text-muted-foreground",
                    )}
                  >
                    {paga ? "Pago" : vencida && diasVenc !== null ? `Vencida há ${Math.abs(diasVenc)}d` : vencendo && diasVenc !== null ? `Vence em ${diasVenc}d` : "Pendente"}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-border/20">
                {activeTab === "saida" && (
                  <>
                    <button onClick={() => handleEditClick(entry)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"><Pencil className="h-3.5 w-3.5" />Editar</button>
                    <button onClick={() => handleDeleteClick(entry.protocolo)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="h-3.5 w-3.5" />Excluir</button>
                  </>
                )}
                <button onClick={() => handleDetailClick(entry)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"><Eye className="h-3.5 w-3.5" />Detalhes</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-4 border-t border-border/30">
          <span className="text-xs text-muted-foreground">{((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, filteredLength)} de {filteredLength}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-xl hover:bg-muted transition-colors disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(page => (
              <button key={page} onClick={() => setCurrentPage(page)} className={cn("h-8 w-8 rounded-xl text-xs font-semibold transition-all", currentPage === page ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>{page}</button>
            ))}
            {totalPages > 5 && <span className="text-xs text-muted-foreground px-1">…</span>}
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-xl hover:bg-muted transition-colors disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}
