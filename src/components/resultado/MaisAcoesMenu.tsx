/**
 * MaisAcoesMenu — "⋯ Mais ações"
 * --------------------------------
 * Dropdown único que agrupa as ações secundárias da tela ResultadoDetalhe:
 * Auditoria, Retificar, Cancelar análise, Recoleta, Crítico e Entrega.
 *
 * NÃO altera handlers, dialogs, impressão, PDF, lógica de negócio,
 * stores ou validações — apenas consolida pontos de entrada já existentes
 * em um único menu para reduzir carga cognitiva no cabeçalho.
 */
import { MoreHorizontal, ClipboardList, Edit, AlertTriangle, Send, FlaskConical, XCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  onAuditoria: () => void;
  onRetificar?: () => void;
  onCancelarAnalise?: () => void;
  onRecoleta?: () => void;
  onCritico?: () => void;
  onEntrega?: () => void;
  /** Envia o aviso "resultado pronto" via WhatsApp (modo manual). */
  onEnviarWhatsapp?: () => void;
  /** Quando true, mostra "Enviar WhatsApp" no menu. */
  podeEnviarWhatsapp?: boolean;
  /** Quando true, oculta as ações contextuais ao exame selecionado. */
  modoConsulta?: boolean;
  /** Quando true, desabilita ações que exigem exame selecionado. */
  semExameSelecionado?: boolean;
  canRetificar?: boolean;
  canCancelar?: boolean;
}

export function MaisAcoesMenu({
  onAuditoria,
  onRetificar,
  onCancelarAnalise,
  onRecoleta,
  onCritico,
  onEntrega,
  onEnviarWhatsapp,
  podeEnviarWhatsapp = false,
  modoConsulta = false,
  semExameSelecionado = false,
  canRetificar = true,
  canCancelar = true,
}: Props) {
  // Defer ação para após o Radix terminar de fechar o dropdown e restaurar pointer-events.
  // Sem isso, abrir um Dialog direto do onClick deixa a página "travada" (body com pointer-events:none).
  const run = (fn?: () => void) => {
    if (!fn) return;
    setTimeout(() => fn(), 0);
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold border border-border bg-card text-foreground hover:bg-accent transition-colors shrink-0"
          title="Mais ações"
          aria-label="Mais ações"
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">Mais ações</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Ações do atendimento</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => run(onAuditoria)}>
          <ClipboardList className="h-4 w-4 mr-2" />
          Auditoria
        </DropdownMenuItem>
        {!modoConsulta && onCritico && (
          <DropdownMenuItem onSelect={() => run(onCritico)}>
            <AlertTriangle className="h-4 w-4 mr-2 text-[hsl(var(--status-danger))]" />
            Comunicar valor crítico
          </DropdownMenuItem>
        )}
        {!modoConsulta && onEntrega && (
          <DropdownMenuItem onSelect={() => run(onEntrega)}>
            <Send className="h-4 w-4 mr-2" />
            Registrar entrega
          </DropdownMenuItem>
        )}
        {!modoConsulta && onEnviarWhatsapp && podeEnviarWhatsapp && (
          <DropdownMenuItem onSelect={() => run(onEnviarWhatsapp)}>
            <Send className="h-4 w-4 mr-2 text-[hsl(var(--status-success))]" />
            Enviar WhatsApp ao paciente
          </DropdownMenuItem>
        )}
        {!modoConsulta && (onRetificar || onRecoleta || onCancelarAnalise) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Exame selecionado</DropdownMenuLabel>
            {onRetificar && canRetificar && (
              <DropdownMenuItem onSelect={() => run(onRetificar)} disabled={semExameSelecionado}>
                <Edit className="h-4 w-4 mr-2" />
                Retificar
              </DropdownMenuItem>
            )}
            {onRecoleta && (
              <DropdownMenuItem onSelect={() => run(onRecoleta)} disabled={semExameSelecionado}>
                <FlaskConical className="h-4 w-4 mr-2 text-warning" />
                Solicitar recoleta
              </DropdownMenuItem>
            )}
            {onCancelarAnalise && canCancelar && (
              <DropdownMenuItem onSelect={() => run(onCancelarAnalise)} disabled={semExameSelecionado}>
                <XCircle className="h-4 w-4 mr-2 text-muted-foreground" />
                Cancelar análise
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


export default MaisAcoesMenu;
