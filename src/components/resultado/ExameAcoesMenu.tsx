/**
 * ExameAcoesMenu — "⋯" no card do exame
 * --------------------------------------
 * Agrupa ações cujo escopo é o EXAME selecionado: Retificar,
 * Solicitar recoleta e Cancelar análise. Antes essas ações viviam no
 * "Mais ações" do card do paciente, gerando dispersão e duplicação
 * (Retificar aparecia em dois lugares). Mover para o card do exame
 * aproxima a ação do contexto sobre o qual ela atua.
 */
import { MoreHorizontal, Edit, FlaskConical, XCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  onRetificar?: () => void;
  onRecoleta?: () => void;
  onCancelarAnalise?: () => void;
  canRetificar?: boolean;
  canCancelar?: boolean;
  size?: "sm" | "md";
}

export function ExameAcoesMenu({
  onRetificar,
  onRecoleta,
  onCancelarAnalise,
  canRetificar = false,
  canCancelar = false,
  size = "md",
}: Props) {
  // Defer ação para após o Radix fechar e restaurar pointer-events.
  const run = (fn?: () => void) => {
    if (!fn) return;
    setTimeout(() => fn(), 0);
  };

  const showRetificar = !!onRetificar && canRetificar;
  const showRecoleta = !!onRecoleta;
  const showCancelar = !!onCancelarAnalise && canCancelar;

  // Se não há nenhuma ação disponível, não renderiza o trigger.
  if (!showRetificar && !showRecoleta && !showCancelar) return null;

  const triggerCls =
    size === "sm"
      ? "h-8 w-8 text-xs"
      : "h-9 w-9 text-sm";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center justify-center ${triggerCls} rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors`}
          title="Ações do exame"
          aria-label="Ações do exame"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Ações do exame</DropdownMenuLabel>
        {showRetificar && (
          <DropdownMenuItem onSelect={() => run(onRetificar)}>
            <Edit className="h-4 w-4 mr-2" />
            Retificar
          </DropdownMenuItem>
        )}
        {showRecoleta && (
          <DropdownMenuItem onSelect={() => run(onRecoleta)}>
            <FlaskConical className="h-4 w-4 mr-2 text-warning" />
            Solicitar recoleta
          </DropdownMenuItem>
        )}
        {(showRetificar || showRecoleta) && showCancelar && <DropdownMenuSeparator />}
        {showCancelar && (
          <DropdownMenuItem onSelect={() => run(onCancelarAnalise)}>
            <XCircle className="h-4 w-4 mr-2 text-muted-foreground" />
            Cancelar análise
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ExameAcoesMenu;
