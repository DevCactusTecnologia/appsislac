/**
 * Idade utilities — parses BR date strings ("DD/MM/YYYY") and returns
 * a detailed age in years, months, and days.
 */

export function parseDataBR(dataBR: string): Date | null {
  if (!dataBR) return null;
  const m = dataBR.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Returns age formatted as "X anos, Y meses, Z dias".
 * Falls back to the raw string if the date can't be parsed.
 */
export function formatIdadeDetalhada(nascimento: string, ref: Date = new Date()): string {
  const birth = parseDataBR(nascimento);
  if (!birth) return nascimento ?? "";

  let years = ref.getFullYear() - birth.getFullYear();
  let months = ref.getMonth() - birth.getMonth();
  let days = ref.getDate() - birth.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonth = new Date(ref.getFullYear(), ref.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const parts: string[] = [];
  parts.push(`${years} ${years === 1 ? "Ano" : "Anos"}`);
  parts.push(`${months} ${months === 1 ? "mês" : "meses"}`);
  parts.push(`${days} ${days === 1 ? "dia" : "dias"}`);
  // Format as "X Anos, Y meses e Z dias"
  return `${parts[0]}, ${parts[1]} e ${parts[2]}`;
}

export function isAniversarioHoje(nascimento: string, ref: Date = new Date()): boolean {
  const birth = parseDataBR(nascimento);
  if (!birth) return false;
  return birth.getDate() === ref.getDate() && birth.getMonth() === ref.getMonth();
}

/**
 * Calcula faixas etárias do paciente a partir de uma data de nascimento (Date
 * já normalizado para meia-noite local) ou string `YYYY-MM-DD` / `DD/MM/YYYY`.
 *
 * Regras (fonte única de verdade — vide regra de Limite de Idade do projeto):
 *  - `isNewborn`: idade em dias entre 0 e 365 (inclusive) → exibir "Recém-nascido".
 *  - `isMinor`:   idade em anos < 18 e ≥ 0 → exibir bloco do responsável (opcional).
 *  - `isFuture`:  data de nascimento no futuro → não tratar como bebê nem menor.
 *  - `isInvalid`: sem data, data não-parseável ou idade > 150 anos.
 *
 * Datas em `YYYY-MM-DD` são fixadas em meia-noite local para evitar drift de
 * timezone que poderia "esticar" um RN para 366 dias.
 */
export type IdadeFaixa = {
  ageInDays: number;
  ageInYears: number;
  isNewborn: boolean;
  isMinor: boolean;
  isFuture: boolean;
  isInvalid: boolean;
};

const EMPTY_FAIXA: IdadeFaixa = {
  ageInDays: NaN,
  ageInYears: NaN,
  isNewborn: false,
  isMinor: false,
  isFuture: false,
  isInvalid: true,
};

function toLocalMidnight(input: Date | string | null | undefined): Date | null {
  if (!input) return null;
  if (input instanceof Date) {
    if (isNaN(input.getTime())) return null;
    return new Date(input.getFullYear(), input.getMonth(), input.getDate());
  }
  const s = String(input).trim();
  if (!s) return null;
  // YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  // DD/MM/YYYY
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
  return null;
}

export function calcAgeBuckets(
  input: Date | string | null | undefined,
  ref: Date = new Date(),
): IdadeFaixa {
  const birth = toLocalMidnight(input);
  if (!birth) return EMPTY_FAIXA;
  const refMid = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const ageInDays = Math.floor((refMid.getTime() - birth.getTime()) / 86_400_000);
  const ageInYears = ageInDays / 365.25;
  const isFuture = ageInDays < 0;
  const isInvalid = isFuture || ageInYears > 150;
  if (isInvalid) {
    return { ageInDays, ageInYears, isNewborn: false, isMinor: false, isFuture, isInvalid: true };
  }
  return {
    ageInDays,
    ageInYears,
    isNewborn: ageInDays >= 0 && ageInDays <= 365,
    isMinor: ageInYears >= 0 && ageInYears < 18,
    isFuture: false,
    isInvalid: false,
  };
}
