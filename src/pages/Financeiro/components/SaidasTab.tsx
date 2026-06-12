// SaidasTab — cards de status + filtros + tabela compartilhada.
// Fase 4 — Passo 3. JSX extraído de Financeiro.tsx (linhas 718-756 + 875-941 slice "saida").
// Consome estado/handlers via FinanceiroContext.
import {
  Search, Plus, AlertOctagon, Clock, CheckCircle2, CircleDollarSign,
} from "lucide-react";
import { cn, fmtBRL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import SearchableSelect from "@/components/financeiro/SearchableSelect";
import { useFinanceiroContext } from "../FinanceiroContext";
import EntradasSaidasTable from "./EntradasSaidasTable";

export default function SaidasTab() {
  const {
    saidaCounts,
    saidaStatusFilter, setSaidaStatusFilter,
    setCurrentPage, setSaidasSelecionadas,
    searchQuery, setSearchQuery,
    tipoDespesaFilter, setTipoDespesaFilter,
    destinoPagamentoFilter, setDestinoPagamentoFilter,
    tiposDespesa, destinosPagamento,
    deletableTipos, deletableDestinos,
    openCriar, handleDeleteItem,
    setDialogTipo, setDialogOpen,
  } = useFinanceiroContext();

  return (
    <>
      {/* ─── Cards de status (Saídas) ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {([
          { key: "todas", label: "Total", count: saidaCounts.todas, value: saidaCounts.totalPendentes + saidaCounts.totalPagas, icon: CircleDollarSign, tone: "neutral" },
          { key: "vencidas", label: "Vencidas", count: saidaCounts.vencidas, value: saidaCounts.totalVencidas, icon: AlertOctagon, tone: "bad" },
          { key: "vencendo7", label: "Vencem em 7 dias", count: saidaCounts.vencendo7, value: saidaCounts.totalVencendo7, icon: Clock, tone: "warn" },
          { key: "pagas", label: "Pagas", count: saidaCounts.pagas, value: saidaCounts.totalPagas, icon: CheckCircle2, tone: "good" },
        ] as const).map(card => {
          const Icon = card.icon;
          const active = saidaStatusFilter === card.key;
          const toneStyles = {
            neutral: { icon: "text-muted-foreground", accent: "bg-foreground" },
            bad: { icon: "text-destructive", accent: "bg-destructive" },
            warn: { icon: "text-status-warning", accent: "bg-status-warning" },
            good: { icon: "text-status-success", accent: "bg-status-success" },
          }[card.tone];
          return (
            <button
              key={card.key}
              onClick={() => { setSaidaStatusFilter(card.key); setCurrentPage(1); setSaidasSelecionadas(new Set()); }}
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
              value={tipoDespesaFilter === "all" ? "Todos" : tipoDespesaFilter}
              onChange={v => {
                const val = !v || v === "Todos" ? "all" : v;
                setTipoDespesaFilter(val);
                setCurrentPage(1);
              }}
              onCreateRequest={(typed) => openCriar("tipo_despesa", typed, (nome) => { setTipoDespesaFilter(nome); setCurrentPage(1); })}
              options={["Todos", ...tiposDespesa]}
              placeholder="Tipo despesa"
              allowCreate
              size="sm"
              className="w-44"
              deletableOptions={deletableTipos}
              onDelete={(v) => void handleDeleteItem("tipo_despesa", v)}
            />
            <SearchableSelect
              value={destinoPagamentoFilter === "all" ? "Todos" : destinoPagamentoFilter}
              onChange={v => {
                const val = !v || v === "Todos" ? "all" : v;
                setDestinoPagamentoFilter(val);
                setCurrentPage(1);
              }}
              onCreateRequest={(typed) => openCriar("destino_pagamento", typed, (nome) => { setDestinoPagamentoFilter(nome); setCurrentPage(1); })}
              options={["Todos", ...destinosPagamento]}
              placeholder="Destino"
              allowCreate
              size="sm"
              className="w-44"
              deletableOptions={deletableDestinos}
              onDelete={(v) => void handleDeleteItem("destino_pagamento", v)}
            />
            <Button onClick={() => { setDialogTipo("saida"); setDialogOpen(true); }} className="rounded-2xl h-10 gap-2 text-xs font-semibold px-5">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nova saída</span>
              <span className="sm:hidden">Adicionar</span>
            </Button>
          </div>
        </div>
      </div>

      <EntradasSaidasTable />
    </>
  );
}
