/**
 * DocumentComposer — converte um SemanticDocument em ComposedDocument
 * (HTML + CSS prontos para o Render Adapter).
 *
 * O composer NÃO conhece o renderer. Ele apenas:
 *   • monta o esqueleto HTML (cabeçalho repetível, área útil, rodapé)
 *   • concatena o CSS do LayoutEngine + PaginationEngine + CSS do doc
 *
 * Mantém o mecanismo <thead>/<tfoot> para repetição automática de
 * cabeçalho e rodapé em todas as páginas (CSS-Fragmentation padrão,
 * suportado por todas as engines homologadas — Chrome/Paged.js).
 */

import type { ComposedDocument, SemanticDocument } from "./types";
import { buildPageCss, BREAK_RULES_CSS } from "./PaginationEngine";

export function compose(doc: SemanticDocument): ComposedDocument {
  const css = [
    buildPageCss(doc.geometry),
    BREAK_RULES_CSS,
    doc.css ?? "",
  ].join("\n");

  const body = doc.body.map((b) => b.html).join("");

  const html = `
    <table class="laudo-a4-page" role="presentation">
      <thead><tr><td>
        <div class="laudo-a4-cabecalho">${doc.header.html}</div>
      </td></tr></thead>
      <tbody><tr><td>
        <main class="laudo-a4-corpo">
          <div id="laudo-content">${body}</div>
        </main>
      </td></tr></tbody>
      <tfoot><tr><td>
        <div class="laudo-a4-rodape">${doc.footer.html}</div>
      </td></tr></tfoot>
    </table>
  `;

  return {
    title: doc.title,
    html,
    css,
    geometry: doc.geometry,
    watermark: doc.watermark,
  };
}
