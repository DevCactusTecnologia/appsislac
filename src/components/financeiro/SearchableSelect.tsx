import { useState, useMemo, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Plus, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

interface Props {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder?: string;
  allowCreate?: boolean;
  className?: string;
  triggerClassName?: string;
  size?: "sm" | "md";
  /** Subconjunto de `options` que pode ser excluído pelo usuário (mostra ícone X). */
  deletableOptions?: string[];
  /** Callback chamado ao remover uma opção deletável. */
  onDelete?: (val: string) => void;
  /**
   * Se fornecido, sobrescreve o comportamento padrão de "criar inline".
   * Ao clicar em "Criar X", chama esta função com o texto digitado em vez
   * de invocar `onChange`. Use para abrir um mini modal de cadastro.
   */
  onCreateRequest?: (typed: string) => void;
}

const SearchableSelect = ({
  value,
  onChange,
  options,
  placeholder = "Selecione",
  allowCreate = false,
  className,
  triggerClassName,
  size = "md",
  deletableOptions,
  onDelete,
  onCreateRequest,
}: Props) => {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; width: number; maxHeight: number; placement: "bottom" | "top" } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setIsOpen(false);
      setQuery("");
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Reposiciona o dropdown via portal (evita clipping de overflow).
  // Faz auto-flip: se não houver espaço abaixo, abre acima.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const update = () => {
      const rect = inputRef.current?.getBoundingClientRect();
      if (!rect) return;
      const minWidth = Math.max(rect.width, 240);
      const width = Math.min(minWidth, 380);
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      let left = rect.left;
      if (left + width > viewportWidth - 8) left = Math.max(8, viewportWidth - width - 8);

      const GAP = 4;
      const PREFERRED = 224; // 14rem (max-h-56)
      const MIN = 140;
      const spaceBelow = viewportHeight - rect.bottom - 8;
      const spaceAbove = rect.top - 8;

      let placement: "bottom" | "top" = "bottom";
      let top = rect.bottom + GAP;
      let maxHeight = Math.min(PREFERRED, spaceBelow - GAP);

      // Abre acima se espaço abaixo é pequeno e há mais espaço acima
      if (spaceBelow < MIN && spaceAbove > spaceBelow) {
        placement = "top";
        maxHeight = Math.min(PREFERRED, spaceAbove - GAP);
        top = Math.max(8, rect.top - GAP - maxHeight);
      }
      setPosition({ top, left, width, maxHeight: Math.max(MIN, maxHeight), placement });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [isOpen]);

  const filtered = useMemo(() => {
    if (!query) return options;
    const q = normalize(query);
    return options.filter(o => normalize(o).includes(q));
  }, [options, query]);

  const exactMatch = useMemo(
    () => options.some(o => normalize(o) === normalize(query.trim())),
    [options, query],
  );
  const canCreate = allowCreate && query.trim().length > 0 && !exactMatch;

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setQuery("");
  };

  const handleCreate = (typed: string) => {
    setIsOpen(false);
    setQuery("");
    if (onCreateRequest) {
      onCreateRequest(typed);
    } else {
      onChange(typed);
    }
  };

  const display = isOpen ? query : value;
  const heightClass = size === "sm" ? "h-9 text-xs" : "h-10 text-sm";

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={display}
          placeholder={placeholder}
          onFocus={() => { setIsOpen(true); setQuery(""); }}
          onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
          onKeyDown={e => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (filtered.length > 0) handleSelect(filtered[0]);
              else if (canCreate) handleCreate(query.trim());
            } else if (e.key === "Escape") {
              setIsOpen(false); setQuery("");
            }
          }}
          className={cn(
            "w-full pl-3 pr-8 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all",
            heightClass,
            triggerClassName,
          )}
        />
        <ChevronDown
          className={cn(
            "absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </div>
      {isOpen && position &&
        createPortal(
          <div
            ref={listRef}
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              width: position.width,
              maxHeight: position.maxHeight,
              zIndex: 9999,
            }}
            className="overflow-y-auto rounded-xl border border-border bg-popover shadow-xl"
          >
            {filtered.length === 0 && !canCreate ? (
              <div className="px-3 py-2 text-xs text-muted-foreground text-center">Nenhum resultado</div>
            ) : (
              <>
                {filtered.map(opt => {
                  const canDelete = !!onDelete && (deletableOptions?.includes(opt) ?? false);
                  return (
                    <div
                      key={opt}
                      className={cn(
                        "group/opt flex items-center hover:bg-accent transition-colors",
                        value === opt && "bg-accent/60",
                      )}
                    >
                      <button
                        type="button"
                        onMouseDown={e => { e.preventDefault(); handleSelect(opt); }}
                        className={cn(
                          "flex-1 text-left px-3 py-2 text-sm flex items-center justify-between gap-2",
                          value === opt && "font-medium text-foreground",
                        )}
                      >
                        <span className="break-words leading-snug">{opt}</span>
                        {value === opt && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          aria-label={`Remover ${opt}`}
                          onMouseDown={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            onDelete?.(opt);
                          }}
                          className="shrink-0 p-1.5 mr-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover/opt:opacity-100 transition-opacity"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
                {canCreate && (
                  <button
                    type="button"
                    onMouseDown={e => { e.preventDefault(); handleCreate(query.trim()); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2 border-t border-border/40 text-primary font-medium"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span className="truncate">Criar &ldquo;{query.trim()}&rdquo;</span>
                  </button>
                )}
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
};

export default SearchableSelect;
