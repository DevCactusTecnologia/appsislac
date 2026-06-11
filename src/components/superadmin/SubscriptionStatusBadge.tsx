// Badge flat de status de assinatura (estilo Stripe).
import { cn } from "@/lib/utils";

const MAP: Record<string, { label: string; cls: string }> = {
  active:    { label: "Ativa",       cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400" },
  trial:    { label: "Trial",       cls: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400" },
  past_due: { label: "Inadimplente", cls: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400" },
  canceled: { label: "Cancelada",   cls: "bg-muted text-muted-foreground border-border" },
  paused:   { label: "Pausada",     cls: "bg-zinc-500/10 text-zinc-600 border-zinc-500/20 dark:text-zinc-400" },
};

export function SubscriptionStatusBadge({ status, className }: { status?: string | null; className?: string }) {
  const conf = MAP[status ?? ""] ?? { label: status ?? "—", cls: "bg-muted text-muted-foreground border-border" };
  return (
    <span className={cn(
      "inline-flex items-center gap-1 h-5 px-2 rounded text-[10px] font-semibold uppercase tracking-[0.06em] border",
      conf.cls,
      className,
    )}>
      <span className="h-1 w-1 rounded-full bg-current opacity-80" />
      {conf.label}
    </span>
  );
}