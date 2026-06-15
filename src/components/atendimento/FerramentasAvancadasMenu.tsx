/**
 * FerramentasAvancadasMenu — "Ferramentas avançadas"
 * --------------------------------------------------
 * Dropdown único que agrupa pontos de entrada de:
 *  - OCR (Ler requisição)
 *  - IA (Avaliação IA)
 *  - Soroteca (reutilização de amostras)
 *  - Reaproveitamento de amostras
 *
 * Não altera handlers, validações, autosave ou stores: somente
 * consolida pontos de entrada existentes ou os apresenta como
 * informação contextual (Soroteca e Reaproveitamento são
 * acionados automaticamente ao adicionar exames).
 */
import { Wrench, FileScan, Sparkles, FlaskConical, Recycle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  onAbrirOCR: () => void;
  onAbrirIA: () => void;
}

export function FerramentasAvancadasMenu({ onAbrirOCR, onAbrirIA }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 transition-all"
          title="Ferramentas avançadas (OCR, IA, Soroteca, Reaproveitamento)"
        >
          <Wrench className="h-4 w-4" />
          Ferramentas avançadas
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Ferramentas avançadas</DropdownMenuLabel>
        <DropdownMenuItem onClick={onAbrirOCR}>
          <FileScan className="h-4 w-4 mr-2 text-primary" />
          <div className="flex flex-col">
            <span>Ler requisição (OCR)</span>
            <span className="text-[10px] text-muted-foreground">Foto ou PDF</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onAbrirIA}>
          <Sparkles className="h-4 w-4 mr-2 text-primary" />
          <div className="flex flex-col">
            <span>Avaliação IA</span>
            <span className="text-[10px] text-muted-foreground">Sugestão de exames</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wide">Automáticos</DropdownMenuLabel>
        <DropdownMenuItem disabled>
          <FlaskConical className="h-4 w-4 mr-2 text-warning" />
          <div className="flex flex-col">
            <span>Soroteca</span>
            <span className="text-[10px] text-muted-foreground">Ativada ao adicionar exame compatível</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <Recycle className="h-4 w-4 mr-2 text-muted-foreground" />
          <div className="flex flex-col">
            <span>Reaproveitamento de amostra</span>
            <span className="text-[10px] text-muted-foreground">Sugerido automaticamente</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default FerramentasAvancadasMenu;
