// ============================================================================
// LayoutScientificRuntime — engine científica oficial do SISLAC
// ----------------------------------------------------------------------------
// Esta é a ÚNICA fonte oficial para:
//   • parsing de placeholders científicos (##CHAVE##)
//   • seleção dos parâmetros a apresentar na digitação (derivada do layout)
//   • leitura tolerante (dual-read) de resultados antigos no jsonb
//   • escrita canônica de resultados, indexada por chave do parâmetro
//   • auto-seed silencioso de layout padrão quando o exame não tem nenhum
//
// Filosofia (ver .lovable/memory/architecture/layout-vs-mapa.md):
//   Layout Científico = motor científico oficial.
//   Tela de digitação NÃO inventa campos — ela RENDERIZA o layout.
//   Apenas placeholders presentes no layout viram inputs.
//
// Sintaxe canônica oficial: ##CHAVE##
//   • Sintaxes legacy `{{x}}`, `{x}`, `#x` continuam sendo aceitas
//     pelo renderizador de impressão (laudoLayout.ts) para retro-
//     compatibilidade com layouts/snapshots antigos, MAS NÃO geram
//     inputs novos. Marcadas como LEGACY_RESERVED.
// ============================================================================

import { addLayout, getLayouts, loadLayouts, type ExameLayout } from "@/data/exameLayoutsStore";
import { type ExameParametro } from "@/data/exameParametrosStore";
import { buildLayoutTemplate } from "@/lib/laudoTemplate";

/**
 * Prefixos reservados para placeholders de SISTEMA (não são parâmetros analíticos).
 * Esses NUNCA viram input na tela de digitação.
 */
const SYSTEM_PREFIXES = [
  "REF_",
  "FLAG_",
  "UNID_",
  "PACIENTE_",
  "DATA_",
] as const;

const SYSTEM_EXACT = new Set(["PROTOCOLO", "SOLICITANTE"]);

/** Regex canônica oficial. Aceita letras, números, `_`, `-`, `+` e `.`
 *  (chaves reais incluem variações como `LEUCOC-2`, `REAGENTE++++`). */
const PARAM_PLACEHOLDER_RE = /##([A-Za-z0-9_+\-.]+)##/g;

const isSystemKey = (key: string): boolean => {
  const upper = key.toUpperCase();
  if (SYSTEM_EXACT.has(upper)) return true;
  return SYSTEM_PREFIXES.some((p) => upper.startsWith(p));
};

/**
 * Extrai as chaves de PARÂMETROS analíticos referenciadas no HTML do layout,
 * preservando a ordem de aparição (case-insensitive, deduplicado).
 */
export function extractParameterChaves(html: string): string[] {
  if (!html) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  PARAM_PLACEHOLDER_RE.lastIndex = 0;
  while ((m = PARAM_PLACEHOLDER_RE.exec(html)) !== null) {
    const key = m[1];
    if (isSystemKey(key)) continue;
    const upper = key.toUpperCase();
    if (seen.has(upper)) continue;
    seen.add(upper);
    out.push(key);
  }
  return out;
}

/**
 * Dado o HTML do layout padrão e a lista de parâmetros cadastrados do exame,
 * devolve apenas os parâmetros REFERENCIADOS no layout, na ordem em que
 * aparecem.
 *
 * Match é feito (case-insensitive) por: chave > abreviacao > rotulo.
 *
 * Quando NÃO houver layout (caso degenerado), devolve todos os parâmetros
 * visíveis. Isto é apenas defesa contra estados inconsistentes — o auto-seed
 * (`ensureDefaultLayout`) garante que sempre exista layout em produção.
 */
export function selectParametrosForLayout(
  layoutHtml: string | null | undefined,
  parametros: ExameParametro[],
): ExameParametro[] {
  const visiveis = parametros.filter((p) => p.visivel !== false);
  if (!layoutHtml) return visiveis;

  const chaves = extractParameterChaves(layoutHtml);
  if (chaves.length === 0) return [];

  const upper = (s: string) => (s ?? "").trim().toUpperCase();
  const byChave = new Map<string, ExameParametro>();
  for (const p of visiveis) {
    if (p.chave) byChave.set(upper(p.chave), p);
    if (p.abreviacao) byChave.set(upper(p.abreviacao), p);
    if (p.rotulo) byChave.set(upper(p.rotulo), p);
  }

  const out: ExameParametro[] = [];
  const used = new Set<number>();
  for (const k of chaves) {
    const p = byChave.get(upper(k));
    if (p && !used.has(p.id)) {
      out.push(p);
      used.add(p.id);
    }
  }
  return out;
}

/**
 * Leitura DUAL-READ tolerante de um valor de parâmetro a partir do jsonb
 * `atendimento_exames.resultados`.
 *
 * Ordem de tentativa (mantém compatibilidade com resultados antigos
 * indexados por nome/rótulo):
 *   1) chave (canônico oficial)
 *   2) rotulo
 *   3) abreviacao
 *   4) chave em UPPER
 *   5) rotulo em UPPER
 */
