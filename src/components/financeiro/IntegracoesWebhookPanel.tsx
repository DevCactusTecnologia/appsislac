import { useEffect, useMemo, useState } from "react";
import { History, Trash2, RefreshCw, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import {
  HISTORY_MAX,
  readWebhookHistory,
  clearWebhookHistory,
  WEBHOOK_PROVIDER_LABEL,
  type WebhookEvent,
  type WebhookProvider,
} from "@/lib/gatewayWebhookHistory";
import { toast } from "@/hooks/use-toast";

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

/**
 * Painel read-only de status e histórico de webhooks dos gateways de
 * pagamento. Usado dentro de /financeiro (aba Integrações). A configuração
 * em si fica em /configuracoes → Gateway de pagamento.
 */
const IntegracoesWebhookPanel = () => {
  const [history, setHistory] = useState<WebhookEvent[]>([]);
  const [filter, setFilter] = useState<"all" | WebhookProvider>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "error">("all");

  const refresh = () => setHistory(readWebhookHistory());

  useEffect(() => {
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "sislac:gatewayPagamento:webhookHistory") refresh();
    };
    window.addEventListener("storage", onStorage);
    const interval = setInterval(refresh, 5000);
    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(interval);
    };
  }, []);

  const filtered = useMemo(
    () =>
      history.filter(
        (h) =>
          (filter === "all" || h.provider === filter) &&
          (statusFilter === "all" || h.status === statusFilter),
      ),
    [history, filter, statusFilter],
  );

  const counts = useMemo(() => {
    const last24h = Date.now() - 24 * 60 * 60 * 1000;
    const recent = history.filter((h) => new Date(h.timestamp).getTime() >= last24h);
    return {
      total: history.length,
      ok24: recent.filter((h) => h.status === "success").length,
      err24: recent.filter((h) => h.status === "error").length,
    };
  }, [history]);

  const handleClear = () => {
    clearWebhookHistory();
    setHistory([]);
    toast({ title: "Histórico limpo" });
  };

  return (
    <div className="space-y-4">
      {/* Resumo rápido */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Eventos registrados
          </p>
          <p className="text-2xl font-bold text-foreground mt-1">{counts.total}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            mantém os últimos {HISTORY_MAX}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
            Sucesso · 24h
          </p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">
            {counts.ok24}
          </p>
        </div>
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
          <p className="text-[11px] font-semibold text-destructive uppercase tracking-wider">
            Erros · 24h
          </p>
          <p className="text-2xl font-bold text-destructive mt-1">{counts.err24}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <History className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Histórico de webhooks</h2>
              <p className="text-xs text-muted-foreground">
                Recebimentos e validações dos gateways. Configure em{" "}
                <Link
                  to="/configuracoes?tab=gateway-pagamento"
                  className="text-primary hover:underline inline-flex items-center gap-0.5"
                >
                  Configurações <ExternalLink className="h-3 w-3" />
                </Link>
                .
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as "all" | WebhookProvider)}
              className="h-9 px-2 rounded-lg border border-border bg-card text-xs text-foreground"
            >
              <option value="all">Todos os gateways</option>
              <option value="mercado_pago">Mercado Pago</option>
              <option value="infinitepay">InfinitePay</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "all" | "success" | "error")
              }
              className="h-9 px-2 rounded-lg border border-border bg-card text-xs text-foreground"
            >
              <option value="all">Todos os status</option>
              <option value="success">Sucesso</option>
              <option value="error">Erro</option>
            </select>
            <button
              type="button"
              onClick={refresh}
              className="h-9 px-3 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Atualizar
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={history.length === 0}
              className="h-9 px-3 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors flex items-center gap-2 disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Limpar
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Nenhum evento registrado ainda.
          </div>
        ) : (
          <div className="divide-y divide-border max-h-[520px] overflow-auto">
            {filtered.map((ev) => {
              const ok = ev.status === "success";
              return (
                <div key={ev.id} className="px-5 sm:px-6 py-3 flex items-start gap-3">
                  <div
                    className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                      ok ? "bg-emerald-500" : "bg-destructive"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="font-semibold text-foreground">
                        {WEBHOOK_PROVIDER_LABEL[ev.provider]}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
                        {ev.ambiente === "producao" ? "produção" : "sandbox"}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ${
                          ok
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            : "bg-destructive/10 text-destructive border-destructive/20"
                        }`}
                      >
                        {ok ? "sucesso" : "erro"}
                      </span>
                      <span className="text-muted-foreground">{fmtDate(ev.timestamp)}</span>
                    </div>
                    <p className="text-[12px] text-foreground/90 mt-0.5">{ev.message}</p>
                    {ev.url && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        <code className="px-1 py-0.5 rounded bg-muted">{ev.url}</code>
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default IntegracoesWebhookPanel;
