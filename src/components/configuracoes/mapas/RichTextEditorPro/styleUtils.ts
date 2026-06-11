// Helpers de estilo / sanitização extraídos de RichTextEditorPro.tsx
// (Sprint 1 — slicing estrutural). Comportamento literal preservado.

export function mergeStyleString(existing: string | null | undefined, patch: Record<string, string>): string {
  const map = new Map<string, string>();
  (existing || "")
    .split(";")
    .map((d) => d.trim())
    .filter(Boolean)
    .forEach((d) => {
      const idx = d.indexOf(":");
      if (idx > -1) {
        map.set(d.slice(0, idx).trim().toLowerCase(), d.slice(idx + 1).trim());
      }
    });
  Object.entries(patch).forEach(([k, v]) => {
    if (v === "" || v == null) map.delete(k.toLowerCase());
    else map.set(k.toLowerCase(), v);
  });
  return Array.from(map.entries()).map(([k, v]) => `${k}: ${v}`).join("; ");
}

export function styleStringToMap(style: string | null | undefined): Map<string, string> {
  const map = new Map<string, string>();
  (style || "").split(";").forEach((decl) => {
    const idx = decl.indexOf(":");
    if (idx > -1) map.set(decl.slice(0, idx).trim().toLowerCase(), decl.slice(idx + 1).trim());
  });
  return map;
}

export function cssColorToHex(value: string | null | undefined, fallback: string): string {
  const color = (value || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  const rgb = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!rgb) return fallback;
  return `#${[rgb[1], rgb[2], rgb[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("")}`;
}

// ─── Sanitização final (whitelist restrita compatível com motor A4) ─────────
export const ALLOWED_TAGS = [
  "table", "tbody", "thead", "tr", "td", "th",
  "colgroup", "col",
  "span", "p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "br",
  "sub", "sup", "blockquote", "code",
  // Marks de formatação inline emitidos pelo TipTap.
  // Sem isso, DOMPurify removia <strong>/<em>/<u>/<s>, e Negrito/Itálico/
  // Sublinhado/Tachado eram perdidos a cada onUpdate do editor.
  "strong", "em", "u", "s", "b", "i", "mark",
  "img",
];
export const ALLOWED_ATTR = ["style", "colspan", "rowspan", "width", "height", "align", "src", "alt", "title"];
export const ALLOWED_STYLE_PROPS = [
  "color", "background-color",
  "font-family", "font-size", "font-weight", "font-style",
  "text-align", "text-decoration",
  "border", "border-top", "border-right", "border-bottom", "border-left",
  "border-color", "border-width", "border-style",
  "width", "height", "min-width", "max-width", "min-height",
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "vertical-align", "table-layout",
  // Propriedades adicionais usadas pelos templates de DOCUMENTOS
  // (recibos / declarações). Sem elas, qualquer edição no editor removia
  // margens, espaçamentos e estilos visuais a cada keystroke, "quebrando"
  // o layout tanto na pré-visualização quanto na impressão.
  "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
  "line-height", "letter-spacing", "text-transform", "text-indent",
  "white-space", "word-break", "overflow-wrap",
  "background", "background-image",
  "border-collapse", "border-spacing", "border-radius",
  "display", "float", "clear",
  "page-break-before", "page-break-after", "page-break-inside",
  "break-before", "break-after", "break-inside",
  "list-style", "list-style-type", "list-style-position",
  "box-sizing", "opacity",
];

export function filterStyle(value: string): string {
  return value
    .split(";")
    .map((decl) => decl.trim())
    .filter(Boolean)
    .filter((decl) => {
      const prop = decl.split(":")[0]?.trim().toLowerCase();
      return prop && ALLOWED_STYLE_PROPS.includes(prop);
    })
    .join("; ");
}
