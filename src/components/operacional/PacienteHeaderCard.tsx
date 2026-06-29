/**
 * PacienteHeaderCard
 * ------------------
 * Cabeçalho de paciente compartilhado pelas telas operacionais
 * (/consultar-resultado, /resultado, /registrar-coleta, /analisar-amostra).
 *
 * Hierarquia visual à prova de viewport estreito:
 *   Linha 1: avatar + nome (truncate) + status badge à direita
 *   Linha 2: chips compactos (sexo · nascimento · idade · protocolo)
 *   Linha 3 (opcional): área de ações
 *
 * NUNCA sobrepõe texto: tudo respeita min-w-0 + truncate; chips quebram
 * em múltiplas linhas via flex-wrap. Ações se tornam um menu kebab
 * em larguras muito estreitas (<sm) quando há mais de 3 itens.
 */
import { ReactNode } from "react";
import { Calendar, User as UserIcon, Hash, MoreVertical } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import StatusBadge from "@/components/StatusBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type StatusType = "success" | "warning" | "danger" | "info" | "neutral" | "purple" | "teal";

export interface PacienteHeaderAction {
  key: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  /** Visual emphasis: 'primary' fica como botão indigo cheio. */
  variant?: "primary" | "ghost" | "danger";
  /** Esconder rótulo no botão (mantém só ícone) acima de sm. Default: true para 'ghost'. */
  iconOnly?: boolean;
  title?: string;
  /** Desabilita o botão (visual e interação). */
  disabled?: boolean;
}

interface Props {
  nome: string;
  sexo?: string;
  nascimentoBR?: string;
  idade?: string;
  protocolo: string;
  statusLabel?: string;
  statusType?: StatusType;
  actions?: PacienteHeaderAction[];
  /**
   * Quando true, renderiza as ações na mesma linha do StatusBadge (direita
   * do nome), eliminando a divisória inferior. Útil para telas de consulta
   * onde o cabeçalho deve ser enxuto.
   */
  actionsInline?: boolean;
  /** Slot opcional renderizado na linha de ações, à esquerda dos botões. */
  actionsExtraLeft?: React.ReactNode;
  /** Slot opcional renderizado na linha de ações, à direita dos botões. */
  actionsExtraRight?: React.ReactNode;
  /** Slot opcional renderizado logo abaixo do avatar (ex.: badge de jejum). */
  belowAvatar?: React.ReactNode;
}

function iniciais(nome: string): string {
  const parts = nome.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

function ActionButton({ action }: { action: PacienteHeaderAction }) {
  const base =
    "inline-flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-semibold transition-colors shrink-0";
  const disabledCls = action.disabled
    ? " opacity-40 cursor-not-allowed"
    : "";
  if (action.variant === "primary") {
    return (
      <button
        onClick={action.onClick}
        disabled={action.disabled}
        title={action.title ?? action.label}
        className={`${base} px-3 sm:px-4 bg-primary text-primary-foreground hover:bg-primary/90${disabledCls}`}
      >
        {action.icon}
        <span className="hidden sm:inline">{action.label}</span>
      </button>
    );
  }
  if (action.variant === "danger") {
    return (
      <button
        onClick={action.onClick}
        disabled={action.disabled}
        title={action.title ?? action.label}
        className={`${base} w-9 border border-border bg-card text-[hsl(var(--status-danger))] hover:bg-[hsl(var(--status-danger-bg))]${disabledCls}`}
      >
        {action.icon}
      </button>
    );
  }
  return (
    <button
      onClick={action.onClick}
      disabled={action.disabled}
      title={action.title ?? action.label}
      className={`${base} w-9 border border-border bg-card text-foreground hover:bg-accent${disabledCls}`}
    >
      {action.icon}
    </button>
  );
}

export function PacienteHeaderCard({
  nome,
  sexo,
  nascimentoBR,
  idade,
  protocolo,
  statusLabel,
  statusType,
  actions = [],
  actionsInline = false,
  actionsExtraLeft,
  actionsExtraRight,
  belowAvatar,
}: Props) {
  const primary = actions.find((a) => a.variant === "primary");
  const others = actions.filter((a) => a.variant !== "primary");

  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3 sm:px-5 sm:py-4">
      {/* Linha 1: identidade + status */}
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-1.5 shrink-0">
          <Avatar className="h-11 w-11 ring-1 ring-primary/15">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {iniciais(nome)}
            </AvatarFallback>
          </Avatar>
          {belowAvatar}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-[15px] sm:text-base font-semibold text-foreground leading-tight truncate">
              {nome}
            </h1>
            {(statusLabel || (actionsInline && actions.length > 0)) && (
              <div className="shrink-0 mt-0.5 flex items-center gap-1.5 flex-wrap justify-end">
                {statusLabel && statusType && (
                  <StatusBadge label={statusLabel} type={statusType} />
                )}
                {actionsInline && others.map((a) => <ActionButton key={a.key} action={a} />)}
                {actionsInline && primary && <ActionButton action={primary} />}
              </div>
            )}
          </div>

          {/* Linha 2: chips compactos (sempre quebram, nunca sobrepõem) */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {sexo && (
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <UserIcon className="h-3 w-3 shrink-0" />
                <span className="text-foreground font-medium">{sexo}</span>
              </span>
            )}
            {nascimentoBR && (
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <Calendar className="h-3 w-3 shrink-0" />
                <span className="text-foreground font-medium tabular-nums">{nascimentoBR}</span>
              </span>
            )}
            {idade && (
              <span className="whitespace-nowrap text-foreground/80">{idade}</span>
            )}
            <span className="inline-flex items-center gap-1 whitespace-nowrap font-mono">
              <Hash className="h-3 w-3 shrink-0" />
              <span className="text-foreground font-semibold">{protocolo}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Linha 3: ações (se houver) */}
      {!actionsInline && (actions.length > 0 || actionsExtraLeft || actionsExtraRight) && (
        <div className="mt-3 pt-3 border-t border-border flex items-center gap-1.5 flex-wrap">
          {actionsExtraLeft && <div className="flex items-center gap-1.5 mr-auto">{actionsExtraLeft}</div>}
          {others.map((a) => <ActionButton key={a.key} action={a} />)}
          {primary && <ActionButton action={primary} />}
          {actionsExtraRight}
        </div>
      )}
    </div>
  );
}

export default PacienteHeaderCard;