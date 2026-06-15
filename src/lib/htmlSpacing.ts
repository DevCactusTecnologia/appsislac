const HTML_SPACE_ENTITY_RE = /&nbsp;|&#160;|&#x0*a0;/gi;

const EDGE_HTML_SPACE_RE = /^((?:(?:&nbsp;|&#160;|&#x0*a0;)|[\s\u00a0])*)([\s\S]*?)((?:(?:&nbsp;|&#160;|&#x0*a0;)|[\s\u00a0])*)$/i;

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
  return html.replace(/>([^<]*)</g, (_match, text: string) => {
    const hasExplicitNbsp = /&nbsp;|&#160;|&#x0*a0;|\u00a0/i.test(text);
    if (!hasExplicitNbsp && !/[^\s]/.test(text)) return `>${text}<`;

    const normalized = text
      .replace(HTML_SPACE_ENTITY_RE, "\u00a0")
      .replace(/ {2,}/g, (spaces) => "\u00a0".repeat(spaces.length))
      .replace(/ +(?=\u00a0)/g, (spaces) => "\u00a0".repeat(spaces.length))
      .replace(/\u00a0 +/g, (spaces) => "\u00a0".repeat(spaces.length))
      .replace(/^ +/g, (spaces) => "\u00a0".repeat(spaces.length))
      .replace(/ +$/g, (spaces) => "\u00a0".repeat(spaces.length));

    return `>${normalized}<`;
  });
}