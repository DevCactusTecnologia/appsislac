// Componente extraído de ResultadoDetalhe.tsx (Fase 3 — slicing estrutural).
// Render tipado de input para um parâmetro científico, conforme o tipo
// declarado em `exame_parametros.tipo` (LayoutScientificRuntime — Fase 4).
//   • Select   → <select> com opcoesSelect
//   • Número   → <input type="number"> com step derivado de casasDecimais
//   • Formula  → input desabilitado (sem runtime de fórmula ainda)
//   • Texto    → <input type="text">
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ExameParametro } from "@/data/exameParametrosStore";

/**
 * Navegação por ENTER entre campos do resultado.
 * Procura o próximo elemento marcado com `data-result-nav="true"` na ordem
 * do DOM (inputs, selects e o botão SALVAR) e move o foco para ele.
 */
const focusNextResultField = (current: HTMLElement) => {
  const all = Array.from(
    document.querySelectorAll<HTMLElement>('[data-result-nav="true"]')
  ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
  const idx = all.indexOf(current);
  if (idx === -1) return;
  const next = all[idx + 1];
  if (next) {
    next.focus();
    if (next instanceof HTMLInputElement) next.select();
  }
};

export const ParamTypedInput = ({
  param,
  isCritico,
  disabled,
  className,
  onChange,
  computedValue,
  statusColor,
}: {
  param: { valor: string; tipo?: ExameParametro["tipo"]; opcoesSelect?: string[]; casasDecimais?: number; separadorDecimal?: "." | ","; qtdDigitos?: number; formatoExibicao?: "min_seg" | "hh_mm_ss" };
  isCritico?: boolean;
  disabled?: boolean;
  className?: string;
  onChange: (v: string) => void;
  /** Valor calculado (usado quando tipo === "Formula"). */
  computedValue?: string;
  /** Override de cor para indicar status semântico (ex.: contador OK/erro). */
  statusColor?: "success" | "warning" | "danger";
}) => {
  const statusClasses =
    statusColor === "success"
      ? "border-status-success/60 focus:ring-status-success focus:border-status-success text-status-success"
      : statusColor === "warning"
      ? "border-status-warning/60 focus:ring-status-warning focus:border-status-warning text-status-warning"
      : statusColor === "danger"
      ? "border-status-danger/60 focus:ring-status-danger focus:border-status-danger text-status-danger"
      : isCritico
      ? "border-status-danger/60 focus:ring-status-danger focus:border-status-danger text-status-danger"
      : "focus:ring-primary focus:border-primary";
  // Destaque forte no campo focado: ring inset (não é cortado por containers)
  // + borda primária + bg tintado. ring-inset garante que o contorno fique
  // dentro dos limites do próprio input, envolvendo o campo por completo.
  const base = `px-3 py-2 border-2 rounded-lg text-sm bg-background outline-none focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-offset-0 focus:bg-primary/10 focus:shadow-md font-semibold text-foreground transition-all ${statusClasses} ${className ?? ""}`;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      focusNextResultField(e.currentTarget);
    }
  };

  if (param.tipo === "Select" && (param.opcoesSelect?.length ?? 0) > 0) {
    return (
      <Select
        value={param.valor || undefined}
        onValueChange={(v) => onChange(v)}
        disabled={disabled}
      >
        <SelectTrigger
          data-result-nav="true"
          className={`h-10 rounded-lg bg-background font-semibold text-foreground justify-start text-left border-2 outline-none focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-primary focus:border-primary focus:bg-primary/10 focus:shadow-md transition-all ${
            isCritico
              ? "border-status-danger/60 ring-2 ring-status-danger/30 text-status-danger"
              : ""
          } ${className ?? ""}`}
        >
          <SelectValue placeholder="Selecione..." />
        </SelectTrigger>
        <SelectContent className="bg-popover text-popover-foreground">
          {param.opcoesSelect!.map((op) => (
            <SelectItem key={op} value={op} className="text-foreground">
              {op}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (param.tipo === "Tempo") {
    const formato = param.formatoExibicao === "hh_mm_ss" ? "hh_mm_ss" : "min_seg";
    // Persistência canônica:
    //  • "min_seg"   → "12 min 30 s" | "12 min" | "30 s" | ""
    //  • "hh_mm_ss"  → "HH:MM:SS" (zero-padded) | ""
    const parseStored = (raw: string): { h: string; m: string; s: string } => {
      if (!raw) return { h: "", m: "", s: "" };
      if (formato === "hh_mm_ss") {
        const m = raw.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
        if (m) return { h: m[1], m: m[2], s: m[3] };
        return { h: "", m: "", s: "" };
      }
      const minMatch = raw.match(/(\d+)\s*min/i);
      const segMatch = raw.match(/(\d+)\s*s/i);
      return { h: "", m: minMatch?.[1] ?? "", s: segMatch?.[1] ?? "" };
    };
    const buildStored = (h: string, m: string, s: string): string => {
      const clean = (v: string) => v.replace(/\D/g, "");
      h = clean(h); m = clean(m); s = clean(s);
      if (formato === "hh_mm_ss") {
        if (!h && !m && !s) return "";
        const pad = (v: string) => (v ? v.padStart(2, "0").slice(-2) : "00");
        return `${pad(h)}:${pad(m)}:${pad(s)}`;
      }
      const parts: string[] = [];
      if (m) parts.push(`${parseInt(m, 10)} min`);
      if (s) parts.push(`${parseInt(s, 10)} s`);
      return parts.join(" ");
    };
    const cur = parseStored(param.valor);
    const onPart = (key: "h" | "m" | "s", v: string) => {
      const next = { ...cur, [key]: v.replace(/\D/g, "") };
      onChange(buildStored(next.h, next.m, next.s));
    };
    const inputCls = `${base} w-16 text-center`;
    if (formato === "hh_mm_ss") {
      return (
        <div className="flex items-center gap-1.5">
          <input data-result-nav="true" inputMode="numeric" maxLength={2} value={cur.h}
            onChange={(e) => onPart("h", e.target.value)} onKeyDown={handleKeyDown}
            disabled={disabled} className={inputCls} placeholder="hh" />
          <span className="text-muted-foreground font-semibold">:</span>
          <input data-result-nav="true" inputMode="numeric" maxLength={2} value={cur.m}
            onChange={(e) => onPart("m", e.target.value)} onKeyDown={handleKeyDown}
            disabled={disabled} className={inputCls} placeholder="mm" />
          <span className="text-muted-foreground font-semibold">:</span>
          <input data-result-nav="true" inputMode="numeric" maxLength={2} value={cur.s}
            onChange={(e) => onPart("s", e.target.value)} onKeyDown={handleKeyDown}
            disabled={disabled} className={inputCls} placeholder="ss" />
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2">
        <input data-result-nav="true" inputMode="numeric" maxLength={3} value={cur.m}
          onChange={(e) => onPart("m", e.target.value)} onKeyDown={handleKeyDown}
          disabled={disabled} className={inputCls} placeholder="0" />
        <span className="text-xs font-semibold text-muted-foreground">min</span>
        <input data-result-nav="true" inputMode="numeric" maxLength={2} value={cur.s}
          onChange={(e) => onPart("s", e.target.value)} onKeyDown={handleKeyDown}
          disabled={disabled} className={inputCls} placeholder="0" />
        <span className="text-xs font-semibold text-muted-foreground">s</span>
      </div>
    );
  }
  if (param.tipo === "Formula") {
    // Campos calculados não recebem foco/navegação — são pulados pelo ENTER.
    return (
      <input
        type="text"
        value={computedValue ?? ""}
        readOnly
        disabled
        placeholder="—"
        className={`${base} bg-muted/40 cursor-not-allowed`}
        title="Calculado automaticamente"
      />
    );
  }
  if (param.tipo === "Número") {
    const casas = typeof param.casasDecimais === "number" ? param.casasDecimais : 2;
    // Regra numérica brasileira: vírgula como separador decimal por padrão.
    const sep: "." | "," = param.separadorDecimal === "." ? "." : ",";
    const totalDig = typeof param.qtdDigitos === "number" ? param.qtdDigitos : 0;
    const maxIntDig = totalDig > 0 ? Math.max(0, totalDig - casas) : Infinity;
    // Máscara automática estilo "calculadora": apenas dígitos são aceitos e o
    // separador decimal é inserido conforme a quantidade de casas configurada.
    // Ex.: casas=1, digita "1081" → "108,1"; casas=2, digita "1081" → "10,81".
    const handleChange = (raw: string) => {
      const negative = raw.trim().startsWith("-");
      const digits = raw.replace(/\D/g, "");
      if (!digits) { onChange(negative ? "-" : ""); return; }
      let out: string;
      if (casas <= 0) {
        let intP = digits.replace(/^0+(?=\d)/, "");
        if (Number.isFinite(maxIntDig)) intP = intP.slice(-(maxIntDig as number));
        out = (negative ? "-" : "") + (intP || "0");
      } else {
        const maxTotal = Number.isFinite(maxIntDig) ? (maxIntDig as number) + casas : Infinity;
        const trimmed = Number.isFinite(maxTotal) ? digits.slice(-(maxTotal as number)) : digits;
        const padded = trimmed.padStart(casas + 1, "0");
        const intP = padded.slice(0, padded.length - casas).replace(/^0+(?=\d)/, "") || "0";
        const decP = padded.slice(padded.length - casas);
        out = (negative ? "-" : "") + intP + sep + decP;
      }
      onChange(out);
    };
    return (
      <input
        type="text"
        inputMode="decimal"
        data-result-nav="true"
        value={param.valor}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={base}
        placeholder={casas > 0 ? `0${sep}${"0".repeat(casas)}` : "0"}
      />
    );
  }
  return (
    <input
      type="text"
      data-result-nav="true"
      value={param.valor}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      className={base}
    />
  );
};

export default ParamTypedInput;
