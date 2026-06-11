// Onda 1 — Sistema visual de status unificado do /super-admin.
// Fonte única de verdade para badges flat semânticos em:
//   runtime · onboarding · health · lifecycle · federation · billing
//
// Princípios:
// - Flat (sem gradiente, sem shadow), h-6 (sm) ou h-5 (xs)
// - Cor vem 100% dos tokens (--status-*) — funciona em light/dark
// - Dot opcional à esquerda (sensação NOC / Linear)
// - Nunca usar cores diretas em componentes — sempre via este wrapper

import { cn } from "@/lib/utils";

export type StatusTone =
  | "active"        // verde — saudável / ativo
  | "pending"       // amarelo — aguardando ação
  | "provisioning"  // azul — em progresso
  | "failed"        // vermelho — falhou
  | "suspended"     // cinza — pausado / suspenso
  | "neutral"       // cinza claro — informativo neutro
  | "info"          // azul claro — info
  | "purple";       // roxo — destaque especial (ex: isolated_db)

const TONE_CLASSES: Record<StatusTone, { bg: string; fg: string; dot: string; ring: string }> = {
  active:       { bg: "bg-status-success-bg",  fg: "text-status-success",  dot: "bg-status-success",  ring: "ring-status-success/20" },
  pending:      { bg: "bg-status-pending-bg",  fg: "text-status-pending",  dot: "bg-status-pending",  ring: "ring-status-pending/20" },
  provisioning: { bg: "bg-status-info-bg",     fg: "text-status-info",     dot: "bg-status-info",     ring: "ring-status-info/20" },
  failed:       { bg: "bg-status-danger-bg",   fg: "text-status-danger",   dot: "bg-status-danger",   ring: "ring-status-danger/20" },
  suspended:    { bg: "bg-status-neutral-bg",  fg: "text-status-neutral",  dot: "bg-status-neutral",  ring: "ring-status-neutral/20" },
  neutral:      { bg: "bg-muted/60",           fg: "text-muted-foreground",dot: "bg-muted-foreground/50", ring: "ring-border" },
  info:         { bg: "bg-status-info-bg",     fg: "text-status-info",     dot: "bg-status-info",     ring: "ring-status-info/20" },
  purple:       { bg: "bg-status-purple-bg",   fg: "text-status-purple",   dot: "bg-status-purple",   ring: "ring-status-purple/20" },
};

export interface StatusBadgeProps {
  tone: StatusTone;
  label: string;
  /** Mostra o dot pulsante à esquerda (estilo NOC). Default: true */
  dot?: boolean;
  /** Anima o dot (ex: provisioning, ativo). Default: false */
  pulse?: boolean;
  size?: "xs" | "sm";
  className?: string;
  title?: string;
}

/**
 * Badge flat unificado para o painel /super-admin.
 *
 * Exemplos:
 *   <StatusBadge tone="active" label="Ativo" />
 *   <StatusBadge tone="provisioning" label="Provisionando" pulse />
 *   <StatusBadge tone="failed" label="Falhou" size="xs" />
 */
export function StatusBadge({
  tone,
  label,
  dot = true,
  pulse = false,
  size = "sm",
  className,
  title,
}: StatusBadgeProps) {
  const t = TONE_CLASSES[tone];
  const sizing =
    size === "xs"
      ? "h-5 px-2 text-[9px] gap-1.5 rounded-full"
      : "h-6 px-3 text-[10px] gap-2 rounded-full";
  const dotSize = size === "xs" ? "h-1 w-1" : "h-1.5 w-1.5";
  return (
    <span
      title={title ?? label}
      className={cn(
        "inline-flex items-center rounded-md font-semibold tabular-nums whitespace-nowrap",
        sizing,
        t.bg,
        t.fg,
        className,
      )}
    >
      {dot && (
        <span className={cn("relative inline-flex shrink-0 rounded-full", dotSize, t.dot)}>
          {pulse && (
            <span className={cn("absolute inset-0 rounded-full opacity-60 animate-ping", t.dot)} />
          )}
        </span>
      )}
      {label}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────
// Helpers de mapeamento — convertem strings do backend para tones.
// Centralizar aqui evita divergência entre páginas.
// ──────────────────────────────────────────────────────────────────

export function toneForTenantStatus(status?: string | null): StatusTone {
  switch ((status ?? "").toLowerCase()) {
    case "ativo":
    case "active":
      return "active";
    case "inativo":
    case "suspended":
    case "suspenso":
      return "suspended";
    case "pendente":
    case "pending":
      return "pending";
    case "bloqueado":
    case "blocked":
    case "failed":
      return "failed";
    default:
      return "neutral";
  }
}

export function toneForProvisioningStatus(status?: string | null): StatusTone {
  switch ((status ?? "").toLowerCase()) {
    case "ready":
    case "ativo":
      return "active";
    case "provisioning":
    case "validating":
      return "provisioning";
    case "pending":
      return "pending";
    case "failed":
    case "error":
      return "failed";
    default:
      return "neutral";
  }
}

export function toneForHealth(result?: string | null): StatusTone {
  switch ((result ?? "").toLowerCase()) {
    case "healthy":
    case "ok":
      return "active";
    case "degraded":
    case "stale":
      return "pending";
    case "failed":
    case "error":
      return "failed";
    case "never":
    case "unknown":
      return "neutral";
    default:
      return "neutral";
  }
}