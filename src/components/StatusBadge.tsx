import { AlertCircle } from "lucide-react";

type StatusType = "success" | "warning" | "danger" | "info" | "neutral" | "purple" | "teal";

interface StatusBadgeProps {
  label: string;
  type: StatusType;
  showIcon?: boolean;
  tooltip?: string;
}

const statusStyles: Record<StatusType, string> = {
  success: "bg-status-success-bg text-status-success border-status-success/20",
  warning: "bg-status-warning-bg text-status-warning border-status-warning/20",
  danger: "bg-status-danger-bg text-status-danger border-status-danger/20",
  info: "bg-status-info-bg text-status-info border-status-info/20",
  neutral: "bg-status-neutral-bg text-status-neutral border-status-neutral/20",
  purple: "bg-status-purple-bg text-status-purple border-status-purple/20",
  teal: "bg-status-teal-bg text-status-teal border-status-teal/20",
};

// Short display aliases — preserves canonical labels in data layer
const labelAliases: Record<string, string> = {
  "Pagamento efetuado": "Pago",
  "Pagamento Efetuado": "Pago",
  "Pagamento pendente": "Pendente",
  "Pagamento Pendente": "Pendente",
  "Pagamento parcial": "Parcial",
  "Pagamento Parcial": "Parcial",
  "Pagamento cancelado": "Cancelado",
};

const StatusBadge = ({ label, type, showIcon, tooltip, onClick }: StatusBadgeProps & { onClick?: () => void }) => {
  const isParcial = label.toLowerCase().includes("parcial");
  const displayLabel = labelAliases[label] ?? label;

  return (
    <span
      onClick={onClick}
      title={tooltip ?? label}
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium border ${statusStyles[type]} ${onClick ? "cursor-pointer hover:opacity-80" : ""}`}
    >
      {isParcial && (
        <span className="relative flex h-3.5 w-3.5 items-center justify-center">
          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16">
            <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.25" />
            <circle
              cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="2"
              strokeDasharray={`${Math.PI * 13 * 0.5} ${Math.PI * 13}`}
              strokeLinecap="round"
              transform="rotate(-90 8 8)"
            />
          </svg>
        </span>
      )}
      {displayLabel}
      {showIcon && <AlertCircle className="h-3.5 w-3.5" />}
    </span>
  );
};

export default StatusBadge;
