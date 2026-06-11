// Shared design system — barra de busca + filtros + ações.
// Espelha o padrão do SuperAdminTenants:
//   [Search com ícone] [chips de filtro flat] [ações à direita]
// Sem lógica: cada página passa value/onChange e seus próprios chips/ações.

import { ReactNode } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ToolbarProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /** Chips de filtro / segmented controls à direita do search */
  filters?: ReactNode;
  /** Ações à direita (botões primários, export, etc.) */
  actions?: ReactNode;
  className?: string;
}

export function Toolbar({
  searchValue = "",
  onSearchChange,
  searchPlaceholder = "Buscar...",
  filters,
  actions,
  className,
}: ToolbarProps) {
  const showSearch = typeof onSearchChange === "function";
  return (
    <div
      className={cn(
        "flex flex-col lg:flex-row lg:items-center gap-3 mb-6",
        className,
      )}
    >
      {showSearch && (
        <div className="relative flex-1 min-w-0 max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
          <input
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full h-10 pl-9 pr-9 bg-card border border-border/60 rounded-xl text-[13px] text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-colors"
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => onSearchChange?.("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-md text-muted-foreground/70 hover:text-foreground hover:bg-accent/60 transition-colors"
              aria-label="Limpar busca"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {filters && (
        <div className="flex flex-wrap items-center gap-2">{filters}</div>
      )}

      {actions && (
        <div className="flex items-center gap-2 lg:ml-auto shrink-0">{actions}</div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Chip de filtro flat — padrão visual SA.
// ──────────────────────────────────────────────────────────────────

export interface FilterChipProps {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  /** Contador opcional à direita (ex: "12") */
  count?: number;
  className?: string;
}

export function FilterChip({ active, onClick, children, count, className }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 h-9 px-3 rounded-xl text-[12px] font-semibold border transition-colors",
        active
          ? "bg-primary/10 text-primary border-primary/30"
          : "bg-card text-muted-foreground border-border/60 hover:text-foreground hover:bg-accent/60",
        className,
      )}
    >
      {children}
      {typeof count === "number" && (
        <span
          className={cn(
            "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-md text-[10px] font-bold",
            active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