export function readParametroValor(
  resultados: Record<string, unknown> | null | undefined,
  p: Pick<ExameParametro, "chave" | "rotulo" | "abreviacao">,
): string {
  if (!resultados) return "";
  const tries: string[] = [
    p.chave ?? "",
    p.rotulo ?? "",
    p.abreviacao ?? "",
    (p.chave ?? "").toUpperCase(),
    (p.rotulo ?? "").toUpperCase(),
  ];
  for (const k of tries) {
    if (!k) continue;
    const v = resultados[k];
    let str: string | null = null;
    if (typeof v === "string" && v.length > 0) str = v;
    else if (typeof v === "number") str = String(v);
    if (str !== null) {
      return str;
    }
  }
  return "";
}

/**
 * Constrói o jsonb canônico para gravação em `atendimento_exames.resultados`.
 * Indexa SEMPRE pela chave do parâmetro (LayoutScientificRuntime escreve
 * apenas por chave; leitura segue dual-read para retro-compat).
 *
 * Se um parâmetro não tiver `chave` (caso degenerado), cai para `rotulo`.
 */
export function buildResultadosByChave(
  fields: Array<{ chave?: string; rotulo?: string; nome?: string }>,
  valoresPorIndice: string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  fields.forEach((f, idx) => {
    const k = (f.chave || f.rotulo || f.nome || "").trim();
    if (!k) return;
    out[k] = valoresPorIndice[idx] ?? "";
  });
  return out;
}

/**
 * Garante que o exame tenha um layout científico padrão.
 *
 * Se nenhum existir, gera silenciosamente via `buildLayoutTemplate` a partir
 * dos parâmetros cadastrados, marcando como `padrao = true`. Isto materializa
 * a regra oficial: TODO exame possui um layout — a tabela hardcoded do
 * fallback procedural está em soft-deprecate e não deve mais disparar em
 * cenários normais.
 *
 * Idempotente: se já existir qualquer layout, retorna o existente sem tocar.
 */
export async function ensureDefaultLayout(
  catalogoId: string,
  exameNome: string,
  parametros: ExameParametro[],
): Promise<ExameLayout | null> {
  const existentes = getLayouts(catalogoId);
  const layouts = existentes.length > 0 ? existentes : await loadLayouts(catalogoId);
  if (layouts.length > 0) {
    return layouts.find((l) => l.padrao) ?? layouts[0];
  }
  if (parametros.length === 0) {
    return null;
  }

  const conteudo = buildLayoutTemplate({ exameNome, parametros });
  const novo = await addLayout(catalogoId, {
    nome: "Layout padrão",
    conteudo,
    padrao: true,
    criadoPor: "system:auto-seed",
  });
  return novo;
}

/**
 * Pipeline completo de hidratação de UM exame para a tela de digitação:
 *   • garante layout padrão (auto-seed se preciso)
 *   • seleciona parâmetros referenciados pelo layout
 *   • dual-read dos valores já salvos
 *
 * Retorna a lista FINAL que a UI deve renderizar como inputs tipados.
 */
export interface InputParametroResolvido {
  parametro: ExameParametro;
  valor: string;
}

export async function hidratarParametrosParaDigitacao(
  catalogoId: string,
  exameNome: string,
  parametros: ExameParametro[],
  resultadosSalvos: Record<string, unknown> | null | undefined,
): Promise<InputParametroResolvido[]> {
  const layout = await ensureDefaultLayout(catalogoId, exameNome, parametros);
  const selecionados = selectParametrosForLayout(layout?.conteudo ?? null, parametros);
  return selecionados.map((p) => ({
    parametro: p,
    valor: readParametroValor(resultadosSalvos, p),
  }));
}

// ============================================================================
// Segmentos de digitação — preserva a ESTRUTURA VISUAL do layout
// ----------------------------------------------------------------------------
// Layouts científicos costumam organizar os parâmetros em SEÇÕES (ex.:
// "CARACTERÍSTICAS FÍSICAS", "MICROSCOPIA DO SEDIMENTO (400x)"). A tela de
// digitação deve refletir essa estrutura: para cada placeholder analítico
// emite um input; para cada bloco de texto entre placeholders emite um
// cabeçalho de seção, na ordem em que aparecem no layout.
// ============================================================================

export type DigitacaoSegmento =
  | { kind: "header"; text: string }
  | { kind: "param"; parametro: ExameParametro; valor: string };

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  Aacute: "Á", aacute: "á", Eacute: "É", eacute: "é",
  Iacute: "Í", iacute: "í", Oacute: "Ó", oacute: "ó",
  Uacute: "Ú", uacute: "ú", Atilde: "Ã", atilde: "ã",
  Otilde: "Õ", otilde: "õ", Ccedil: "Ç", ccedil: "ç",
  Acirc: "Â", acirc: "â", Ecirc: "Ê", ecirc: "ê",
  Ocirc: "Ô", ocirc: "ô", Agrave: "À", agrave: "à",
  ntilde: "ñ", Ntilde: "Ñ", Uuml: "Ü", uuml: "ü",
};

