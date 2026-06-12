// AReceberTab — cards de status + filtros + sub-abas + tabelas (pacientes/convênios).
// Fase 4 — Passo 4. JSX extraído de Financeiro.tsx preservado literalmente.
// Consome estado/handlers via FinanceiroContext.
import {
  Search, AlertOctagon, Clock, CircleDollarSign, Wallet, Receipt,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { cn, fmtBRL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import SearchableSelect from "@/components/financeiro/SearchableSelect";
import { useFinanceiroContext } from "../FinanceiroContext";

export default function AReceberTab() {
  const {
    aReceberCounts,
    aReceberStatusFilter, setAReceberStatusFilter,
    aReceberSubTab, setAReceberSubTab,
    aReceberSource, aReceberConvenioRows, aReceberPaginated,
    aReceberFilteredLength, aReceberTotalPages,
    currentPage, setCurrentPage, itemsPerPage,
    searchQuery, setSearchQuery,
    convenioFilter, setConvenioFilter, conveniosDisponiveis,
    handleAReceberPagar,
    setFecharFaturaAlvo, setFecharFaturaOpen,
  } = useFinanceiroContext();

  return (
    <>
      {/* ─── Cards de status (A Receber) ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {([
          { key: "todas", label: "Total a receber", count: aReceberCounts.todas, value: aReceberCounts.totalGeral, icon: CircleDollarSign, tone: "neutral" },
          { key: "parciais", label: "Parciais", count: aReceberCounts.parciais, value: aReceberCounts.totalParciais, icon: Clock, tone: "warn" },
          { key: "pendentes", label: "Pendentes", count: aReceberCounts.pendentes, value: aReceberCounts.totalPendentes, icon: AlertOctagon, tone: "bad" },
        ] as const).map(card => {
          const Icon = card.icon;
          const active = aReceberStatusFilter === card.key;
          const toneStyles = {
            neutral: { icon: "text-muted-foreground", accent: "bg-foreground" },
            bad: { icon: "text-destructive", accent: "bg-destructive" },
            warn: { icon: "text-status-warning", accent: "bg-status-warning" },
            good: { icon: "text-status-success", accent: "bg-status-success" },
          }[card.tone];
          return (
            <button
              key={card.key}
              onClick={() => { setAReceberStatusFilter(card.key); setCurrentPage(1); }}
              className={cn(
                "relative rounded-lg border bg-card px-3 py-2.5 text-left transition-colors overflow-hidden",
                active ? "border-primary/40 bg-muted/30" : "border-border/60 hover:bg-muted/20",
              )}
            >
              {active && (<span className={cn("absolute left-0 top-0 bottom-0 w-0.5", toneStyles.accent)} />)}
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className={cn("h-3.5 w-3.5 shrink-0", toneStyles.icon)} />
                <span className="text-[11px] font-medium text-muted-foreground truncate">{card.label}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2">
                <p className="text-lg sm:text-base font-semibold text-foreground tabular-nums leading-none">{card.count}</p>
                <p className="text-[11px] text-muted-foreground tabular-nums truncate">{fmtBRL(card.value)}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* ─── Filtros ─── */}
      <div className="rounded-3xl border border-border/60 bg-card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Pesquisar por nome, protocolo..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} className="w-full pl-11 pr-4 py-2.5 rounded-2xl border border-border/60 bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <SearchableSelect
              value={convenioFilter === "all" ? "Todos convênios" : convenioFilter}
              onChange={v => {
                const val = !v || v === "Todos convênios" ? "all" : v;
                setConvenioFilter(val);
                setCurrentPage(1);
              }}
              options={["Todos convênios", ...conveniosDisponiveis]}
              placeholder="Convênio"
              size="sm"
              className="w-48"
            />
          </div>
        </div>
      </div>

      {/* ─── Sub-abas Pacientes/Convênios ─── */}
      <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-2xl border border-border/30 w-fit">
        {([
          { key: "pacientes", label: `Pacientes (${aReceberSource.length})` },
          { key: "convenios", label: `Convênios (${aReceberConvenioRows.length})` },
        ] as const).map(t => {
          const active = aReceberSubTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => { setAReceberSubTab(t.key); setCurrentPage(1); }}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap",
                active ? "bg-card text-foreground shadow-sm border border-border/40" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ─── Tabela: Convênios ─── */}
      {aReceberSubTab === "convenios" && (
        <div className="rounded-3xl border border-border/60 bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/40 bg-muted/20">
                  <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Convênio</th>
                  <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Exames em aberto</th>
                  <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Saldo a faturar</th>
                  <th className="text-center px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {aReceberConvenioRows.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-16 text-sm text-muted-foreground">Nenhum convênio com saldo em aberto</td></tr>
                ) : aReceberConvenioRows.map(row => (
                  <tr key={row.convenioId} className="border-b border-border/20 last:border-0 hover:bg-muted/15 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-semibold text-foreground">{row.convenioNome}</span>
                        <span className="text-[11px] text-muted-foreground">{row.qtdPacientes} paciente(s)</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-foreground tabular-nums">{row.qtdExames}</td>
                    <td className="px-5 py-4">
                      <span className="text-sm font-bold text-status-warning tabular-nums">{fmtBRL(row.saldo)}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center">
                        <Button
                          size="sm"
                          onClick={() => {
                            setFecharFaturaAlvo({ convenioId: row.convenioId, convenioNome: row.convenioNome });
                            setFecharFaturaOpen(true);
                          }}
                          className="rounded-xl h-8 text-xs gap-1.5"
                        >
                          <Receipt className="h-3.5 w-3.5" />
                          Fechar fatura
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Tabela: Pacientes ─── */}
      {aReceberSubTab === "pacientes" && (
        <div className="rounded-3xl border border-border/60 bg-card overflow-hidden">
          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/40 bg-muted/20">
                  <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Protocolo</th>
                  <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cliente</th>
                  <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Saldo</th>
                  <th className="text-center px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-center px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {aReceberPaginated.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-16 text-sm text-muted-foreground">Nenhum atendimento com saldo pendente</td></tr>
                ) : aReceberPaginated.map((row, idx) => (
                  <tr key={idx} className="border-b border-border/20 last:border-0 hover:bg-muted/15 transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-semibold text-foreground tabular-nums">{row.protocolo}</span>
                        <span className="text-[11px] text-muted-foreground tabular-nums">{row.data}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 max-w-[260px]">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-foreground truncate">{row.cliente}</span>
                        {row.atendimento.convenio !== "Particular" && (
                          <span className="text-[11px] text-muted-foreground truncate">{row.convenio}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-bold text-status-warning tabular-nums">{fmtBRL(row.saldo)}</span>
                        <span className="text-[11px] text-muted-foreground tabular-nums">de {fmtBRL(row.valorTotal)}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={cn(
                        "text-xs font-semibold px-3 py-1 rounded-full",
                        row.status === "parcial" ? "bg-status-warning/10 text-status-warning" : "bg-destructive/10 text-destructive",
                      )}>
                        {row.status === "parcial" ? "Parcial" : "Pendente"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center">
                        <Button size="sm" onClick={() => handleAReceberPagar(row)} className="rounded-xl h-8 text-xs gap-1.5">
                          <Wallet className="h-3.5 w-3.5" />
                          Receber
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden divide-y divide-border/30">
            {aReceberPaginated.length === 0 ? (
              <div className="p-16 text-center text-sm text-muted-foreground">Nenhum atendimento com saldo pendente</div>
            ) : aReceberPaginated.map((row, idx) => (
              <div key={idx} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{row.cliente}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">{row.protocolo} · {row.data}</p>
                  </div>
                  <p className="text-sm font-bold text-status-warning shrink-0 tabular-nums">{fmtBRL(row.saldo)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground font-medium">{row.convenio}</span>
                  <span className={cn(
                    "text-[11px] px-2 py-0.5 rounded-md font-semibold",
                    row.status === "parcial" ? "bg-status-warning/10 text-status-warning" : "bg-destructive/10 text-destructive",
                  )}>
                    {row.status === "parcial" ? "Parcial" : "Pendente"}
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-muted/40 text-muted-foreground tabular-nums">de {fmtBRL(row.valorTotal)}</span>
                </div>
                <Button size="sm" onClick={() => handleAReceberPagar(row)} className="w-full rounded-xl h-9 text-xs gap-1.5">
                  <Wallet className="h-3.5 w-3.5" />
                  Receber pagamento
                </Button>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {aReceberTotalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-4 border-t border-border/30">
              <span className="text-xs text-muted-foreground">{((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, aReceberFilteredLength)} de {aReceberFilteredLength}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-xl hover:bg-muted transition-colors disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
                {Array.from({ length: Math.min(aReceberTotalPages, 5) }, (_, i) => i + 1).map(page => (
                  <button key={page} onClick={() => setCurrentPage(page)} className={cn("h-8 w-8 rounded-xl text-xs font-semibold transition-all", currentPage === page ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>{page}</button>
                ))}
                {aReceberTotalPages > 5 && <span className="text-xs text-muted-foreground px-1">…</span>}
                <button onClick={() => setCurrentPage(p => Math.min(aReceberTotalPages, p + 1))} disabled={currentPage === aReceberTotalPages} className="p-2 rounded-xl hover:bg-muted transition-colors disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
