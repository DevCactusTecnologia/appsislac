// ============================================================================
// OWNERSHIP OFICIAL — Mapa de Trabalho (workflow operacional).
// Estilos e helpers compartilhados entre o motor de IMPRESSÃO (mapaPrint.ts) e
// a PRÉ-VISUALIZAÇÃO A4 (mapaA4Preview.ts).
// Pertence ao domínio operacional. NÃO usar para renderização científica.
//
// Objetivo: garantir que o que o usuário vê no preview seja BIT-A-BIT idêntico
// ao que sai no PDF/print. Antes deste módulo, cada caminho mantinha sua
// própria cópia do CSS e dos detectores de sizing — pequenas divergências
// (line-height, margins de <p> dentro de células, table-layout) provocavam
// alturas erradas (ex.: a célula com height:1px renderizando ~19px no preview).
//
// Tudo aqui é puro (sem React/DOM). Apenas o módulo `mapaA4Preview.ts` adiciona
// o "wrapping" da folha A4 + tema do app por cima deste CSS base.
// ============================================================================

export type MapaOrientation = "portrait" | "landscape";

/**
 * Lista global de avisos coletados durante a preparação do HTML — útil para
 * depurar layouts quebrados (ex.: `<colgroup>` com larguras inválidas que
 * forçam o fallback `table-layout: auto`). Cada chamada de `prepareMapaHtml`
 * acrescenta entradas; o consumidor pode ler/limpar via os helpers abaixo.
 */
export interface MapaPreparationWarning {
  /** Categoria curta para filtragem. */
  code:
    | "colgroup-invalid-widths"
    | "table-no-sizing"
    | "td-p-normalized"
    | "td-list-normalized"
    | "td-heading-normalized"
    | "table-px-width-overridden"
    | "colgroup-inferred-from-cells";
  /** Mensagem legível para o console. */
  message: string;
  /** Pequeno snippet (~120 chars) do HTML problemático. */
  snippet?: string;
}

let _warnings: MapaPreparationWarning[] = [];
let _consoleEnabled = false;

/** Habilita/desabilita o eco automático dos avisos para `console.warn`. */
export function setMapaWarningsConsole(enabled: boolean): void {
  _consoleEnabled = enabled;
}

/** Limpa o buffer de avisos (chamado no início de cada `prepareMapaHtml`). */
export function clearMapaWarnings(): void {
  _warnings = [];
}

/** Retorna uma cópia dos avisos coletados na última preparação. */
export function getMapaWarnings(): MapaPreparationWarning[] {
  return _warnings.slice();
}

function pushWarning(w: MapaPreparationWarning): void {
  _warnings.push(w);
  if (_consoleEnabled) {
    // eslint-disable-next-line no-console
    console.warn(`[mapa] ${w.code}: ${w.message}`, w.snippet ? `\n${w.snippet}` : "");
  }
}

