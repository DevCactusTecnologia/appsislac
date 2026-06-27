/**
 * PaginationEngine — produz as regras CSS de paginação determinística.
 *
 * Responsabilidades:
 *   • @page com tamanho A4 e margens fornecidas pelo LayoutEngine.
 *   • Repetição de cabeçalho/rodapé via mecanismo <thead>/<tfoot>
 *     (preservado por compatibilidade visual).
 *   • Regras de quebra (break-inside: avoid) para blocos indivisíveis
 *     e break-inside: auto para tabelas explicitamente fragmentáveis.
 *   • Numeração de página será injetada pelo Render Adapter
 *     (Paged.js) através de hook, NÃO via CSS @bottom-right —
 *     mantém compatibilidade com o rodapé institucional atual.
 *
 * Nenhuma referência a Paged.js. Apenas CSS padrão CSS-Fragmentation.
 */

import type { PageGeometry } from "./types";

export function buildPageCss(g: PageGeometry): string {
  return `
    @page {
      size: A4;
      margin: ${g.marginTopMm}mm ${g.marginRightMm}mm ${g.marginBottomMm}mm ${g.marginLeftMm}mm;
    }
    html, body { margin: 0 !important; padding: 0 !important; background: #ffffff !important; }
  `;
}

/** Regras de fragmentação aplicadas aos blocos semânticos. */
export const BREAK_RULES_CSS = `
  /* Blocos indivisíveis — cada exame e a assinatura nunca quebram. */
  .exame-bloco,
  .exame-bloco-custom,
  .assinatura-bloco {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  /* Mantém assinatura junto do último exame. */
  .exame-bloco + .assinatura-bloco,
  .exame-bloco-custom + .assinatura-bloco {
    page-break-before: avoid !important;
    break-before: avoid !important;
  }
  /* Exceção: tabelas marcadas como fragmentáveis podem quebrar
     APENAS entre linhas, nunca no meio de uma célula. */
  .exame-fragmentavel { break-inside: auto !important; page-break-inside: auto !important; }
  .exame-fragmentavel tr { break-inside: avoid !important; page-break-inside: avoid !important; }

  /* Cor e renderização determinística para impressão. */
  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
`;