const decodeEntities = (s: string): string =>
  s
    .replace(/&([A-Za-z]+);/g, (m, name) => NAMED_ENTITIES[name] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));

const stripTagsToText = (s: string): string =>
  decodeEntities(
    s
      .replace(/##[A-Za-z0-9_+\-.]+##/g, " ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/(?:p|div|h[1-6]|li|tr|td|th)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();

const isLikelyHeader = (text: string, exameNome?: string): boolean => {
  if (!text || text.length < 3) return false;
  const letters = text.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (letters.length < 3) return false;
  // Tolerante a sufixos minúsculos (ex.: "MICROSCOPIA DO SEDIMENTO (400x)").
  // Aceita quando >= 3 letras maiúsculas e <= 3 letras minúsculas.
  const upperCount = (letters.match(/[A-ZÀ-Ÿ]/g) ?? []).length;
  const lowerCount = letters.length - upperCount;
  if (upperCount < 3) return false;
  if (lowerCount > 3) return false;
  // evita rótulos de boilerplate tipo "PACIENTE:" sozinhos
  if (/^[A-ZÀ-Ÿ]+:?\s*$/.test(text) && text.length <= 12) return false;
  if (exameNome && text.trim().toUpperCase() === exameNome.trim().toUpperCase()) return false;
  return true;
};

/**
 * Constrói a lista de segmentos para a tela de digitação a partir do HTML do
 * layout: intercala headers de seção (texto) e inputs de parâmetro, na ordem
 * em que aparecem no layout. Headers duplicados consecutivos são suprimidos.
 */
export function buildDigitacaoSegments(
  layoutHtml: string | null | undefined,
  parametros: ExameParametro[],
  resultadosSalvos: Record<string, unknown> | null | undefined,
  exameNome?: string,
): DigitacaoSegmento[] {
  const visiveis = parametros.filter((p) => p.visivel !== false);
  if (!layoutHtml) {
    return visiveis.map((p) => ({
      kind: "param",
      parametro: p,
      valor: readParametroValor(resultadosSalvos, p),
    }));
  }

  const upper = (s: string) => (s ?? "").trim().toUpperCase();
  const byKey = new Map<string, ExameParametro>();
  for (const p of visiveis) {
    if (p.chave) byKey.set(upper(p.chave), p);
    if (p.abreviacao) byKey.set(upper(p.abreviacao), p);
    if (p.rotulo) byKey.set(upper(p.rotulo), p);
  }

  const out: DigitacaoSegmento[] = [];
  const seenParams = new Set<number>();

  const pushHeader = (text: string) => {
    text = text.replace(/^\s+/, "");
    const last = out[out.length - 1];
    if (last && last.kind === "header" && last.text === text) return;
    out.push({ kind: "header", text });
  };

  const extractHeadersFrom = (chunk: string) => {
    if (!chunk) return;
    // 1) <h1..h6> — headings explícitos
    const reH = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi;
    let hm: RegExpExecArray | null;
    while ((hm = reH.exec(chunk)) !== null) {
      const t = stripTagsToText(hm[1]);
      if (t && (!exameNome || t.trim().toUpperCase() !== exameNome.trim().toUpperCase())) {
        pushHeader(t);
      }
    }
    // 2) blocos <p|div|strong|b|td> com texto totalmente em CAIXA ALTA
    const reBlock = /<(p|div|strong|b|td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    let bm: RegExpExecArray | null;
    while ((bm = reBlock.exec(chunk)) !== null) {
      const t = stripTagsToText(bm[2]);
      if (isLikelyHeader(t, exameNome)) pushHeader(t);
    }
  };

  const re = /##([A-Za-z0-9_+\-.]+)##/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(layoutHtml)) !== null) {
    extractHeadersFrom(layoutHtml.slice(lastIndex, m.index));
    const key = m[1];
    if (!isSystemKey(key)) {
      const p = byKey.get(upper(key));
      if (p && !seenParams.has(p.id)) {
        seenParams.add(p.id);
        out.push({
          kind: "param",
          parametro: p,
          valor: readParametroValor(resultadosSalvos, p),
        });
      }
    }
    lastIndex = m.index + m[0].length;
  }
  extractHeadersFrom(layoutHtml.slice(lastIndex));

  // Remove header trailing sem nenhum parâmetro depois
  while (out.length && out[out.length - 1].kind === "header") out.pop();
  return out;
}

/**
 * Variante de `hidratarParametrosParaDigitacao` que devolve segmentos
 * (headers de seção + inputs) preservando a estrutura visual do layout.
 */
export async function hidratarSegmentosParaDigitacao(
  catalogoId: string,
  exameNome: string,
  parametros: ExameParametro[],
  resultadosSalvos: Record<string, unknown> | null | undefined,
): Promise<DigitacaoSegmento[]> {
  const layout = await ensureDefaultLayout(catalogoId, exameNome, parametros);
  return buildDigitacaoSegments(layout?.conteudo ?? null, parametros, resultadosSalvos, exameNome);
}