// Helpers compartilhados para renderizar o HTML de um mapa em formato "folha A4"
// (retrato ou paisagem). Usado tanto no diálogo de pré-visualização final
// (MapaPreviewDialog) quanto no editor de mapas (aba "Pré-visualização" do
// MapaTrabalhoDialog).
//
// FIDELIDADE PREVIEW = PRINT: o CSS base vem de `mapaSharedStyles.ts`, mesmo
// módulo consumido pelo motor de impressão (mapaPrint.ts). Aqui apenas
// adicionamos o "papel" (folha A4 visual) e tema do app.

import {
  MAPA_BASE_CSS,
  MAPA_DEBUG_CSS,
  MAPA_DEBUG_SCRIPT,
  prepareMapaHtml,
  propagateRowHeights as _propagateRowHeights,
  annotateTables as _annotateTables,
  type MapaOrientation,
} from "@/lib/mapaSharedStyles";

export type { MapaOrientation };

// Re-exports para preservar a API pública usada por outros módulos.
export const propagateRowHeights = _propagateRowHeights;
export const annotateTablesForPreview = _annotateTables;

const PREVIEW_THEME_VARS = [
  "--background",
  "--foreground",
  "--card",
  "--border",
  "--muted",
  "--muted-foreground",
] as const;

function getPreviewThemeSnapshot() {
  if (typeof document === "undefined") {
    return {
      rootClassName: "",
      fontFamily: "Inter, system-ui, sans-serif",
      cssVars: "",
    };
  }

  const root = document.documentElement;
  const computed = window.getComputedStyle(root);
  const cssVars = PREVIEW_THEME_VARS
    .map((name) => `${name}:${computed.getPropertyValue(name).trim()};`)
    .join("");

  return {
    rootClassName: "",
    fontFamily: window.getComputedStyle(document.body).fontFamily || "Inter, system-ui, sans-serif",
    cssVars,
  };
}

/**
 * Envolve o HTML do mapa com CSS de "folha A4" para que o preview seja fiel
 * ao PDF impresso: cada `.mapa-page` vira uma folha A4 branca com sombra,
 * margens internas e quebras visíveis entre páginas. Quando o conteúdo não
 * vem pré-paginado em `.mapa-page`, ele é envelopado em uma folha automática
 * para que o usuário enxergue a régua A4 mesmo em layouts simples.
 */
export function wrapHtmlAsA4Preview(
  rawHtml: string,
  orientation: MapaOrientation,
  options: { debug?: boolean } = {},
): string {
  if (!rawHtml) return "";
  const debug = !!options.debug;
  const themeSnapshot = getPreviewThemeSnapshot();
  const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const headMatch = rawHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const bodyInnerRaw = bodyMatch ? bodyMatch[1] : rawHtml;
  const headInner = headMatch ? headMatch[1] : "";

  // Pipeline UNIFICADO com o motor de impressão: normaliza <p> em células
  // pequenas, anota tabelas e propaga alturas. Idempotente — pode ser
  // chamado mesmo em HTML já pré-processado pelo mapaPrint.
  const bodyInnerAnnotated = prepareMapaHtml(bodyInnerRaw);

  // Se o HTML não trouxer .mapa-page, envolvemos em uma folha automática.
  const hasPages = /class\s*=\s*["'][^"']*\bmapa-page\b/.test(bodyInnerAnnotated);
  const bodyInner = hasPages
    ? bodyInnerAnnotated
    : `<div class="mapa-page">${bodyInnerAnnotated}</div>`;

  const pageW = orientation === "landscape" ? "297mm" : "210mm";
  const pageH = orientation === "landscape" ? "210mm" : "297mm";

  // CSS = (a) tema do app aplicado à moldura + (b) "papel" A4 + (c) base
  // compartilhada com o motor de impressão (mapaPrint).
  const previewCss = `
    :root { ${themeSnapshot.cssVars} --preview-font-family:${themeSnapshot.fontFamily}; }
    html, body {
      margin: 0;
      padding: 0;
      background: hsl(var(--muted));
      color: hsl(var(--foreground));
      color-scheme: light;
    }
    body {
      padding: 24px 0;
      font-family: var(--preview-font-family, Inter, system-ui, sans-serif);
    }
    .mapa-page {
      width: ${pageW};
      min-height: ${pageH};
      padding: 10mm;
      margin: 0 auto 16px auto;
      background: hsl(var(--card));
      box-shadow: 0 2px 8px hsl(var(--foreground) / 0.15);
      box-sizing: border-box;
      page-break-after: always;
      overflow: hidden;
    }
    .mapa-page:last-child { margin-bottom: 0; }
    ${MAPA_BASE_CSS}
    ${debug ? MAPA_DEBUG_CSS : ""}
  `;

  return `<!DOCTYPE html>
<html class="${themeSnapshot.rootClassName}">
<head>
  <meta charset="utf-8" />
  ${headInner}
  <style>${previewCss}</style>
</head>
<body>
  ${bodyInner}
  ${debug ? `<script>${MAPA_DEBUG_SCRIPT}</script>` : ""}
</body>
</html>`;
}