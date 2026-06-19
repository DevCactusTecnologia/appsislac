import { useEffect, useMemo, useState } from "react";
import { History, Trash2, RefreshCw, ExternalLink, Plug, AlertTriangle, CheckCircle2 } from "lucide-react";
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
import { cn } from "@/lib/utils";

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch { return iso; }
}

function ResumoCard({
  label, value, Icon, tone,
}: {
  label: string; value: string | number; Icon: typeof Plug;
  tone: "neutral" | "positive" | "negative";
}) {
  const dot = { neutral: "bg-muted-foreground/40", positive: "bg-emerald-500", negative: "bg-rose-500" }[tone];
  const valueCls = {
    neutral:  "text-foreground",
    positive: "text-emerald-600 dark:text-emerald-400",
    negative: "text-rose-600 dark:text-rose-400",
  }[tone];
  return (
    <div className="rounded-xl border border-border/50 bg-card p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        </div>
        <Icon className="h-4 w-4 text-muted-foreground/70" strokeWidth={1.75} />
      </div>
      <div className={cn("text-[22px] font-semibold tabular-nums leading-tight", valueCls)}>{value}</div>
    </div>
  );
}

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
    () => history.filter(
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

  const chipBase = "px-3 h-7 rounded-md text-xs font-medium transition-all whitespace-nowrap";
  const chipActive = "bg-background text-foreground shadow-sm border border-border/60";
  const chipIdle = "text-muted-foreground hover:text-foreground";

  return (
    <div className="space-y-3">
      {/* Resumo em grid uniforme */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <ResumoCard label="Eventos registrados" value={counts.total} Icon={Plug} tone="neutral" />
        <ResumoCard label="Sucesso · 24h"       value={counts.ok24}  Icon={CheckCircle2} tone="positive" />
        <ResumoCard label="Erros · 24h"         value={counts.err24} Icon={AlertTriangle} tone="negative" />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Mantém os últimos {HISTORY_MAX} eventos. Configure os gateways em{" "}
        <Link to="/configuracoes?tab=gateway-pagamento" className="text-primary hover:underline inline-flex items-center gap-0.5">
          Configurações <ExternalLink className="h-3 w-3" />
        </Link>.
      </p>

      {/* Toolbar minimalista */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-0.5 p-1 bg-muted/40 rounded-lg border border-border/40">
            {([
              { key: "all",          label: "Todos gateways" },
              { key: "mercado_pago", label: "Mercado Pago" },
              { key: "infinitepay",  label: "InfinitePay" },
            ] as const).map(o => (
              <button key={o.key} onClick={() => setFilter(o.key as "all" | WebhookProvider)}
                className={cn(chipBase, filter === o.key ? chipActive : chipIdle)}>
                {o.label}
              </button>
            ))}
          </div>
          <div className="inline-flex items-center gap-0.5 p-1 bg-muted/40 rounded-lg border border-border/40">
            {([
              { key: "all",     label: "Todos" },
              { key: "success", label: "Sucesso" },
              { key: "error",   label: "Erro" },
            ] as const).map(o => (
              <button key={o.key} onClick={() => setStatusFilter(o.key as "all" | "success" | "error")}
                className={cn(chipBase, statusFilter === o.key ? chipActive : chipIdle)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={refresh}
            className="h-8 px-3 rounded-lg border border-border/60 bg-card text-xs font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </button>
          <button type="button" onClick={handleClear} disabled={history.length === 0}
            className="h-8 px-3 rounded-lg border border-border/60 bg-card text-xs font-medium text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors flex items-center gap-1.5 disabled:opacity-40">
            <Trash2 className="h-3.5 w-3.5" /> Limpar
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-14 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <History className="h-6 w-6 text-muted-foreground/50" />
            Nenhum evento registrado ainda.
          </div>
        ) : (
          <div className="divide-y divide-border/20 max-h-[520px] overflow-auto">
            {filtered.map((ev) => {
              const ok = ev.status === "success";
              return (
                <div key={ev.id} className="px-4 py-2.5 flex items-start gap-3 even:bg-muted/[0.04] hover:bg-primary/[0.04] transition-colors">
                  <div className={cn("mt-1.5 h-1.5 w-1.5 rounded-full shrink-0", ok ? "bg-emerald-500" : "bg-rose-500")} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap text-[11px]">
                      <span className="font-semibold text-foreground text-[12px]">{WEBHOOK_PROVIDER_LABEL[ev.provider]}</span>
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-muted/60 text-muted-foreground border border-border/50">
                        {ev.ambiente === "producao" ? "produção" : "sandbox"}
                      </span>
                      <span className={cn(
                        "px-1.5 py-0.5 rounded-md text-[10px] font-medium border",
                        ok
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200/70 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900"
                          : "bg-rose-50 text-rose-700 border-rose-200/70 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900",
                      )}>
                        {ok ? "sucesso" : "erro"}
                      </span>
                      <span className="text-muted-foreground tabular-nums">{fmtDate(ev.timestamp)}</span>
                    </div>
                    <p className="text-[12px] text-foreground/90 mt-0.5">{ev.message}</p>
                    {ev.url && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        <code className="px-1 py-0.5 rounded bg-muted/60">{ev.url}</code>
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
