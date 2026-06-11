import { useState, useRef, useEffect, useMemo, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

export interface ComboboxOption {
  value: string;
  label: string;
  hint?: string;
  /** Badge curto exibido à direita do label (ex.: "SBPC/ML", "Customizado"). */
  badge?: string;
  /** Tom visual do badge. Default: "neutral". */
  badgeTone?: "neutral" | "primary" | "success" | "muted";
}

interface ComboboxFieldProps {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  /** Permite valor livre (não presente nas opções). Default: true */
  allowCustom?: boolean;
  /** Como exibir o valor selecionado. Default: usa label da opção, senão o próprio value */
  displayValue?: (value: string) => string;
  className?: string;
  disabled?: boolean;
  /** Largura mínima da lista em px (útil quando o input é estreito). */
  minListWidth?: number;
}

const normalize = (s: string) =>
  (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const inputClass =
  "w-full px-3 py-2.5 bg-muted/30 border border-border/60 rounded-xl text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all duration-200 pr-9";

export function ComboboxField({
  value,
  onChange,
  options,
  placeholder = "Selecione ou digite",
  allowCustom = true,
  displayValue,
  className = "",
  disabled = false,
  minListWidth,
}: ComboboxFieldProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedLabel = useMemo(() => {
    if (displayValue) return displayValue(value);
    const found = options.find((o) => o.value === value);
    return found ? found.label : value;
  }, [value, options, displayValue]);

  // Sincroniza input com valor externo quando fechado
  useEffect(() => {
    if (!open) setQuery(selectedLabel);
  }, [selectedLabel, open]);

  // Posiciona o dropdown via portal (evita clipping pelo overflow do dialog)
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = inputRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      commitOnBlur();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q || query === selectedLabel) return options;
    return options.filter((o) => normalize(o.label).includes(q) || normalize(o.value).includes(q));
  }, [query, options, selectedLabel]);

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  const select = (opt: ComboboxOption) => {
    onChange(opt.value);
    setQuery(opt.label);
    setOpen(false);
    inputRef.current?.blur();
  };

  const commitOnBlur = () => {
    const trimmed = query.trim();
    if (!trimmed) {
      onChange("");
    } else {
      const exact = options.find(
        (o) => normalize(o.label) === normalize(trimmed) || normalize(o.value) === normalize(trimmed),
      );
      if (exact) {
        onChange(exact.value);
        setQuery(exact.label);
      } else if (allowCustom) {
        onChange(trimmed);
      } else {
        setQuery(selectedLabel);
      }
    }
    setOpen(false);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && filtered[highlight]) {
        select(filtered[highlight]);
      } else {
        commitOnBlur();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setQuery(selectedLabel);
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="text"
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        onFocus={() => {
          setOpen(true);
          if (query === selectedLabel) setQuery("");
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!open) setOpen(true);
        }}
        onKeyDown={handleKey}
        className={inputClass}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
      />
      <ChevronDown
        className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
        aria-hidden
      />
      {open && position &&
        createPortal(
          <div
            ref={listRef}
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              width: Math.max(position.width, minListWidth ?? 0),
              zIndex: 9999,
            }}
            className="max-h-64 overflow-auto rounded-xl border border-border/70 bg-popover shadow-lg"
          >
            {filtered.length > 0 ? (
              filtered.map((opt, idx) => {
                const active = idx === highlight;
                const selected = opt.value === value;
                const badgeToneClass =
                  opt.badgeTone === "primary"
                    ? "bg-primary/10 text-primary border-primary/20"
                    : opt.badgeTone === "success"
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400"
                      : opt.badgeTone === "muted"
                        ? "bg-muted text-muted-foreground border-border/60"
                        : "bg-foreground/5 text-foreground/70 border-border/60";
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      select(opt);
                    }}
                    onMouseEnter={() => setHighlight(idx)}
                    className={`w-full text-left px-3 py-2 text-[12.5px] flex items-center gap-2 transition-colors ${
                      active ? "bg-muted text-foreground" : "text-foreground/90"
                    }`}
                  >
                    <Check
                      className={`h-3.5 w-3.5 shrink-0 ${selected ? "text-primary" : "text-transparent"}`}
                    />
                    <span className="flex-1 truncate">{opt.label}</span>
                    {opt.badge && (
                      <span
                        className={`shrink-0 px-1.5 py-0.5 rounded-md text-[9.5px] font-medium border tracking-wide ${badgeToneClass}`}
                      >
                        {opt.badge}
                      </span>
                    )}
                    {opt.hint && (
                      <span className="text-[10px] text-muted-foreground shrink-0">{opt.hint}</span>
                    )}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-2.5 text-[11.5px] text-muted-foreground">
                {allowCustom ? `Pressione Enter para usar "${query.trim()}"` : "Nenhum resultado"}
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

export default ComboboxField;
