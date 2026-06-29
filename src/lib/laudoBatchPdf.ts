// Impressão em LOTE dos laudos finalizados.
//
// IMPORTANTE: este módulo reaproveita 100% o pipeline do laudo individual
// (`buildLaudoHtml` + `printHtmlInHiddenFrame`), garantindo MESMAS margens
// (@page 4/11/4/11mm), mesmas fontes (Helvetica/Courier), mesmo cabeçalho
// institucional e mesmo bloco de assinatura — conforme constraint
// `mem://constraints/layout-impressao-travado.md`.
//
// A versão anterior renderizava com html2canvas+jsPDF (raster), o que
// quebrava margens, anti-aliasing e proporção. Foi removida.
//
// Fluxo:
//  1. Para cada protocolo: hidrata + monta o fragmento HTML do laudo
//     (mesma função `buildLaudoHtml` do individual).
//  2. Concatena os fragmentos em UM único documento, separando atendimentos
//     com page-break forçado.
//  3. Injeta o mesmo hook de paginação do individual — adaptado para
//     iterar sobre TODAS as `table.laudo-a4-page` (uma por atendimento).
//  4. Dispara `printHtmlInHiddenFrame` — o usuário recebe o diálogo nativo
//     de impressão e escolhe "Salvar como PDF" (mesma UX do individual).

import { hydrateAtendimentoForLaudo } from "@/pages/ResultadoDetalhe/services/hydrateAtendimentoForLaudo";
import { buildLaudoHtml } from "@/pages/ResultadoDetalhe/services/laudoHtmlBuilder";
import { sanitizeHtmlForPrint } from "@/lib/sanitizeHtml";
import { fetchHistoricoPorExame } from "@/pages/ResultadoDetalhe/services/historicoResultados";
import { printHtmlInHiddenFrame } from "@/lib/printHtml";

export interface GerarLaudoLoteArgs {
  /** Protocolos na ordem desejada (asc por número de atendimento). */
  protocolos: string[];
  /** Analista responsável pela impressão em lote (bloco de assinatura). */
  analistaAtual: { nome: string; iniciais: string };
  /** Assinatura (carimbo/imagem). */
  assinaturaLaudo: { tipo: "carimbo" | "imagem"; conselho: string | null; url: string | null };
  /** Título sugerido para o arquivo "Salvar como PDF". */
  filename: string;
  /** Callback opcional de progresso (0..1). */
  onProgress?: (frac: number, msg?: string) => void;
}

export interface GerarLaudoLoteResult {
  totalAtendimentos: number;
  totalExames: number;
  ms: number;
}

/**
 * Hook de paginação multi-atendimento.
 *
 * Espelha o hook usado em `ResultadoDetalhe.doImprimirLaudo`, mas itera
 * sobre TODAS as `table.laudo-a4-page` (uma por atendimento) — não apenas
 * a primeira. Cada atendimento é paginado de forma independente e os
 * page-breaks entre eles continuam garantidos pela classe
 * `laudo-a4-page-break` aplicada na 2ª, 3ª, … tabelas.
 */
function buildMultiPaginationHook(margins: { top: number; right: number; bottom: number; left: number }): string {
  return `
<script>
  (function(){
    window.__lovableBeforePrint = async function(){
      try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (e) {}
      await new Promise(function(resolve){ requestAnimationFrame(function(){ requestAnimationFrame(resolve); }); });

      var margins = ${JSON.stringify(margins)};
      var pageWidthMm = 210 - Number(margins.left || 0) - Number(margins.right || 0);
      document.documentElement.style.width = pageWidthMm + 'mm';
      document.body.style.width = pageWidthMm + 'mm';

      var probe = document.createElement('div');
      probe.style.cssText = 'position:absolute;visibility:hidden;left:-1000mm;top:0;width:100mm;height:0;overflow:hidden;';
      document.body.appendChild(probe);
      var pxPerMm = probe.getBoundingClientRect().width / 100;
      probe.remove();
      if (!pxPerMm || !isFinite(pxPerMm)) return;

      var tables = Array.prototype.slice.call(document.querySelectorAll('table.laudo-a4-page'));
      if (tables.length === 0) return;

      var outerHeight = function(el) {
        var rect = el.getBoundingClientRect();
        var cs = window.getComputedStyle(el);
        return rect.height + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
      };

      tables.forEach(function(sourceTable, atendIdx){
        var sourceContent = sourceTable.querySelector('#laudo-content');
        var header = sourceTable.querySelector('thead');
        if (!sourceContent) return;

        var headerPx = header ? header.getBoundingClientRect().height : 0;
        var footerReservePx = 32 * pxPerMm;
        var safeGapPx = 3 * pxPerMm;
        var availablePx = (297 - Number(margins.top || 0) - Number(margins.bottom || 0)) * pxPerMm - headerPx - footerReservePx - safeGapPx;
        if (!availablePx || availablePx < 200) return;

        var blocks = Array.prototype.slice.call(sourceContent.children).filter(function(el){
          return el.classList && (el.classList.contains('exame-bloco') || el.classList.contains('assinatura-bloco'));
        });

        var pages = [];
        var current = [];
        var used = 0;
        blocks.forEach(function(block){
          var h = outerHeight(block);
          if (current.length > 0 && used + h > availablePx) {
            pages.push(current);
            current = [];
            used = 0;
          }
          current.push(block);
          used += h;
          if (h > availablePx && current.length === 1) {
            pages.push(current);
            current = [];
            used = 0;
          }
        });
        if (current.length) pages.push(current);
        if (pages.length <= 1) return;

        var isFirstAtendimento = atendIdx === 0;
        var wrapper = document.createElement('div');
        wrapper.className = 'laudo-pages-manual';

        pages.forEach(function(pageBlocks, pageIndex){
          var table = sourceTable.cloneNode(false);
          // Preserva quebra entre atendimentos: a 1ª página de qualquer
          // atendimento (exceto o primeiro) força nova folha.
          if (!isFirstAtendimento && pageIndex === 0) {
            table.classList.add('laudo-a4-page-break');
          } else {
            table.classList.remove('laudo-a4-page-break');
          }
          table.classList.add('laudo-page-manual');
          table.style.breakInside = 'avoid';
          table.style.pageBreakInside = 'avoid';
          if (header) table.appendChild(header.cloneNode(true));

          var tbody = document.createElement('tbody');
          var tr = document.createElement('tr');
          var td = document.createElement('td');
          var corpo = document.createElement('div');
          corpo.className = 'laudo-a4-corpo';
          var content = document.createElement('div');
          content.id = 'laudo-content';
          content.setAttribute('style', sourceContent.getAttribute('style') || '');
          corpo.appendChild(content);
          td.appendChild(corpo);
          tr.appendChild(td);
          tbody.appendChild(tr);
          table.appendChild(tbody);

          var isLastPage = pageIndex >= pages.length - 1;
          table.style.breakAfter = isLastPage ? 'auto' : 'page';
          table.style.pageBreakAfter = isLastPage ? 'auto' : 'always';

          pageBlocks.forEach(function(block){
            block.style.breakBefore = '';
            block.style.pageBreakBefore = '';
            content.appendChild(block);
          });
          wrapper.appendChild(table);
        });
        sourceTable.replaceWith(wrapper);
      });

      document.documentElement.setAttribute('data-laudo-batch-paginated', String(tables.length));
    };
  })();
</script>`;
}

