// EntradasTab — cards de resumo (regime de caixa) + filtros + tabela compartilhada.
// Fase 4 — Passo 3. JSX extraído de Financeiro.tsx (linhas 759-831 + 875-941 slice "entrada").
// Consome estado/handlers via FinanceiroContext.
import {
  Search, Plus, CheckCircle2, Clock, Wallet, QrCode, Banknote, CreditCard,
  Building2, CircleDollarSign,
} from "lucide-react";
import { fmtBRL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import SearchableSelect from "@/components/financeiro/SearchableSelect";
import { useFinanceiroContext } from "../FinanceiroContext";
import EntradasSaidasTable from "./EntradasSaidasTable";

export default function EntradasTab() {
  const {
    entradaCounts, aReceberCounts,
    setActiveTab, setCurrentPage,
    searchQuery, setSearchQuery,
    convenioFilter, setConvenioFilter,
    conveniosDisponiveis,
    setDialogTipo, setDialogOpen,
  } = useFinanceiroContext();

  return (
    <>
      {/* ─── Card de resumo (Entradas — regime de caixa) ─── */}
      <div className="space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="relative rounded-lg border border-border/60 bg-card px-3 py-2.5 overflow-hidden">
            <div className="flex items-center gap-2 mb-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-status-success" />
              <span className="text-[11px] font-medium text-muted-foreground truncate">Total recebido (pagamentos efetivados)</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2">
              <p className="text-lg sm:text-base font-semibold text-foreground tabular-nums leading-none">{entradaCounts.todas}</p>
              <p className="text-[11px] text-muted-foreground tabular-nums truncate">{fmtBRL(entradaCounts.totalRecebido)}</p>
            </div>
          </div>
          <button
            onClick={() => { setActiveTab("a_receber"); setCurrentPage(1); }}
            className="relative rounded-lg border border-border/60 bg-card px-3 py-2.5 text-left transition-colors overflow-hidden hover:bg-muted/20"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0 text-status-warning" />
              <span className="text-[11px] font-medium text-muted-foreground truncate">A receber (parcial + pendente)</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2">
              <p className="text-lg sm:text-base font-semibold text-foreground tabular-nums leading-none">{aReceberCounts.todas}</p>
              <p className="text-[11px] text-muted-foreground tabular-nums truncate">{fmtBRL(aReceberCounts.totalGeral)}</p>
            </div>
          </button>
        </div>

        {/* ─── Breakdown por forma de pagamento (período/convênio filtrado) ─── */}
        {entradaCounts.byPagamento.length > 0 && (
          <div className="rounded-lg border border-border/60 bg-card px-3 py-2.5">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="text-[11px] font-medium text-muted-foreground truncate">
                Recebido por forma de pagamento
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {entradaCounts.byPagamento.map((fp: { nome: string; total: number; count: number }) => {
                const pct = entradaCounts.totalRecebido > 0
                  ? (fp.total / entradaCounts.totalRecebido) * 100
                  : 0;
                const Icon = (() => {
                  const n = fp.nome.toLowerCase();
                  if (n.includes("pix")) return QrCode;
                  if (n.includes("dinheiro")) return Banknote;
                  if (n.includes("crédito") || n.includes("credito") || n.includes("débito") || n.includes("debito") || n.includes("cartão") || n.includes("cartao")) return CreditCard;
                  if (n.includes("boleto") || n.includes("transfer")) return Building2;
                  return CircleDollarSign;
                })();
                return (
                  <div
                    key={fp.nome}
                    className="relative flex-1 min-w-[140px] rounded-lg border border-border/60 bg-background px-2.5 py-2 overflow-hidden"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="text-[10px] font-medium text-muted-foreground truncate">{fp.nome}</span>
                    </div>
                    <p className="text-sm font-semibold text-foreground tabular-nums leading-tight">
                      {fmtBRL(fp.total)}
                    </p>
                    <p className="text-[10px] text-muted-foreground tabular-nums">
                      {fp.count} {fp.count === 1 ? "pagamento" : "pagamentos"} · {pct.toFixed(1)}%
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
            <Button onClick={() => { setDialogTipo("entrada"); setDialogOpen(true); }} className="rounded-2xl h-10 gap-2 text-xs font-semibold px-5">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nova entrada</span>
              <span className="sm:hidden">Adicionar</span>
            </Button>
          </div>
        </div>
      </div>

      <EntradasSaidasTable />
    </>
  );
}
