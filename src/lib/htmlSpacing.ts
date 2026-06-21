const HTML_SPACE_ENTITY_RE = /&nbsp;|&#160;|&#x0*a0;/gi;

const EDGE_HTML_SPACE_RE = /^((?:(?:&nbsp;|&#160;|&#x0*a0;)|[\s\u00a0])*)([\s\S]*?)((?:(?:&nbsp;|&#160;|&#x0*a0;)|[\s\u00a0])*)$/i;

const INLINE_TAGS = new Set([
  "a", "abbr", "b", "bdi", "bdo", "big", "cite", "code", "data", "del", "dfn", "em",
  "font", "i", "ins", "kbd", "label", "mark", "q", "s", "samp", "small", "span", "strong",
  "sub", "sup", "time", "u", "var",
]);

const BLOCK_TAGS = new Set([
  "address", "article", "aside", "blockquote", "dd", "details", "div", "dl", "dt", "fieldset",
  "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header",
  "hr", "li", "main", "nav", "ol", "p", "pre", "section", "table", "tbody", "td", "tfoot",
  "th", "thead", "tr", "ul",
]);

const TABLE_STRUCTURE_TAGS = new Set(["table", "tbody", "thead", "tfoot", "tr", "colgroup", "col"]);

type TagInfo = { name: string; closing: boolean; opening: boolean };

function getTagInfo(tag: string): TagInfo | null {
  const match = tag.match(/^<\s*(\/)?\s*([a-zA-Z][\w:-]*)/);
  if (!match) return null;
  const name = match[2].toLowerCase();
  const closing = !!match[1];
  return { name, closing, opening: !closing && !/\/\s*>$/.test(tag) };
}

function isTableStructureBoundary(prev: TagInfo | null, next: TagInfo | null): boolean {
  if (!prev || !next) return false;
  if (TABLE_STRUCTURE_TAGS.has(prev.name) || TABLE_STRUCTURE_TAGS.has(next.name)) return true;

  const prevCell = prev.name === "td" || prev.name === "th";
  const nextCell = next.name === "td" || next.name === "th";
  return prevCell && prev.closing && nextCell && next.opening;
}

function isBlockToBlockBoundary(prev: TagInfo | null, next: TagInfo | null): boolean {
  if (!prev || !next) return false;
  return BLOCK_TAGS.has(prev.name) && BLOCK_TAGS.has(next.name) && prev.closing && next.opening;
}

function shouldPreservePureSpacing(text: string, prevTag: string, nextTag: string): boolean {
  if (!text || /[\r\n]/.test(text)) return false;
  const normalized = text.replace(HTML_SPACE_ENTITY_RE, "\u00a0");
  if (!/^[\s\u00a0]+$/.test(normalized)) return false;

  const prev = getTagInfo(prevTag);
  const next = getTagInfo(nextTag);
  if (isTableStructureBoundary(prev, next) || isBlockToBlockBoundary(prev, next)) return false;

  const prevInline = !!prev && INLINE_TAGS.has(prev.name);
  const nextInline = !!next && INLINE_TAGS.has(next.name);
  const insideCellEdge =
    (!!prev?.opening && (prev.name === "td" || prev.name === "th")) ||
    (!!next?.closing && (next.name === "td" || next.name === "th"));

  return prevInline || nextInline || insideCellEdge;
}

function normalizeVisibleSpaces(text: string, preservePureSpacing: boolean): string {
  const normalizedEntities = text.replace(HTML_SPACE_ENTITY_RE, "\u00a0");
  if (preservePureSpacing) return normalizedEntities.replace(/ /g, "\u00a0");

  const textWithBreakableWordSpaces = normalizedEntities.replace(/\u00a0/g, (match, offset, fullText) => {
    const prev = fullText[offset - 1] ?? "";
    const next = fullText[offset + match.length] ?? "";
    const singleNbsp = prev !== "\u00a0" && next !== "\u00a0";
    const betweenText = /\S/.test(prev) && /\S/.test(next);
    return singleNbsp && betweenText ? " " : match;
  });

  return textWithBreakableWordSpaces
    .replace(/ {2,}/g, (spaces) => "\u00a0".repeat(spaces.length))
    .replace(/ +(?=\u00a0)/g, (spaces) => "\u00a0".repeat(spaces.length))
    .replace(/\u00a0 +/g, (spaces) => "\u00a0".repeat(spaces.length))
    .replace(/^ +/g, (spaces) => "\u00a0".repeat(spaces.length))
    .replace(/ +$/g, (spaces) => "\u00a0".repeat(spaces.length));
}

export function splitPlaceholderSpacing(raw: string): { leading: string; key: string; trailing: string } {
  const match = raw.match(EDGE_HTML_SPACE_RE);
  if (!match) return { leading: "", key: raw, trailing: "" };
  return { leading: match[1] ?? "", key: match[2] ?? "", trailing: match[3] ?? "" };
}

/**
 * Preserva espaços digitados em nós de texto reais, inclusive quando o HTML salvo
 * contém `white-space:nowrap`, convertendo espaços visuais para NBSP sem tocar em
 * tags/atributos nem na indentação estrutural entre elementos.
 */
export function preserveVisibleTextSpacing(html: string): string {
  const parts = html.split(/(<[^>]*>)/g);

  return parts.map((part, index) => {
    if (!part || part.startsWith("<")) return part;

    const hasExplicitNbsp = /&nbsp;|&#160;|&#x0*a0;|\u00a0/i.test(part);
    const prevTag = parts.slice(0, index).reverse().find((item) => item.startsWith("<")) ?? "";
    const nextTag = parts.slice(index + 1).find((item) => item.startsWith("<")) ?? "";
    const preservePureSpacing = shouldPreservePureSpacing(part, prevTag, nextTag);
    if (!hasExplicitNbsp && !preservePureSpacing && !/[^\s]/.test(part)) return part;

    // Quando o texto está encostado em abertura/fechamento de um BLOCK tag
    // (<p>, <div>, <li>, <td>...), o whitespace nas extremidades é indentação
    // estrutural do HTML salvo pelo editor, não espaço digitado pelo usuário.
    // Não convertemos esse whitespace em NBSP para evitar recuos artificiais
    // no laudo impresso (modo vetorial respeita NBSP literalmente).
    const prevInfo = getTagInfo(prevTag);
    const nextInfo = getTagInfo(nextTag);
    const prevIsBlockBoundary = !!prevInfo && BLOCK_TAGS.has(prevInfo.name);
    const nextIsBlockBoundary = !!nextInfo && BLOCK_TAGS.has(nextInfo.name);
    const preserveLeading = !prevIsBlockBoundary;
    const preserveTrailing = !nextIsBlockBoundary;

    return normalizeVisibleSpaces(part, preservePureSpacing, { preserveLeading, preserveTrailing });
  }).join("");
}