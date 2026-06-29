import { useState, useMemo, useRef, useEffect, type ComponentType } from "react";
import { Search, User, X } from "lucide-react";
import { normalize } from "./MapaConstants";

interface Props {
  value: string;
  query: string;
  onQueryChange: (q: string) => void;
  onSelect: (name: string) => void;
  onClear: () => void;
  /** Lista real de analistas (do runtime). Sem fallback mock. */
  analistas?: string[];
  placeholder?: string;
  emptyText?: string;
  ItemIcon?: ComponentType<{ className?: string }>;
}

const AnalistaAutocomplete = ({
  value,
  query,
  onQueryChange,
  onSelect,
  onClear,
  analistas = [],
  placeholder = "Digite o nome do analista...",
  emptyText = "Nenhum analista encontrado",
  ItemIcon = User,
}: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtrados = useMemo(() => {
    const q = normalize(query);
    if (!q) return analistas;
    return analistas.filter((a: string) => normalize(a).includes(q));
  }, [query, analistas]);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={query || value}
          onChange={(e) => { onQueryChange(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          placeholder="Digite o nome do analista..."
          className="pl-10 pr-9 py-2.5 w-full bg-muted/50 border-0 rounded-2xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
        />
        {(query || value) && (
          <button onClick={() => { onClear(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border/60 rounded-2xl shadow-xl z-50 overflow-hidden">
          {filtrados.length === 0 ? (
            <div className="px-4 py-4 text-center text-sm text-muted-foreground">Nenhum analista encontrado</div>
          ) : (
            <ul className="py-1.5 max-h-[200px] overflow-y-auto">
              {filtrados.map((a) => (
                <li key={a}>
                  <button
                    onClick={() => { onSelect(a); setIsOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-primary/5 transition-colors"
                  >
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="font-medium">{a}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default AnalistaAutocomplete;
