// Componente extraído de ResultadoDetalhe.tsx (Fase 3 — slicing estrutural).
// Render tipado de input para um parâmetro científico, conforme o tipo
// declarado em `exame_parametros.tipo` (LayoutScientificRuntime — Fase 4).
//   • Select   → <select> com opcoesSelect
//   • Número   → <input type="number"> com step derivado de casasDecimais
//   • Formula  → input desabilitado (sem runtime de fórmula ainda)
//   • Texto    → <input type="text">
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ExameParametro } from "@/data/exameParametrosStore";

export const ParamTypedInput = ({
  param,
  isCritico,
  disabled,
  className,
  onChange,
  computedValue,
  statusColor,
}: {
  param: { valor: string; tipo?: ExameParametro["tipo"]; opcoesSelect?: string[]; casasDecimais?: number; separadorDecimal?: "." | ","; qtdDigitos?: number };
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
      ? "border-status-success/60 ring-2 ring-status-success/30 text-status-success"
      : statusColor === "warning"
      ? "border-status-warning/60 ring-2 ring-status-warning/30 text-status-warning"
      : statusColor === "danger"
      ? "border-status-danger/60 ring-2 ring-status-danger/30 text-status-danger"
      : isCritico
      ? "border-status-danger/60 ring-2 ring-status-danger/30 text-status-danger"
      : "focus:ring-ring/20";
  const base = `px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 font-semibold text-foreground ${statusClasses} ${className ?? ""}`;
  if (param.tipo === "Select" && (param.opcoesSelect?.length ?? 0) > 0) {
    return (
      <Select
        value={param.valor || undefined}
        onValueChange={(v) => onChange(v)}
        disabled={disabled}
      >
        <SelectTrigger
          className={`h-10 rounded-lg bg-background font-semibold text-foreground justify-start text-left ${
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
  if (param.tipo === "Formula") {
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
    const handleChange = (raw: string) => {
      // mantém somente dígitos e o separador escolhido (ignora o outro)
      const other = sep === "." ? "," : ".";
      let cleaned = raw.replace(new RegExp(`[^0-9${sep === "." ? "\\." : ","}\\-]`, "g"), "");
      // converte separador alternativo digitado por engano
      cleaned = cleaned.split(other).join(sep);
      // só um separador
      const firstSep = cleaned.indexOf(sep);
      if (firstSep !== -1) {
        cleaned = cleaned.slice(0, firstSep + 1) + cleaned.slice(firstSep + 1).replace(new RegExp(sep === "." ? "\\." : ",", "g"), "");
      }
      // sinal "-" só no início
      cleaned = cleaned.replace(/(?!^)-/g, "");
      // limita partes
      const negative = cleaned.startsWith("-");
      const body = negative ? cleaned.slice(1) : cleaned;
      let [intP = "", decP = ""] = body.split(sep);
      if (Number.isFinite(maxIntDig)) intP = intP.slice(0, maxIntDig);
      if (casas >= 0) decP = decP.slice(0, casas);
      const out = (negative ? "-" : "") + intP + (body.includes(sep) ? sep + decP : "");
      onChange(out);
    };
    // Ao sair do campo, ajusta automaticamente para a quantidade de casas decimais
    // configurada, seguindo a regra numérica brasileira (vírgula como separador).
    const handleBlur = () => {
      const v = (param.valor ?? "").trim();
      if (!v) return;
      const negative = v.startsWith("-");
      const body = negative ? v.slice(1) : v;
      let [intP = "", decP = ""] = body.split(sep);
      if (!intP && !decP) return;
      if (casas > 0) {
        decP = (decP + "0".repeat(casas)).slice(0, casas);
      } else {
        decP = "";
      }
      const intNorm = intP.replace(/^0+(?=\d)/, "") || "0";
      const out = (negative ? "-" : "") + intNorm + (casas > 0 ? sep + decP : "");
      if (out !== v) onChange(out);
    };
    return (
      <input
        type="text"
        inputMode="decimal"
        value={param.valor}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        disabled={disabled}
        className={base}
        placeholder={casas > 0 ? `0${sep}${"0".repeat(casas)}` : "0"}
      />
    );
  }
  return (
    <input
      type="text"
      value={param.valor}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={base}
    />
  );
};

export default ParamTypedInput;
