// Badge visual reaproveitável para destino do exame (INTERNO ou Lab Apoio).
// Usa cor determinística por lab para que o usuário identifique pelo padrão visual.

import { Building2, FlaskConical } from "lucide-react";
import { resolveDestino, type TipoProcesso } from "@/lib/labApoio";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  tipoProcesso?: TipoProcesso | string | null;
  labApoioId?: string | null;
  labApoioNome?: string | null;
  /** Nome do laboratório próprio (tenant) — exibido em INTERNO. */
  laboratorioPropriaNome?: string | null;
  /** Mostra apenas a sigla (compacto). */
  compact?: boolean;
  /** Oculta a sigla, mostrando apenas o nome. */
  hideSigla?: boolean;
  className?: string;
}

const LabBadge = ({
  tipoProcesso,
  labApoioId,
  labApoioNome,
  laboratorioPropriaNome,
  compact = false,
  hideSigla = false,
  className = "",
}: Props) => {
  const dest = resolveDestino({
    tipoProcesso: tipoProcesso ?? "INTERNO",
    labApoioId,
    labApoioNome,
    laboratorioPropriaNome,
  });

  const Icon = dest.tipo === "INTERNO" ? FlaskConical : Building2;
  // Visual consistente: sempre sigla + opcional nome.
  // - compact: só sigla (com tooltip mostrando nome).
  // - desktop: sigla + nome truncado (tooltip mostra nome completo).
  const tipoLabel = dest.tipo === "INTERNO" ? "Interno" : "Apoio";
  const tooltipText = `${tipoLabel}: ${dest.label} (${dest.sigla})`;

  const badge = (
    <span
      className={`inline-flex items-center gap-1 rounded-md text-[10px] font-semibold px-2 py-0.5 max-w-full ${className}`}
      style={{ backgroundColor: dest.cor.bg, color: dest.cor.fg }}
      aria-label={tooltipText}
    >
      <Icon className="h-2.5 w-2.5 shrink-0" />
      {!hideSigla && <span className="font-bold tabular-nums">{dest.sigla}</span>}
      {!compact && (
        <span className="truncate max-w-[140px] font-medium opacity-90">
          {dest.label}
        </span>
      )}
    </span>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <div className="font-semibold">{dest.label}</div>
          <div className="text-muted-foreground text-[10px] mt-0.5">
            {tipoLabel} · sigla {dest.sigla}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default LabBadge;
