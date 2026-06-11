// Parser heurístico para extrair faixas estruturadas de "Valor de referência (texto descritivo)".
// Entrada: texto livre (geralmente importado de layouts legados, segmentado por "|").
// Saída: lista de candidatos { sexo, idadeMin, idadeMax, unidadeIdade, valorMin, valorMax, unidade, descricao }.
//
// Cobre padrões comuns: "Homens: 2,5 a 7,0 mg/dL", "Até 100 mg/dL", "Inferior a 8 UI/ml",
// ">40 mg/dL", "70 - 99 mg/dL", "Recém-nascido: 30 a 90", "2 a 19 anos: ...".

export interface FaixaCandidato {
  sexo: "Ambos" | "Masculino" | "Feminino";
  idadeMin: string;
  idadeMax: string;
  unidadeIdade: "Anos" | "Meses" | "Dias";
  valorMin: string;
  valorMax: string;
  unidade: string;
  descricao: string;
  origem: string; // trecho original
}

const UNIDADES = [
  "mg/dL", "mg/dl", "g/dL", "g/dl", "g/L", "g/l", "mcg/dL", "mcg/dl", "ug/dL", "ug/dl",
  "ug/L", "ug/l", "ng/mL", "ng/ml", "pg/mL", "pg/ml", "U/L", "u/l", "UI/mL", "UI/ml",
  "mUI/mL", "mIU/mL", "mEq/L", "mEq/Litro", "mmol/L", "umol/L", "fL", "pg",
  "%", "milhões/mm³", "milhões/mm3", "/mm³", "/mm3", "mm/1h", "mm/h",
  "segundos", "Minutos", "minutos", "mL/min/1,73m2", "mL/min/1.7m2", "mL/min", "ml/min",
];

const detectarSexo = (txt: string): "Ambos" | "Masculino" | "Feminino" => {
  const t = txt.toLowerCase();
  if (/\b(homens?|masculino|homem)\b/.test(t)) return "Masculino";
  if (/\b(mulheres?|feminino|mulher)\b/.test(t)) return "Feminino";
  return "Ambos";
};

const detectarUnidade = (txt: string): string => {
  for (const u of UNIDADES.sort((a, b) => b.length - a.length)) {
    if (txt.includes(u)) return u;
  }
  return "";
};

const detectarIdade = (
  txt: string,
): { idadeMin: string; idadeMax: string; unidadeIdade: "Anos" | "Meses" | "Dias" } => {
  const t = txt.toLowerCase();
  // "X a Y anos" / "X - Y anos"
  const m = t.match(/(\d+)\s*(?:a|-|–|até)\s*(\d+)\s*(anos?|meses?|m[eê]s|dias?)/);
  if (m) {
    const u = m[3].startsWith("ano") ? "Anos" : m[3].startsWith("dia") ? "Dias" : "Meses";
    return { idadeMin: m[1], idadeMax: m[2], unidadeIdade: u };
  }
  if (/rec[eé]m[- ]?nascido|neonato/.test(t)) return { idadeMin: "0", idadeMax: "1", unidadeIdade: "Meses" };
  if (/lactante|lactente/.test(t)) return { idadeMin: "1", idadeMax: "24", unidadeIdade: "Meses" };
  if (/crian[cç]a|pedi[áa]trico/.test(t)) return { idadeMin: "0", idadeMax: "12", unidadeIdade: "Anos" };
  if (/adolescente/.test(t)) return { idadeMin: "12", idadeMax: "18", unidadeIdade: "Anos" };
  if (/adulto/.test(t)) return { idadeMin: "18", idadeMax: "120", unidadeIdade: "Anos" };
  return { idadeMin: "0", idadeMax: "120", unidadeIdade: "Anos" };
};

const NUM = "[+-]?\\d+(?:[.,]\\d+)?";

const extrairValores = (txt: string): { valorMin: string; valorMax: string } | null => {
  // "X a Y" / "X - Y" / "X – Y" — evita capturar idades já capturadas
  let m = txt.match(new RegExp(`(${NUM})\\s*(?:a|-|–|até)\\s*(${NUM})`));
  if (m) {
    // descarta se logo após vier "anos|meses|dias" (é idade)
    const after = txt.slice((m.index ?? 0) + m[0].length).trim().toLowerCase();
    if (!/^(anos?|meses?|m[eê]s|dias?)/.test(after)) {
      return { valorMin: m[1], valorMax: m[2] };
    }
  }
  // "Até X" / "Inferior a X" / "< X" / "Menor que X"
  m = txt.match(new RegExp(`(?:at[eé]|inferior\\s+a|menor\\s+(?:que|a)|<\\s*=?)\\s*(${NUM})`, "i"));
  if (m) return { valorMin: "0", valorMax: m[1] };
  // "Superior a X" / "> X" / "Maior que X" / "≥ X"
  m = txt.match(new RegExp(`(?:superior\\s+a|maior\\s+(?:que|a)|>\\s*=?|≥)\\s*(${NUM})`, "i"));
  if (m) return { valorMin: m[1], valorMax: "" };
  return null;
};

/**
 * Recebe o texto descritivo e retorna uma lista de faixas candidatas.
 * Segmenta por `|` (separador usado na importação) e por `;` / quebras de linha.
 */
export const parseValorReferencia = (
  texto: string,
  unidadeFallback = "",
): FaixaCandidato[] => {
  if (!texto || !texto.trim()) return [];
  // Separa em segmentos: "|", ";", quebra de linha
  const segmentos = texto
    .split(/[|;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // Detecta unidade global (no texto inteiro) como fallback
  const unidadeGlobal = detectarUnidade(texto) || unidadeFallback;

  const candidatos: FaixaCandidato[] = [];
  for (const seg of segmentos) {
    const valores = extrairValores(seg);
    if (!valores) continue;
    const sexo = detectarSexo(seg);
    const idade = detectarIdade(seg);
    const unidadeLocal = detectarUnidade(seg) || unidadeGlobal;
    // Descrição = trecho antes do ":" (se houver)
    const descMatch = seg.match(/^([^:]+):/);
    const descricao = descMatch ? descMatch[1].trim() : "";
    candidatos.push({
      sexo,
      idadeMin: idade.idadeMin,
      idadeMax: idade.idadeMax,
      unidadeIdade: idade.unidadeIdade,
      valorMin: valores.valorMin,
      valorMax: valores.valorMax,
      unidade: unidadeLocal,
      descricao,
      origem: seg,
    });
  }
  return candidatos;
};