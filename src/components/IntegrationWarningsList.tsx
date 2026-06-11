import { useState } from "react";
import { AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp } from "lucide-react";
import type { IntegrationWarning } from "@/lib/integration/integrationStatus";

interface Props {
  warnings: IntegrationWarning[];
  /** Quantos exibir antes de colapsar. Default 3. */
  maxVisible?: number;
  className?: string;
}

const ICON: Record<IntegrationWarning["severity"], typeof AlertTriangle> = {
  critical: AlertTriangle,
  warning: AlertCircle,
  info: Info,
};

const TONE: Record<IntegrationWarning["severity"], string> = {
  critical: "text-destructive bg-destructive/5 border-destructive/20",
  warning: "text-status-warning bg-status-warning/5 border-status-warning/20",
  info: "text-muted-foreground bg-muted/40 border-border/60",
};

/**
 * Render unificado dos warnings operacionais da integração Hermes/APOIO.
 * Sempre consome `resolveIntegrationWarnings()` — não duplicar lógica em telas.
 */
const IntegrationWarningsList = ({ warnings, maxVisible = 3, className = "" }: Props) => {
  const [expanded, setExpanded] = useState(false);
  if (!warnings.length) return null;
  const visible = expanded ? warnings : warnings.slice(0, maxVisible);
  const hidden = warnings.length - visible.length;
  return (
    <ul className={`space-y-1 ${className}`}>
      {visible.map((w) => {
        const Icon = ICON[w.severity];
        return (
          <li
            key={w.id}
            className={`flex items-start gap-1.5 px-2.5 py-1.5 rounded-md border text-[11px] ${TONE[w.severity]}`}
            title={w.hint || undefined}
          >
            <Icon className="h-3 w-3 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="font-medium leading-tight">{w.message}</div>
              {w.hint && (
                <div className="text-[10px] opacity-80 mt-0.5 leading-tight">{w.hint}</div>
              )}
            </div>
          </li>
        );
      })}
      {warnings.length > maxVisible && (
        <li>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? "Recolher" : `+${hidden} ${hidden === 1 ? "alerta" : "alertas"}`}
          </button>
        </li>
      )}
    </ul>
  );
};

export default IntegrationWarningsList;
