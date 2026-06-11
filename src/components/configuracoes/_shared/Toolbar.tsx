import { Search } from "lucide-react";
import { ReactNode } from "react";

interface ToolbarProps {
  /** Valor controlado da busca. Se omitido, o campo de busca não é renderizado. */
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  /** Conteúdo à esquerda da busca (ex.: pills/segmented). */
  leading?: ReactNode;
  /** Conteúdo à direita (ex.: filtros, contadores). */
  trailing?: ReactNode;
}

/**
 * Toolbar padrão das abas: pills/segmented à esquerda, busca centralizada,
 * contadores/filtros à direita. Empilha em mobile.
 */
const Toolbar = ({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  leading,
  trailing,
}: ToolbarProps) => {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-3">
      {leading && <div className="flex flex-wrap gap-2">{leading}</div>}
      {searchValue !== undefined && onSearchChange && (
        <div className="relative flex-1 min-w-0 lg:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full h-9 pl-9 pr-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
          />
        </div>
      )}
      {trailing && (
        <div className="flex items-center gap-2 lg:ml-auto flex-wrap">
          {trailing}
        </div>
      )}
    </div>
  );
};

export default Toolbar;