export async function gerarLaudoLotePdf({
  protocolos,
  analistaAtual,
  assinaturaLaudo,
  filename,
  onProgress,
}: GerarLaudoLoteArgs): Promise<GerarLaudoLoteResult> {
  const t0 = performance.now();
  if (protocolos.length === 0) {
    throw new Error("Nenhum atendimento elegível para impressão.");
  }

  const fragmentos: string[] = [];
  let totalExames = 0;
  let sharedMargins = { top: 4, right: 11, bottom: 4, left: 11 };

  for (let i = 0; i < protocolos.length; i++) {
    const proto = protocolos[i];
    onProgress?.(i / protocolos.length, `Preparando ${proto}…`);
    const hyd = await hydrateAtendimentoForLaudo(proto);
    if (!hyd || hyd.printable.length === 0) continue;

    let historicoByExameId: Record<number, { linhaHtml: string; graficoHtml: string }> = {};
    try {
      historicoByExameId = await fetchHistoricoPorExame({
        pacienteCpf: hyd.paciente.cpf,
        excludeProtocolo: hyd.paciente.protocolo,
        exames: hyd.printable,
        customByExame: hyd.customByExame,
      });
    } catch { /* opcional */ }

    const html = buildLaudoHtml({
      paciente: hyd.paciente,
      analistaAtual,
      assinaturaLaudo,
      getResolvedRef: hyd.getResolvedRef,
      printable: hyd.printable,
      customByExame: hyd.customByExame,
      pageMargins: hyd.margins,
      historicoByExameId,
    });

    // Marca a PRIMEIRA tabela.laudo-a4-page do 2º atendimento em diante com
    // a classe de page-break. buildLaudoHtml já entrega exatamente uma
    // tabela por atendimento (pages.length === 1 no caller), então é seguro
    // injetar a classe no primeiro match.
    const isFirst = fragmentos.length === 0;
    const adapted = isFirst
      ? html
      : html.replace(
          /<table class="laudo-a4-page(?!\s+laudo-a4-page-break)"/,
          '<table class="laudo-a4-page laudo-a4-page-break"',
        );

    fragmentos.push(adapted);
    totalExames += hyd.printable.length;
    sharedMargins = hyd.margins;
  }

  if (fragmentos.length === 0) {
    throw new Error("Nenhum exame liberado encontrado para os atendimentos selecionados.");
  }

  onProgress?.(0.9, "Abrindo diálogo de impressão…");

  // Mesma sanitização do individual; concatena fragmentos como UM documento.
  const sanitized = sanitizeHtmlForPrint(fragmentos.join("\n"));
  const hook = buildMultiPaginationHook(sharedMargins);
  const injected = /<\/body>/i.test(sanitized)
    ? sanitized.replace(/<\/body>/i, `${hook}</body>`)
    : `${sanitized}${hook}`;

  printHtmlInHiddenFrame({ html: injected, documentTitle: filename });

  onProgress?.(1, "Concluído");
  return {
    totalAtendimentos: fragmentos.length,
    totalExames,
    ms: performance.now() - t0,
  };
}
