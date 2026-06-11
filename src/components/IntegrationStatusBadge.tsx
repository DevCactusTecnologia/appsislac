import { resolveIntegrationStatus, TONE_BG_CLASS, type IntegrationStatus } from "@/lib/integration/integrationStatus";
import type { AtendimentoExameRow } from "@/data/atendimentoStore";
import { CheckCircle2, AlertCircle, Loader2, Send, FileCheck2, Clock, Inbox, FileDigit, AlertTriangle } from "lucide-react";

interface Props {
  /** Aceita o row inteiro OU um status já resolvido. */
  row?: Pick<AtendimentoExameRow, "status_externo" | "pdf_override_url">;
  status?: IntegrationStatus;
  /** Compacto: só dot + label, sem ícone. */
  compact?: boolean;
  className?: string;
}

const ICON_BY_KEY = {
  SEM_CONFIGURACAO: AlertCircle,
  AGUARDANDO_ENVIO: Clock,
  ENVIADO:          Send,
  PROCESSANDO:      Loader2,
  RETORNO_RECEBIDO: Inbox,
  PDF_IMPORTADO:    FileDigit,
  FINALIZADO:       CheckCircle2,
  FALHA:            AlertTriangle,
  OVERRIDE_MANUAL:  FileCheck2,
} as const;

/**
 * Badge unificado para status operacional da integração com apoio.
 * Usado em: ExamesTerceirizadosPanel, AtendimentoDetalheDialog, ResultadoDetalhe, timeline.
 */
const IntegrationStatusBadge = ({ row, status, compact, className }: Props) => {
  const resolved = status ?? (row ? resolveIntegrationStatus(row) : null);
  if (!resolved) return null;
  const Icon = ICON_BY_KEY[resolved.key] ?? AlertCircle;
  const spinning = resolved.key === "PROCESSANDO";

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold ${TONE_BG_CLASS[resolved.tone]} ${className ?? ""}`}
        title={resolved.label}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${TONE_BG_CLASS[resolved.tone].split(" ")[0].replace("/10", "")}`} />
        {resolved.label}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold ${TONE_BG_CLASS[resolved.tone]} ${className ?? ""}`}
      title={resolved.label}
    >
      <Icon className={`h-3 w-3 ${spinning ? "animate-spin" : ""}`} />
      {resolved.label}
    </span>
  );
};

export default IntegrationStatusBadge;