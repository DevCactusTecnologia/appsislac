import { Globe, Zap, Clock, Calendar } from "lucide-react";

type Origem = "INTERNO" | "WEB_AUTO" | "WEB_APROVADO" | "AGENDAMENTO" | string;

interface Props {
  origem?: Origem | null;
  /** `compact` exibe só o ícone (para tabelas densas). */
  compact?: boolean;
  className?: string;
}

/**
 * Badge de origem operacional do atendimento.
 * IA-first: Web requests are intelligent pre-attendances; this badge
 * preserves operational context throughout `/atendimentos`, dialogs and prints.
 */
export default function OrigemBadge({ origem, compact, className }: Props) {
  if (!origem || origem === "INTERNO") return null;

  const cfg: Record<string, { label: string; icon: typeof Globe; cls: string }> = {
    WEB_AUTO: {
      label: "Auto confirmado",
      icon: Zap,
      cls: "bg-status-success-bg text-status-success border-status-success/20",
    },
    WEB_APROVADO: {
      label: "Pedido Web",
      icon: Globe,
      cls: "bg-status-info-bg text-status-info border-status-info/20",
    },
    AGENDAMENTO: {
      label: "Agendamento",
      icon: Calendar,
      cls: "bg-status-purple-bg text-status-purple border-status-purple/20",
    },
  };
  const c = cfg[origem] ?? {
    label: String(origem),
    icon: Clock,
    cls: "bg-status-neutral-bg text-status-neutral border-status-neutral/20",
  };
  const Icon = c.icon;
  return (
    <span
      title={c.label}
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${c.cls} ${className ?? ""}`}
    >
      <Icon className="h-3 w-3" />
      {!compact && c.label}
    </span>
  );
}