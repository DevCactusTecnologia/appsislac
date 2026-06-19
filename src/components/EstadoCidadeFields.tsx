import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, MapPin } from "lucide-react";
import { createPortal } from "react-dom";
import {
  fetchEstados,
  fetchCidadesByUf,
  type Estado,
  type Cidade,
} from "@/data/geoStore";

interface EstadoCidadeFieldsProps {
  estado: string; // sigla UF (ex.: "SP")
  cidade: string; // nome da cidade
  onChange: (next: { estado: string; cidade: string }) => void;
  inputClassName?: string;
  labelClassName?: string;
  /** Renderiza só os inputs (sem labels) — útil para layouts customizados */
  hideLabels?: boolean;
  /** Tornar campo obrigatório (mostra *) */
  required?: boolean;
  disabled?: boolean;
  /** Classe extra aplicada ao wrapper da Cidade (ex.: "sm:col-span-2") */
  cidadeWrapperClassName?: string;
  /** Classe extra aplicada ao wrapper do Estado */
  estadoWrapperClassName?: string;
}

const norm = (s: string) =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

function Combobox({
  value,
  displayValue,
  options,
  onSelect,
  placeholder,
  inputClassName,
  disabled,
  loading,
  emptyHint,
}: {
  value: string;
  displayValue: string;
  options: { key: string; label: string; sub?: string }[];
  onSelect: (key: string, label: string) => void;
  placeholder: string;
  inputClassName: string;
  disabled?: boolean;
  loading?: boolean;
  emptyHint?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = norm(query);
    if (!q) return options.slice(0, 200);
    return options.filter((o) => norm(o.label).includes(q) || (o.sub && norm(o.sub).includes(q))).slice(0, 200);
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const updatePos = () => {
      const r = wrapRef.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    updatePos();
    const onScroll = () => updatePos();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target)) return;
      const dropdown = document.getElementById("estcid-dropdown");
      if (dropdown?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[highlight];
      if (opt) {
        onSelect(opt.key, opt.label);
        setQuery("");
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const shown = open ? query : displayValue;

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          value={shown}
          disabled={disabled}
          onFocus={() => {
            setQuery("");
            setOpen(true);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onKeyDown={handleKey}
          placeholder={placeholder}
          className={inputClassName}
        />
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
      </div>

      {open && pos && createPortal(
        <div
          id="estcid-dropdown"
          className="fixed z-[100] max-h-72 overflow-auto rounded-xl border border-border bg-popover shadow-lg"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          {loading ? (
            <div className="px-3 py-2.5 text-xs text-muted-foreground">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-2.5 text-xs text-muted-foreground">{emptyHint || "Nenhum resultado"}</div>
          ) : (
            filtered.map((o, i) => (
              <button
                key={o.key}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(o.key, o.label);
                  setQuery("");
                  setOpen(false);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 ${
                  highlight === i ? "bg-muted" : "hover:bg-muted/60"
                }`}
              >
                <span className="truncate">
                  {o.label}
                  {o.sub ? <span className="text-muted-foreground"> · {o.sub}</span> : null}
                </span>
                {o.label === displayValue && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
              </button>
            ))
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

export default function EstadoCidadeFields({
  estado,
  cidade,
  onChange,
  inputClassName = "w-full px-3 py-2.5 bg-muted/30 border border-border/60 rounded-xl text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all duration-200",
  labelClassName = "text-[11px] font-medium text-muted-foreground mb-1.5 block",
  hideLabels = false,
  required = false,
  disabled = false,
  cidadeWrapperClassName = "",
  estadoWrapperClassName = "",
}: EstadoCidadeFieldsProps) {
  const [estados, setEstados] = useState<Estado[]>([]);
  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [loadingCidades, setLoadingCidades] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchEstados().then((es) => alive && setEstados(es));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    if (!estado) {
      setCidades([]);
      return;
    }
    setLoadingCidades(true);
    fetchCidadesByUf(estado).then((cs) => {
      if (!alive) return;
      setCidades(cs);
      setLoadingCidades(false);
    });
    return () => {
      alive = false;
    };
  }, [estado]);

  const estadoOpts = useMemo(
    () => estados.map((e) => ({ key: e.uf, label: e.uf })),
    [estados]
  );
  const cidadeOpts = useMemo(
    () => cidades.map((c) => ({ key: c.code_ibge, label: c.name })),
    [cidades]
  );

  return (
    <>
      <div className={estadoWrapperClassName}>
        {!hideLabels && (
          <label className={labelClassName}>
            Estado{required ? " *" : ""}
          </label>
        )}
        <Combobox
          value={estado}
          displayValue={estado || ""}
          options={estadoOpts}
          onSelect={(uf) => onChange({ estado: uf, cidade: "" })}
          placeholder="UF"
          inputClassName={inputClassName}
          disabled={disabled}
        />
      </div>
      <div className={cidadeWrapperClassName}>
        {!hideLabels && (
          <label className={labelClassName}>
            Cidade{required ? " *" : ""}
          </label>
        )}
        <Combobox
          value={cidade}
          displayValue={cidade || ""}
          options={cidadeOpts}
          onSelect={(_key, label) => onChange({ estado, cidade: label })}
          placeholder={estado ? "Buscar cidade…" : "Selecione um estado primeiro"}
          inputClassName={inputClassName}
          disabled={disabled || !estado}
          loading={loadingCidades}
          emptyHint={estado ? "Nenhuma cidade encontrada" : "Selecione um estado primeiro"}
        />
      </div>
    </>
  );
}
