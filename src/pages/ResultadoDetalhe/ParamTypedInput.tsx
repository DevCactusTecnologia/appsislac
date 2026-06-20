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
  param: { valor: string; tipo?: ExameParametro["tipo"]; opcoesSelect?: string[]; casasDecimais?: number };
  isCritico?: boolean;
  disabled?: boolean;
  className?: string;
  onChange: (v: string) => void;
  /** Valor calculado (usado quando tipo === "Formula"). */
  computedValue?: string;
  /** Override de cor para indicar status semântico (ex.: contador OK/erro). */
  statusColor?: "success" | "danger";
}) => {
  const statusClasses =
    statusColor === "success"
      ? "border-status-success/60 ring-2 ring-status-success/30 text-status-success"
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
    const step = casas > 0 ? `0.${"0".repeat(Math.max(0, casas - 1))}1` : "1";
    return (
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={param.valor}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={base}
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
