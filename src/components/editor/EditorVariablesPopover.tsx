// Botão "Adicionar variáveis" — padrão usado em todos os editores (Mapas,
// Documentos, Layouts). Recebe a lista de placeholders e a API do CKEditor
// para inserir a variável na posição atual do cursor.

import { useMemo, useState } from "react";
import { Braces, ChevronDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface VariableItem {
  tag: string;        // ex.: "paciente.nome" → insere {{paciente.nome}}
  label: string;
  group: string;
  description?: string;
}

interface Props {
  items: VariableItem[];
  onInsert: (tag: string) => void;
  disabled?: boolean;
  className?: string;
}

const EditorVariablesPopover = ({ items, onInsert, disabled, className }: Props) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? items.filter(
          (i) =>
            i.tag.toLowerCase().includes(q) ||
            i.label.toLowerCase().includes(q) ||
            i.group.toLowerCase().includes(q),
        )
      : items;
    const map = new Map<string, VariableItem[]>();
    for (const it of filtered) {
      const arr = map.get(it.group) ?? [];
      arr.push(it);
      map.set(it.group, arr);
    }
    return Array.from(map.entries());
  }, [items, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          title="Inserir variável no editor"
          className={cn(
            "inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground px-2 h-7 rounded-md hover:bg-muted/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
            className,
          )}
        >
          <Braces className="h-3.5 w-3.5" />
          Adicionar variáveis
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="end">
        <div className="px-2.5 py-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar variável…"
              className="w-full h-8 pl-7 pr-2 bg-background border border-border rounded-md text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
            />
          </div>
        </div>
        <div className="max-h-[320px] overflow-auto p-1.5">
          {groups.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic px-2 py-3 text-center">
              Nenhuma variável encontrada.
            </p>
          ) : (
            groups.map(([group, list]) => (
              <div key={group} className="mb-1.5 last:mb-0">
                <p className="text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground/80 px-2 py-1">
                  {group}
                </p>
                <div className="flex flex-col gap-0.5">
                  {list.map((it) => (
                    <button
                      key={it.tag}
                      type="button"
                      onClick={() => {
                        onInsert(it.tag);
                        setOpen(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-md hover:bg-accent transition-colors group"
                      title={it.description}
                    >
                      <p className="text-[12px] font-medium text-foreground">{it.label}</p>
                      <p className="text-[10.5px] text-muted-foreground font-mono mt-0.5">
                        {`{{${it.tag}}}`}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default EditorVariablesPopover;
