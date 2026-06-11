// E2E: garante que as configurações por célula salvas no editor de Mapas de
// Trabalho (alinhamento horizontal/vertical, largura % e altura px) chegam
// preservadas no HTML produzido pelo botão "Pré-visualização".
//
// Estratégia: em vez de roteirizar cliques no editor TipTap (frágil), o teste
// monta um HTML que representa fielmente o output do editor após as
// configurações do usuário, executa o MESMO pipeline usado pelo preview real
// (`wrapHtmlAsA4Preview`, que internamente chama `prepareMapaHtml` —
// idêntico ao usado pelo motor de impressão), injeta o resultado em uma
// página em branco com `setContent` e valida via DOM que cada propriedade
// chega na célula renderizada.
//
// Cobre exatamente a regressão reportada: célula "HEMAC" centralizada
// horizontalmente e verticalmente, com largura 25% e altura 40px definidas
// pelo usuário, deve renderizar dessa forma no preview.

import { test, expect } from "../playwright-fixture";
import { wrapHtmlAsA4Preview } from "../src/lib/mapaA4Preview";

/** HTML que reproduz o output do RichTextEditorPro após o usuário aplicar:
 *  - text-align: center  (alinhamento horizontal)
 *  - vertical-align: middle (alinhamento vertical)
 *  - width: 25% (largura da coluna)
 *  - height: 40px (altura da linha) na 1ª linha
 *  E uma 2ª célula com configurações distintas para garantir que cada
 *  célula mantém suas próprias propriedades (não há vazamento entre tds).
 */
const EDITOR_HTML = `
<table>
  <tbody>
    <tr style="height:40px">
      <td data-testid="cell-hemac"
          style="text-align:center;vertical-align:middle;width:25%;height:40px">
        <p style="text-align:center">HEMAC</p>
      </td>
      <td data-testid="cell-obs"
          style="text-align:right;vertical-align:bottom;width:75%;height:40px">
        <p>Observação</p>
      </td>
    </tr>
    <tr style="height:1px">
      <td data-testid="cell-protocolo"
          style="text-align:left;vertical-align:top;width:25%;height:1px">
        <p>ATD-2026-0000017</p>
      </td>
      <td data-testid="cell-vazia"
          style="text-align:center;vertical-align:middle;width:75%;height:1px"></td>
    </tr>
  </tbody>
</table>
`;

test.describe("Mapas de Trabalho — preview preserva configurações por célula", () => {
  test("alinhamento H/V, largura % e altura px chegam no DOM do preview", async ({ page }) => {
    const previewHtml = wrapHtmlAsA4Preview(EDITOR_HTML, "portrait");
    await page.setContent(previewHtml, { waitUntil: "load" });

    // Garante que a folha A4 foi montada
    await expect(page.locator(".mapa-page")).toHaveCount(1);

    // 1) Célula HEMAC: centralizada H + V, largura 25%, altura 40px
    const hemac = page.getByTestId("cell-hemac");
    await expect(hemac).toHaveText("HEMAC");
    await expect(hemac).toHaveCSS("text-align", "center");
    await expect(hemac).toHaveCSS("vertical-align", "middle");
    const hemacBox = await hemac.boundingBox();
    expect(hemacBox).not.toBeNull();
    // Altura mínima de 40px — `height` no <td> funciona como min-height por
    // causa do reset em MAPA_BASE_CSS (overflow:visible).
    expect(hemacBox!.height).toBeGreaterThanOrEqual(38);
    // Largura ≈ 25% da página A4 (210mm − margens). Tolerância ampla porque
    // o cálculo final depende do table-layout.
    const page1 = await page.locator(".mapa-page").boundingBox();
    expect(page1).not.toBeNull();
    const expectedWidth = page1!.width * 0.25;
    expect(hemacBox!.width).toBeGreaterThan(expectedWidth * 0.7);
    expect(hemacBox!.width).toBeLessThan(expectedWidth * 1.3);

    // 2) Célula vizinha mantém alinhamento próprio (não vaza da HEMAC)
    const obs = page.getByTestId("cell-obs");
    await expect(obs).toHaveCSS("text-align", "right");
    await expect(obs).toHaveCSS("vertical-align", "bottom");

    // 3) Linha de 1px com texto: célula respeita altura mínima (não 19px)
    //    mas o conteúdo permanece visível por overflow:visible.
    const protocolo = page.getByTestId("cell-protocolo");
    await expect(protocolo).toContainText("ATD-2026-0000017");
    await expect(protocolo).toHaveCSS("text-align", "left");
    await expect(protocolo).toHaveCSS("vertical-align", "top");

    // 4) <p> dentro de células normalizadas vira <span> (preview = print).
    //    Isso garante que o pipeline `prepareMapaHtml` rodou.
    const pInsideTd = await page.locator('[data-testid="cell-hemac"] p').count();
    expect(pInsideTd).toBe(0);
    const spanInsideTd = await page.locator('[data-testid="cell-hemac"] span').count();
    expect(spanInsideTd).toBeGreaterThanOrEqual(1);
  });

  test("orientação landscape também preserva as configurações", async ({ page }) => {
    const previewHtml = wrapHtmlAsA4Preview(EDITOR_HTML, "landscape");
    await page.setContent(previewHtml, { waitUntil: "load" });

    const hemac = page.getByTestId("cell-hemac");
    await expect(hemac).toHaveCSS("text-align", "center");
    await expect(hemac).toHaveCSS("vertical-align", "middle");

    // Em paisagem a folha é mais larga; a célula deve continuar com ~25%.
    const pageBox = await page.locator(".mapa-page").boundingBox();
    const hemacBox = await hemac.boundingBox();
    expect(pageBox).not.toBeNull();
    expect(hemacBox).not.toBeNull();
    const ratio = hemacBox!.width / pageBox!.width;
    expect(ratio).toBeGreaterThan(0.18);
    expect(ratio).toBeLessThan(0.32);
  });
});