function snippetOf(html: string, max = 120): string {
  const s = html.replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

// ─── Detecção de sizing autoral ────────────────────────────────────────────

/**
 * Verifica se o `<colgroup>` extraído contém ao menos um `<col>` com largura
 * efetiva (numérica > 0, em qualquer unidade CSS). Ver mapaPrint.test.ts para
 * a matriz exata de casos cobertos. Exportado para testes/reuso.
 */
export function colgroupHasUsableWidths(colgroupHtml: string): boolean {
  if (!colgroupHtml || typeof colgroupHtml !== "string") return false;
  const colTags: string[] = colgroupHtml.match(/<col\b[^>]*>/gi) ?? [];
  if (colTags.length === 0) return false;
  const INVALID_KEYWORDS = new Set([
    "auto", "inherit", "initial", "unset", "none", "revert", "revert-layer",
  ]);
  return colTags.some((col) => {
    const attrW = col.match(/\swidth\s*=\s*["']?([^"'\s>]+)/i)?.[1];
    const styleW = col.match(/style\s*=\s*["'][^"']*?\bwidth\s*:\s*([^;"']*)/i)?.[1];
    const raw = (styleW ?? attrW ?? "").trim().toLowerCase();
    if (!raw) return false;
    if (INVALID_KEYWORDS.has(raw)) return false;
    const num = parseFloat(raw);
    if (!Number.isFinite(num) || num <= 0) return false;
    return true;
  });
}

/**
 * Reconstrói um `<colgroup>` derivando a largura de cada coluna a partir das
 * células `<td>`/`<th>` com `colspan=1` (ou ausente) e `width: X%` no style.
 *
 * Algoritmo (simulação de grade de tabela):
 *   1. Determina o número total de colunas somando os colspans da primeira `<tr>`.
 *   2. Percorre todas as linhas mantendo um vetor "occupancy" para honrar
 *      `rowspan` e calcula em qual coluna cada célula começa.
 *   3. Para cada célula com `colspan=1` e `width: X%`, registra o % na coluna
 *      correspondente (só sobrescreve se ainda não houver valor).
 *   4. Se TODAS as colunas receberem largura, monta o `<colgroup>`. Caso
 *      contrário, retorna `null` (deixa o navegador inferir).
 *
 * Não lida com `<thead>/<tbody>/<tfoot>` separadamente — apenas considera as
 * `<tr>` na ordem de aparição (suficiente para tabelas de mapa do TipTap).
 */
export function inferColgroupFromCells(tableHtml: string): string | null {
  if (!tableHtml) return null;
  const rows = tableHtml.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? [];
  if (rows.length === 0) return null;

  // 1) Número de colunas a partir da primeira linha (somando colspans).
  const firstRow = rows[0] ?? "";
  const firstRowCells = firstRow.match(/<(?:td|th)\b[^>]*>/gi) ?? [];
  if (firstRowCells.length === 0) return null;
  const totalCols = firstRowCells.reduce((sum, cell) => {
    const cs = parseInt(cell.match(/\bcolspan\s*=\s*["']?(\d+)/i)?.[1] ?? "1", 10);
    return sum + (Number.isFinite(cs) && cs > 0 ? cs : 1);
  }, 0);
  if (totalCols <= 0) return null;

  // Vetor de ocupação por coluna (rowspans pendentes da linha anterior).
  const occupancy: number[] = new Array(totalCols).fill(0);
  // Largura de cada coluna em % (preenchida quando encontrarmos uma célula
  // colspan=1 com width:% naquela posição).
  const colWidthsPct: (number | null)[] = new Array(totalCols).fill(null);

  for (const rowHtml of rows) {
    // Decrementa ocupação da linha anterior (rowspans).
    for (let i = 0; i < totalCols; i++) {
      if (occupancy[i] > 0) occupancy[i] -= 1;
    }
    const cellTags = rowHtml.match(/<(?:td|th)\b[^>]*>/gi) ?? [];
    let col = 0;
    for (const cellTag of cellTags) {
      // Pula colunas ocupadas por rowspans anteriores.
      while (col < totalCols && occupancy[col] > 0) col += 1;
      if (col >= totalCols) break;

      const colspan = Math.max(
        1,
        parseInt(cellTag.match(/\bcolspan\s*=\s*["']?(\d+)/i)?.[1] ?? "1", 10) || 1,
      );
      const rowspan = Math.max(
        1,
        parseInt(cellTag.match(/\browspan\s*=\s*["']?(\d+)/i)?.[1] ?? "1", 10) || 1,
      );

      // Só células com colspan=1 contribuem para a largura de UMA coluna.
      if (colspan === 1 && colWidthsPct[col] == null) {
        const widthPct = parseFloat(
          cellTag.match(/style\s*=\s*["'][^"']*?\bwidth\s*:\s*([\d.]+)\s*%/i)?.[1] ?? "",
        );
        if (Number.isFinite(widthPct) && widthPct > 0) {
          colWidthsPct[col] = widthPct;
        }
      }

      // Atualiza ocupação para rowspan>1 (vai consumir colunas em linhas seguintes).
      if (rowspan > 1) {
        for (let i = 0; i < colspan; i++) {
          if (col + i < totalCols) occupancy[col + i] = rowspan - 1;
        }
      }
      col += colspan;
    }
  }

  // Só reconstrói se TODAS as colunas tiverem largura definida.
  if (colWidthsPct.some((w) => w == null)) return null;
  const cols = colWidthsPct.map((w) => `<col style="width: ${w}%">`).join("");
  return `<colgroup>${cols}</colgroup>`;
}

/**
 * Detecta se a tabela (ou suas linhas/células) tem dimensões definidas pelo
 * usuário no editor — via atributo width/height ou style inline.
 */
export function tableHasUserSizing(tableHtml: string): boolean {
  const tableOpen = tableHtml.match(/<table[^>]*>/i)?.[0] ?? "";
  if (/\s(?:width|height)\s*=\s*["']?[^"'\s>]+/i.test(tableOpen)) return true;
  if (/style\s*=\s*["'][^"']*?\b(?:width|height|min-width|min-height|max-width|max-height)\s*:/i.test(tableOpen)) return true;
  const cellTags = tableHtml.match(/<(?:tr|td|th)\b[^>]*>/gi) ?? [];
  for (const tag of cellTags) {
    if (/\s(?:width|height)\s*=\s*["']?[^"'\s>]+/i.test(tag)) return true;
    if (/style\s*=\s*["'][^"']*?\b(?:width|height|min-width|min-height|max-width|max-height)\s*:/i.test(tag)) return true;
  }
  return false;
}

/** Injeta uma classe CSS em uma tag HTML (idempotente). */
export function injectClass(tag: string, className: string): string {
  const classAttrMatch = tag.match(/\sclass\s*=\s*(["'])([\s\S]*?)\1/i);
  if (classAttrMatch) {
    const existing = classAttrMatch[2];
    if (existing.split(/\s+/).includes(className)) return tag;
    return tag.replace(classAttrMatch[0], ` class="${existing} ${className}"`);
  }
  return tag.replace(/^<([a-zA-Z]+)/, `<$1 class="${className}"`);
}

/** Extrai a altura inline (px) de uma tag de `<tr>`/`<td>`/`<th>`. */
function extractHeightPx(tag: string): number | null {
  const styleH = tag.match(/style\s*=\s*["'][^"']*?\bheight\s*:\s*([0-9.]+)\s*px/i)?.[1];
  const attrH = tag.match(/\sheight\s*=\s*["']?([0-9.]+)/i)?.[1];
  const raw = styleH ?? attrH;
  if (!raw) return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Mescla estilos inline em uma lista de atributos de tag, preservando os demais atributos. */
function mergeTagStyle(attrs: string, patch: Record<string, string>): string {
  const styleMatch = attrs.match(/\sstyle\s*=\s*(["'])([\s\S]*?)\1/i);
  const styleMap = new Map<string, string>();
  (styleMatch?.[2] ?? "")
    .split(";")
    .map((d) => d.trim())
    .filter(Boolean)
    .forEach((d) => {
      const idx = d.indexOf(":");
      if (idx > -1) styleMap.set(d.slice(0, idx).trim().toLowerCase(), d.slice(idx + 1).trim());
    });
  Object.entries(patch).forEach(([k, v]) => {
    if (v === "" || v == null) styleMap.delete(k.toLowerCase());
    else styleMap.set(k.toLowerCase(), v);
  });
  const nextStyle = Array.from(styleMap.entries()).map(([k, v]) => `${k}: ${v}`).join("; ");
  const attrsWithoutStyle = attrs.replace(/\sstyle\s*=\s*(["'])[\s\S]*?\1/i, "");
  return nextStyle ? `${attrsWithoutStyle} style="${nextStyle}"` : attrsWithoutStyle;
}

/**
 * Propaga a altura definida no `<tr>` para a primeira `<td>`/`<th>` interna
 * via spacer invisível, garantindo a altura mesmo onde browsers ignoram
 * `height` em `<tr>` (Chromium PDF). Idempotente.
 */
export function propagateRowHeights(html: string): string {
  if (!html) return html;
  return html.replace(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi, (trHtml) => {
    const trOpen = trHtml.match(/<tr\b[^>]*>/i)?.[0] ?? "";
    const heightPx = extractHeightPx(trOpen);
    if (!heightPx) return trHtml;
    // Idempotência: se a linha já contém um spacer com a mesma altura,
    // não injetamos um segundo (chamadas repetidas do pipeline ficariam
    // empilhando spacers, inflando a altura real).
    if (new RegExp(`aria-hidden="true"[^>]*height:${heightPx}px`).test(trHtml)) {
      return trHtml;
    }
    let injected = false;
    return trHtml.replace(/<(td|th)\b([^>]*)>/i, (full, tag, attrs) => {
      if (injected) return full;
      injected = true;
      const currentHeight = extractHeightPx(`<${tag}${attrs}>`);
      const mergedAttrs = currentHeight
        ? attrs
        : mergeTagStyle(attrs, { height: `${heightPx}px` });
      return `<${tag}${mergedAttrs}>`;
    });
  });
}

/**
 * Anota cada `<table>` com `has-user-sizing` e/ou `has-colgroup` para que o
 * CSS base aplique o table-layout correto.
 */
export function annotateTables(html: string): string {
  if (!html) return html;
  return html.replace(/<table\b[\s\S]*?<\/table>/gi, (tableHtml) => {
    const colgroupHtml = tableHtml.match(/<colgroup[\s\S]*?<\/colgroup>/i)?.[0] ?? "";
    const tableOpenMatch = tableHtml.match(/<table[^>]*>/i);
    if (!tableOpenMatch) return tableHtml;
    let tableOpen = tableOpenMatch[0];
    let changed = false;
    // ─── Limpeza de colgroup conflitante ──────────────────────────────────
    // Quando o usuário definiu width:% nas células via "Propriedades da
    // tabela", um <colgroup> com larguras em PIXELS (legado do columnResizing
    // do TipTap) sobrepõe esse intent no preview/print A4. Detectamos esse
    // conflito e removemos o <colgroup> px para que as larguras % das células
    // vençam (combinadas com `table-layout: fixed`).
    let workingHtml = tableHtml;
    let workingColgroup = colgroupHtml;
    if (colgroupHtml) {
      const cellHasPercent = /<(?:td|th)\b[^>]*style\s*=\s*["'][^"']*?\bwidth\s*:\s*[\d.]+%/i.test(tableHtml);
      const colgroupOnlyPx = !/\bwidth\s*[:=]\s*["']?[\d.]+%/i.test(colgroupHtml)
        && /\bwidth\s*[:=]\s*["']?[\d.]+(?:px)?\b/i.test(colgroupHtml);
      if (cellHasPercent && colgroupOnlyPx) {
        workingHtml = tableHtml.replace(/<colgroup[\s\S]*?<\/colgroup>/i, "");
        workingColgroup = "";
      }
    }

    // ─── Override de width:Xpx na própria <table> ─────────────────────────
    // O TipTap (com columnResizing) frequentemente persiste a largura total
    // da tabela em PIXELS no editor (ex.: <table style="width:199px">). No
    // editor isso reflete o tamanho do canvas; no preview/print A4, essa
    // medida em px aprisiona a tabela em uma faixa minúscula da folha (199px
    // ≈ 5cm), dando a impressão de que "as larguras % das células não estão
    // sendo respeitadas" — quando na verdade elas estão, mas calculadas
    // sobre uma tabela artificialmente pequena.
    //
    // Quando as células trazem larguras em `%`, a intenção autoral é uma
    // distribuição PROPORCIONAL na folha — então removemos qualquer
    // `width:Xpx` (e `min-width`/`max-width` em px) do `<table>` para que
    // ela volte a ocupar 100% da página e as % das células sejam calculadas
    // sobre a largura útil da folha A4.
    const tableOpenInWorking = workingHtml.match(/<table[^>]*>/i)?.[0] ?? tableOpen;
    const cellsHavePercentWidth = /<(?:td|th)\b[^>]*style\s*=\s*["'][^"']*?\bwidth\s*:\s*[\d.]+%/i.test(workingHtml);
    const tableHasPxWidth = /style\s*=\s*["'][^"']*?\bwidth\s*:\s*[\d.]+\s*px/i.test(tableOpenInWorking);
    if (cellsHavePercentWidth && tableHasPxWidth) {
      const cleanedTableOpen = tableOpenInWorking
        // Remove width: Xpx e min-/max-width: Xpx do style inline
        .replace(
          /style\s*=\s*(["'])([\s\S]*?)\1/i,
          (_full, quote: string, css: string) => {
            const cleaned = css
              .split(";")
              .map((decl) => decl.trim())
              .filter(Boolean)
              .filter((decl) => !/^(?:min-|max-)?width\s*:\s*[\d.]+\s*px\b/i.test(decl))
              .join("; ");
            return cleaned ? `style=${quote}${cleaned}${quote}` : "";
          },
        )
        // Remove também atributo width="Xpx" se existir (raro, mas possível)
        .replace(/\swidth\s*=\s*["']?[\d.]+(?:px)?["']?/i, "");
      if (cleanedTableOpen !== tableOpenInWorking) {
        workingHtml = workingHtml.replace(tableOpenInWorking, cleanedTableOpen);
        tableOpen = cleanedTableOpen;
        changed = true;
        pushWarning({
          code: "table-px-width-overridden",
          message: "Tabela com width:Xpx + células em % → width removido para ocupar 100% da folha.",
          snippet: snippetOf(tableOpenInWorking),
        });
      }
    }

    // ─── Inferência de <colgroup> a partir das células ────────────────────
    // Quando as células declaram width:% mas não há <colgroup>, e a primeira
    // linha possui colspan>1 (caso clássico do mapa "HIV": cabeçalho com
    // colspan=3), `table-layout: fixed` calcula as larguras pela primeira
    // linha — que só conhece valores AGREGADOS — e ignora as larguras
    // detalhadas declaradas em linhas seguintes. O resultado visual é uma
    // distribuição uniforme, contradizendo as medidas autorais.
    //
    // Solução: reconstruir um <colgroup> derivando a largura de cada coluna
    // a partir das células com colspan=1 que mapeiam uma única coluna.
    if (!workingColgroup) {
      const inferred = inferColgroupFromCells(workingHtml);
      if (inferred) {
        const tableOpenNow = workingHtml.match(/<table[^>]*>/i)?.[0] ?? tableOpen;
        workingHtml = workingHtml.replace(
          tableOpenNow,
          `${tableOpenNow}${inferred}`,
        );
        workingColgroup = inferred;
        changed = true;
        pushWarning({
          code: "colgroup-inferred-from-cells",
          message: "Tabela sem <colgroup> + células em % → <colgroup> reconstruído a partir das células.",
          snippet: snippetOf(inferred),
        });
      }
    }

    const hasUsefulCols = colgroupHasUsableWidths(workingColgroup);
    if (hasUsefulCols) {
      const next = injectClass(tableOpen, "has-colgroup");
      if (next !== tableOpen) { tableOpen = next; changed = true; }
    } else if (workingColgroup) {
      // Colgroup PRESENTE mas com widths inválidas → cai no fallback auto.
      // Logamos para o desenvolvedor identificar layouts quebrados.
      pushWarning({
        code: "colgroup-invalid-widths",
        message: "Tabela com <colgroup> sem larguras úteis — usando table-layout:auto.",
        snippet: snippetOf(workingColgroup),
      });
    }
    const hasSizing = tableHasUserSizing(workingHtml);
    if (hasSizing) {
      const next = injectClass(tableOpen, "has-user-sizing");
      if (next !== tableOpen) { tableOpen = next; changed = true; }
    }
    if (!hasUsefulCols && !hasSizing) {
      pushWarning({
        code: "table-no-sizing",
        message: "Tabela sem nenhuma medida autoral — caindo em width:100%; table-layout:auto.",
        snippet: snippetOf(tableOpenMatch[0]),
      });
    }
    if (workingHtml !== tableHtml) {
      // O `workingHtml` pode ter sido reescrito (colgroup removido e/ou
      // <table> com width:px limpo). Substituímos a tag de abertura atual
      // pela versão final de `tableOpen` (que pode ter classes adicionadas).
      const currentOpen = workingHtml.match(/<table[^>]*>/i)?.[0];
      if (currentOpen && currentOpen !== tableOpen) {
        return workingHtml.replace(currentOpen, tableOpen);
      }
      return workingHtml;
    }
    if (!changed) return tableHtml;
    return tableHtml.replace(tableOpenMatch[0], tableOpen);
  });
}

// ─── Normalização do HTML do TipTap ────────────────────────────────────────

/** Estilo inline-reset aplicado em qualquer wrapper de bloco normalizado (legado HTML).
 *
 * `vertical-align:middle` é CRÍTICO: quando combinado com o spacer de altura
 * (`propagateRowHeights`), faz o texto normalizado ("HEMAC", placeholders…)
 * acompanhar o `vertical-align` declarado pelo usuário no próprio `<td>`.
 * Antes era `top`, o que prendia o texto no alto da célula mesmo quando o
 * usuário marcava "centralizar verticalmente" no editor de mapas. */
const INLINE_RESET = "margin:0;padding:0;line-height:1;display:inline-block;vertical-align:middle;";

/** Combina o style autoral (se houver) com o reset inline. */
function mergeWithReset(attrs: string): { otherAttrs: string; finalStyle: string } {
  const styleMatch = attrs.match(/style\s*=\s*(["'])([\s\S]*?)\1/i);
  const userStyle = styleMatch ? styleMatch[2].trim().replace(/;?\s*$/, "") : "";
  const otherAttrs = attrs.replace(/\sstyle\s*=\s*(["'])[\s\S]*?\1/i, "");
  const finalStyle = userStyle ? `${userStyle};${INLINE_RESET}` : INLINE_RESET;
  return { otherAttrs, finalStyle };
}

/**
 * Limpa estruturas indesejadas geradas pelo TipTap dentro de `<td>`/`<th>` que
 * possuem altura definida pelo usuário no editor. Cobre múltiplas tags-bloco,
 * todas substituídas por `<span>` inline com reset de margem/padding/line-height
 * — a única forma de impedir que a line-height padrão do navegador (~19px) ou
 * paddings inline (ex.: `<div style="padding:5px">` dos templates de
 * PROTOCOLO/GUIA) inflem a célula muito além da altura definida.
 *
 * REGRA DE NEGÓCIO: a altura definida no editor é ABSOLUTA. Qualquer célula
 * (`<td>`/`<th>`) com `height` explícito — não importa o valor, 1px ou 200px
 * — tem seu conteúdo reescrito para respeitar essa altura. O CSS base
 * complementa com `overflow:hidden` e zera padding/margin de descendentes.
 *
 * Tags normalizadas (em QUALQUER célula com height definido):
 *   • `<p>`              → `<span>` (caso clássico do TipTap em cada célula)
 *   • `<h1>`..`<h6>`     → `<span>` preservando o style autoral
 *   • `<ul>` / `<ol>`    → `<span>` com itens unidos por separador inline
 *   • `<li>`             → `<span>` (quando órfão, sem `<ul>`/`<ol>` pai)
 *   • `<div>`            → `<span>` mantendo conteúdo inline (zera padding/margin)
 *   • `<br>`             → espaço unicode (não pode quebrar linha em 1px)
 *
 * O HTML resultante continua válido para o motor de impressão atual, e
 * placeholders `{{...}}` são preservados intactos pois ficam no texto interno.
 */
export function normalizeMapaHtml(html: string): string {
  if (!html) return html;
  return html.replace(/<(td|th)\b([^>]*)>([\s\S]*?)<\/\1>/gi, (full, tag, attrs, inner) => {
    const heightPx = extractHeightPx(`<${tag}${attrs}>`);
    // Sem altura definida → não mexemos (preserva conteúdo natural).
    if (heightPx == null) return full;

    let cleaned = inner as string;
    let normalizedP = false;
    let normalizedList = false;
    let normalizedHeading = false;

    // 1) Listas: <ul>/<ol> viram <span> com <li> internos unidos por " · ".
    cleaned = cleaned.replace(
      /<(ul|ol)\b([^>]*)>([\s\S]*?)<\/\1>/gi,
      (_m: string, _listTag: string, listAttrs: string, listInner: string) => {
        normalizedList = true;
        const items = Array.from(
          listInner.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi),
        ).map((m) => m[1].trim()).filter(Boolean);
        const text = items.join(" · ");
        const { otherAttrs, finalStyle } = mergeWithReset(listAttrs);
        return `<span${otherAttrs} style="${finalStyle}">${text}</span>`;
      },
    );

    // 2) <li> órfão (já fora de lista após a etapa anterior) vira span.
    cleaned = cleaned.replace(
      /<li\b([^>]*)>([\s\S]*?)<\/li>/gi,
      (_m: string, liAttrs: string, liInner: string) => {
        normalizedList = true;
        const { otherAttrs, finalStyle } = mergeWithReset(liAttrs);
        return `<span${otherAttrs} style="${finalStyle}">${liInner}</span>`;
      },
    );

    // 3) Headings <h1>..<h6> viram span (preserva style autoral, ex.: bold).
    cleaned = cleaned.replace(
      /<(h[1-6])\b([^>]*)>([\s\S]*?)<\/\1>/gi,
      (_m: string, _hTag: string, hAttrs: string, hInner: string) => {
        normalizedHeading = true;
        const { otherAttrs, finalStyle } = mergeWithReset(hAttrs);
        return `<span${otherAttrs} style="${finalStyle};font-weight:bold">${hInner}</span>`;
      },
    );

    // 4) <p> direto vira span (caso clássico TipTap).
    cleaned = cleaned.replace(
      /<p\b([^>]*)>([\s\S]*?)<\/p>/gi,
      (_m: string, pAttrs: string, pInner: string) => {
        normalizedP = true;
        const { otherAttrs, finalStyle } = mergeWithReset(pAttrs);
        return `<span${otherAttrs} style="${finalStyle}">${pInner}</span>`;
      },
    );

    // 5) <div> vira span (TipTap pode emitir wrappers em alguns casos).
    cleaned = cleaned.replace(
      /<div\b([^>]*)>([\s\S]*?)<\/div>/gi,
      (_m: string, dAttrs: string, dInner: string) => {
        const { otherAttrs, finalStyle } = mergeWithReset(dAttrs);
        return `<span${otherAttrs} style="${finalStyle}">${dInner}</span>`;
      },
    );

    // 6) <br> não pode quebrar linha em célula 1px — vira espaço.
    cleaned = cleaned.replace(/<br\b[^/]*\/?>/gi, " ");

    if (normalizedP) {
      pushWarning({
        code: "td-p-normalized",
        message: `<p> dentro de célula de altura ${heightPx}px → convertido para <span>.`,
        snippet: snippetOf(full),
      });
    }
    if (normalizedList) {
      pushWarning({
        code: "td-list-normalized",
        message: `Lista (<ul>/<ol>/<li>) em célula de altura ${heightPx}px → convertida para <span>.`,
        snippet: snippetOf(full),
      });
    }
    if (normalizedHeading) {
      pushWarning({
        code: "td-heading-normalized",
        message: `<h*> em célula de altura ${heightPx}px → convertido para <span>.`,
        snippet: snippetOf(full),
      });
    }
    return `<${tag}${attrs}>${cleaned}</${tag}>`;
  });
}

/**
 * Pipeline completo de preparação do HTML antes de renderizar para preview ou
 * impressão. Idempotente: pode ser chamado múltiplas vezes sem efeito extra.
 */
export function prepareMapaHtml(html: string): string {
  clearMapaWarnings();
  return annotateTables(normalizeMapaHtml(propagateRowHeights(html)));
}

// ─── CSS base unificado ────────────────────────────────────────────────────

/**
 * CSS base aplicado tanto no PDF/impressão quanto no preview A4. NÃO inclui
 * @page nem o "papel" da folha — esses são responsabilidade de quem consome
 * (mapaPrint para print, mapaA4Preview para o iframe).
 */
export const MAPA_BASE_CSS = `
  * { box-sizing: border-box; }
  /* Tabelas: respeita SEMPRE as medidas autorais; só cai no fallback se não
     houver nenhuma medida definida. */
  table { border-collapse: collapse; }
  table:not(.has-user-sizing):not(.has-colgroup) {
    width: 100%;
    table-layout: auto;
  }
  table.has-colgroup {
    table-layout: fixed;
    width: 100%;
    max-width: 100%;
  }
  /* Sizing autoral nas células (sem colgroup): também fixamos o layout para
     que as larguras inline (width:Xpx / X%) sejam respeitadas literalmente
     pelo navegador. Sem isso, table-layout:auto redistribui o espaço com base
     no conteúdo das células vizinhas e células com largura definida acabam
     sobrepondo as adjacentes (texto invade a célula ao lado). */
  table.has-user-sizing {
    table-layout: fixed;
    max-width: 100%;
  }
  /* Quando só as células recebem width (%) e a tabela não tem width explícita,
     o layout fixo precisa que a própria tabela ocupe a faixa disponível.
     Sem isso, o navegador pode encolher a tabela e aparentar “cortar” o texto
     mesmo havendo espaço horizontal na folha. */
  table.has-user-sizing:not([width]):not([style*="width"]) {
    width: 100%;
  }
  /* Células: sem defaults visuais — borda, padding, vertical-align, background
     vêm APENAS do template autoral. Mantemos só word-wrap. */
  td, th { word-wrap: break-word; position: relative; }
  td[style*="vertical-align: middle"], th[style*="vertical-align: middle"] { vertical-align: middle !important; }
  td[style*="vertical-align: top"], th[style*="vertical-align: top"] { vertical-align: top !important; }
  td[style*="vertical-align: bottom"], th[style*="vertical-align: bottom"] { vertical-align: bottom !important; }
  td[style*="text-align: center"], th[style*="text-align: center"] { text-align: center !important; }
  td[style*="text-align: right"], th[style*="text-align: right"] { text-align: right !important; }
  td[style*="text-align: left"], th[style*="text-align: left"] { text-align: left !important; }
  /* Células com altura definida pelo usuário: a altura é ABSOLUTA.
     Força box-sizing e reseta TODOS os descendentes (não só filhos diretos),
     zerando margin/padding e line-height para que wrappers internos como
     <div style="padding:5px"> dos templates de PROTOCOLO/GUIA não inflem a
     célula além da altura definida.

     A altura é tratada como MÍNIMO (min-height): se o texto quebrar em
     larguras menores (ex.: modo retrato), a célula CRESCE para acomodar em
     vez de cortar — assim a borda da linha nunca passa por cima do texto.
     O navegador respeita height inline como min-height nesta combinação. */
  td[style*="height"], th[style*="height"],
  td[height], th[height] {
    box-sizing: border-box;
    line-height: 1.1;
    overflow: visible;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
  td[style*="height"] *, th[style*="height"] *,
  td[height] *, th[height] * {
    margin-top: 0 !important;
    margin-bottom: 0 !important;
    padding-top: 0 !important;
    padding-bottom: 0 !important;
    line-height: inherit !important;
    box-sizing: border-box;
  }
  /* Espaço entre atendimentos no Lote (parágrafo em branco). */
  .mapa-separador-paragrafo { height: 12px; line-height: 12px; margin: 0; padding: 0; }
  /* Bloco de paciente em mapas individuais — cada ticket é renderizado como
     uma cópia integral do template do editor; este wrapper impede que um
     paciente seja partido entre páginas durante a impressão. */
  .mapa-bloco-paciente {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .mapa-separador { page-break-inside: auto; break-inside: auto; }
  /* Quebra de página inteligente: linhas separadoras (parágrafo em branco
     entre atendimentos) podem quebrar livremente; já as linhas de paciente
     NÃO devem ser cortadas no meio — assim maximizamos atendimentos por
     folha sem dividir nenhum bloco. */
  tr.mapa-separador { page-break-after: auto; break-after: auto; }
  tbody tr:not(.mapa-separador) {
    page-break-inside: avoid;
    break-inside: avoid;
  }
`;

/**
 * CSS opcional de DEBUG aplicado APENAS no preview quando o modo de debug é
 * ativado pelo usuário. Destaca bordas de tabelas/linhas/células e injeta um
 * badge no canto inferior-direito de cada `<tr>` com a altura computada via
 * pequeno script. Não impacta o PDF/print (não é incluído no build de impressão).
 */
export const MAPA_DEBUG_CSS = `
  table[class*="has-"], table:not([class*="has-"]) {
    outline: 1px dashed hsl(280 80% 60% / 0.7) !important;
    outline-offset: 0 !important;
  }
  tr { outline: 1px dotted hsl(20 90% 55% / 0.7) !important; position: relative !important; }
  td, th { outline: 1px dotted hsl(200 90% 50% / 0.5) !important; position: relative !important; }
  /* Badges com a altura real (px) — populados por inline script no iframe. */
  td[data-debug-h]::after, th[data-debug-h]::after {
    content: attr(data-debug-h) "px";
    position: absolute; right: 0; bottom: 0;
    font: 9px/1 monospace;
    color: hsl(200 90% 30%);
    background: hsl(0 0% 100% / 0.85);
    padding: 1px 3px;
    pointer-events: none;
    z-index: 1;
  }
  tr[data-debug-h]::before {
    content: "tr " attr(data-debug-h) "px";
    position: absolute; left: 0; top: 0;
    font: 9px/1 monospace;
    color: hsl(20 90% 30%);
    background: hsl(0 0% 100% / 0.85);
    padding: 1px 3px;
    pointer-events: none;
    z-index: 1;
  }
`;

/** Script injetado no iframe de preview para popular `data-debug-h` em runtime. */
export const MAPA_DEBUG_SCRIPT = `
  (function () {
    function annotate() {
      document.querySelectorAll('tr').forEach(function (tr) {
        tr.setAttribute('data-debug-h', String(Math.round(tr.getBoundingClientRect().height)));
      });
      document.querySelectorAll('td, th').forEach(function (cell) {
        cell.setAttribute('data-debug-h', String(Math.round(cell.getBoundingClientRect().height)));
      });
    }
    if (document.readyState === 'complete') annotate();
    else window.addEventListener('load', annotate);
  })();
`;

/** CSS específico do PRINT — adiciona @page conforme orientação. */
export function buildPrintCss(orientation: MapaOrientation): string {
  return `
  @page { size: A4 ${orientation}; margin: 10mm; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; padding: 16px; }
  .mapa-page { page-break-after: always; text-transform: uppercase; }
  .mapa-page:last-child { page-break-after: auto; }
  ${MAPA_BASE_CSS}
  @media print { body { padding: 0; } }
`;
}
