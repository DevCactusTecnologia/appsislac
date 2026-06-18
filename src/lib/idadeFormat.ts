// Conversão e formatação de faixas etárias (Anos/Meses/Dias) para exibição humana.
// Convenção: 1 ano = 365 dias, 1 mês = 30 dias (consistente com o resolver).

export type UnidadeIdade = "Anos" | "Meses" | "Dias";

export const idadeParaDias = (valor: string | number, unidade: UnidadeIdade): number => {
  const n = typeof valor === "number" ? valor : parseFloat(String(valor).replace(",", "."));
  if (!isFinite(n)) return 0;
  if (unidade === "Anos") return Math.round(n * 365);
  if (unidade === "Meses") return Math.round(n * 30);
  return Math.round(n);
};

/** Decompõe um total em dias em anos/meses/dias usando 365/30. */
export const diasParaYMD = (totalDias: number): { a: number; m: number; d: number } => {
  let t = Math.max(0, Math.round(totalDias));
  const a = Math.floor(t / 365); t -= a * 365;
  const m = Math.floor(t / 30);  t -= m * 30;
  return { a, m, d: t };
};

/** Formata uma idade (valor + unidade) como "Xa Ym Zd" — esconde componentes nulos. */
export const formatIdade = (valor: string | number | null | undefined, unidade: UnidadeIdade | string | null | undefined): string => {
  if (valor === null || valor === undefined || valor === "") return "";
  const u: UnidadeIdade = (unidade === "Meses" || unidade === "Dias" ? unidade : "Anos");
  const dias = idadeParaDias(valor, u);
  const { a, m, d } = diasParaYMD(dias);
  const parts: string[] = [];
  if (a) parts.push(`${a}a`);
  if (m) parts.push(`${m}m`);
  if (d) parts.push(`${d}d`);
  if (parts.length === 0) return "0d";
  return parts.join(" ");
};

/** Formata um intervalo [min, max] como "minFmt – maxFmt". */
export const formatFaixaIdade = (
  min: string | number | null | undefined,
  max: string | number | null | undefined,
  unidade: UnidadeIdade | string | null | undefined,
): string => {
  const a = formatIdade(min, unidade);
  const b = formatIdade(max, unidade);
  if (!a && !b) return "—";
  return `${a || "0d"} – ${b || "—"}`;
};
