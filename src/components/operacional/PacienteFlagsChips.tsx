// SSOT visual para os chips de Prioridade clínica + Jejum do paciente.
// Exibidos abaixo do avatar (slot `belowAvatar`) do PacienteHeaderCard em
// Registrar Coleta, Analisar Amostra e Resultado.
//
// Mantém formato compacto (chip + dot) e tooltip; sem dependências externas.

import { cn } from "@/lib/utils";

export type PrioridadeClinica = "normal" | "urgencia" | "emergencia";

interface Props {
  jejum: boolean;
  prioridade?: PrioridadeClinica | null;
  className?: string;
}

const prioridadeConfig: Record<PrioridadeClinica, { label: string; chip: string; dot: string; title: string }> = {
  normal: {
    label: "Normal",
    chip: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/60",
    title: "Prioridade clínica: Normal",
  },
  urgencia: {
    label: "Urgência",
    chip: "bg-status-warning/15 text-status-warning",
    dot: "bg-status-warning",
    title: "Prioridade clínica: Urgência",
  },
  emergencia: {
    label: "Emergência",
    chip: "bg-status-danger/15 text-status-danger",
    dot: "bg-status-danger",
    title: "Prioridade clínica: Emergência",
  },
};

export function PacienteFlagsChips({ jejum, prioridade, className }: Props) {
  const p = prioridadeConfig[prioridade ?? "normal"];
  return (
    <div className={cn("flex flex-row items-center gap-1.5", className)}>
      <span
        title={p.title}
        className={cn(
          "inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold border border-border",
          p.chip,
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", p.dot)} />
        {p.label}
      </span>
      <span
        title={jejum ? "Paciente em jejum" : "Jejum não informado"}
        className={cn(
          "inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold border border-border",
          jejum ? "bg-status-success/15 text-status-success" : "bg-status-warning/15 text-status-warning",
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", jejum ? "bg-status-success" : "bg-status-warning")} />
        Jejum: {jejum ? "Sim" : "Não"}
      </span>
    </div>
  );
}
