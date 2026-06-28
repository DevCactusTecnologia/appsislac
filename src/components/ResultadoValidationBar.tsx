import { CheckCircle2, AlertCircle } from "lucide-react";

interface ResultadoValidationBarProps {
  valor: string;
  refMin: string;
  refMax: string;
}

/**
 * Converte uma string de tempo nos formatos suportados para segundos totais.
 * Aceita:
 *   • "HH:MM:SS"        → H*3600 + M*60 + S
 *   • "MM:SS"           → M*60 + S
 *   • "X min Y s"       → X*60 + Y (qualquer parte opcional)
 *   • "12 s"            → 12
 *   • "12 min"          → 720
 * Retorna null se não reconhecer um padrão de tempo.
 */
const parseTimeToSeconds = (raw: string): number | null => {
  if (!raw) return null;
  const s = raw.trim();
  // HH:MM:SS
  let m = s.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
  if (m) return parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseInt(m[3], 10);
  // MM:SS
  m = s.match(/^(\d{1,2}):(\d{1,2})$/);
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  // "X min Y s" — ambas as partes opcionais, mas pelo menos uma presente
  const minMatch = s.match(/(\d+)\s*min/i);
  const segMatch = s.match(/(\d+)\s*s(?:eg)?\b/i);
  if (minMatch || segMatch) {
    const mins = minMatch ? parseInt(minMatch[1], 10) : 0;
    const segs = segMatch ? parseInt(segMatch[1], 10) : 0;
    return mins * 60 + segs;
  }
  return null;
};

const parseNumericValue = (val: string): number | null => {
  const t = parseTimeToSeconds(val);
  if (t !== null) return t;
  const cleaned = val.replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};

const parseRef = (ref: string): number | null => {
  const t = parseTimeToSeconds(ref);
  if (t !== null) return t;
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
