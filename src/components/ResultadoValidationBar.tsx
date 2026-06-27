import { CheckCircle2, AlertCircle } from "lucide-react";

interface ResultadoValidationBarProps {
  valor: string;
  refMin: string;
  refMax: string;
}

const parseNumericValue = (val: string): number | null => {
  const cleaned = val.replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};

const parseRef = (ref: string): number | null => {
  const cleaned = ref.replace(",", ".").replace("<", "").replace(">", "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};

export const isValueInRange = (valor: string, refMin: string, refMax: string): boolean | null => {
  const v = parseNumericValue(valor);
  if (v === null) return null;
  const min = parseRef(refMin);
  const max = parseRef(refMax);
  if (min !== null && max !== null) return v >= min && v <= max;
  // Apenas limite superior (ex.: "Inferior a 6,0") → normal se v <= max
  if (max !== null && min === null) return v <= max;
  // Apenas limite inferior (ex.: "Superior a X") → normal se v >= min
  if (min !== null && max === null) return v >= min;
  if (refMin.includes("<") && max !== null) return v < max;
  if (refMin.includes(">") && max !== null) return v > max;
  return null;
};

const ResultadoValidationBar = ({ valor, refMin, refMax }: ResultadoValidationBarProps) => {
  const inRange = isValueInRange(valor, refMin, refMax);

  if (inRange === null) return null;

  return (
    <div className="flex items-center gap-2">
      {inRange ? (
        <CheckCircle2 className="h-4.5 w-4.5 text-status-success shrink-0" />
      ) : (
        <AlertCircle className="h-4.5 w-4.5 text-status-danger shrink-0" />
      )}
      <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${inRange ? "bg-status-success" : "bg-status-danger"}`}
          style={{ width: "100%" }}
        />
      </div>
    </div>
  );
};

export default ResultadoValidationBar;
