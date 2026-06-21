// SSOT — shell HTML compartilhado para documentos A4 impressos via
// `printHtmlInHiddenFrame`.
//
// Remove a duplicação de `<!DOCTYPE>...<head><style>@page{size:A4...}</style>
// </head><body>...<script>window.print()</script>` em ~9 builders.
//
// Filosofia:
//   - Encapsula APENAS o boilerplate (doctype, head, @page, body wrapper).
//   - NÃO toca em conteúdo: cada builder continua dono do seu HTML interno.
//   - NÃO injeta `<script>window.print()</script>` — quem chama
//     `printHtmlInHiddenFrame` já dispara o print do iframe.
//   - Permite CSS adicional opt-in via `css`.

import { escapeHtml } from "./escapeHtml";

export type PrintOrientation = "portrait" | "landscape";

export interface WrapA4DocumentOptions {
  /** Conteúdo do <title> (também serve como nome do arquivo no Salvar como PDF). */
  title: string;
  /** HTML que será colocado dentro de <body>. Não envolva em <html>/<body>. */
  bodyHtml: string;
  /** Orientação da página A4. Default: "portrait". */
  orientation?: PrintOrientation;
  /** Margem CSS para `@page` (ex.: "14mm", "10mm 12mm"). Default: "14mm". */
  margin?: string;
  /** Trechos extras de CSS a serem injetados no <style>. */
  css?: string;
  /** Idioma do <html>. Default: "pt-BR". */
  lang?: string;
}

const BASE_CSS = `
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } thead { display: table-header-group; } tr { page-break-inside: avoid; } }
  body { margin: 0; font-family: Inter, system-ui, -apple-system, "Segoe UI", sans-serif; color: #0f172a; font-size: 11pt; line-height: 1.5; }
  h1, h2, h3 { margin: 0; }
`;

/**
 * Envolve `bodyHtml` em um documento A4 pronto para impressão.
 * Use o resultado direto em `printHtmlInHiddenFrame({ html, documentTitle })`.
 */
export function wrapA4Document({
  title,
  bodyHtml,
  orientation = "portrait",
  margin = "14mm",
  css = "",
  lang = "pt-BR",
}: WrapA4DocumentOptions): string {
  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4 ${orientation}; margin: ${margin}; }
    ${BASE_CSS}
    ${css}
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}
