// Onda A — Badge visual do runtime do tenant (control-plane).
// Mostra se o tenant roda no banco COMPARTILHADO (default hoje)
// ou em um banco ISOLADO (modo dedicated, Onda 4).
//
// Fonte de verdade: `tenant_registry.runtime_mode` ('shared_db'|'isolated_db').
// Read-only — não muda runtime, só informa.

import { Database, Server } from "lucide-react";
import { cn } from "@/lib/utils";

export type RuntimeMode = "shared_db" | "isolated_db" | string | null | undefined;

export function RuntimeBadge({
  mode,
  size = "sm",
  className,
}: {
  mode: RuntimeMode;
  size?: "xs" | "sm";
  className?: string;
}) {
  const isIsolated = mode === "isolated_db";
  const Icon = isIsolated ? Server : Database;
  const label = isIsolated ? "Banco isolado" : "Banco compartilhado";
  const sizing =
    size === "xs"
      ? "h-5 px-1.5 text-[10px] gap-1"
      : "h-6 px-2 text-[11px] gap-1.5";
  return (
    <span
      title={isIsolated ? "Tenant em database-per-tenant (dedicated)" : "Tenant no banco compartilhado (shared)"}
      className={cn(
        "inline-flex items-center rounded-md border font-semibold tabular-nums",
        sizing,
        isIsolated
          ? "bg-status-purple-bg border-status-purple/30 text-status-purple"
          : "bg-muted/50 border-border text-muted-foreground",
        className,
      )}
    >
      <Icon className={size === "xs" ? "h-2.5 w-2.5" : "h-3 w-3"} />
      {label}
    </span>
  );
}