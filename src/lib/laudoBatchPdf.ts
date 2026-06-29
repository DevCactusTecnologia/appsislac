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
//  3. Injeta um hook leve somente para ajuste de largura antes do print — a
//     paginação fica a cargo do CSS nativo do laudo, sem recalcular o DOM todo.
//  4. Dispara `printHtmlInHiddenFrame` — o usuário recebe o diálogo nativo
//     de impressão e escolhe "Salvar como PDF" (mesma UX do individual).

import { hydrateAtendimentoForLaudo } from "@/pages/ResultadoDetalhe/services/hydrateAtendimentoForLaudo";
import { buildLaudoHtml } from "@/pages/ResultadoDetalhe/services/laudoHtmlBuilder";
import { sanitizeHtmlForPrint } from "@/lib/sanitizeHtml";
import { fetchHistoricoPorExame } from "@/pages/ResultadoDetalhe/services/historicoResultados";
import { printHtmlInHiddenFrame } from "@/lib/printHtml";
import { runWithConcurrency } from "@/lib/runWithConcurrency";
import { logger } from "@/lib/logger";

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

interface PreparedLaudoFragment {
  protocolo: string;
  html: string;
  totalExames: number;
  margins: { top: number; right: number; bottom: number; left: number };
}

const HYDRATION_CONCURRENCY = 3;
const HYDRATION_TIMEOUT_MS = 45_000;
const HISTORICO_TIMEOUT_MS = 8_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => reject(new Error(`${label} excedeu ${Math.round(timeoutMs / 1000)}s`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) window.clearTimeout(timer);
  }) as Promise<T>;
}

/**
 * Hook leve para impressão em lote.
 *
 * O hook anterior tentava recalcular a paginação real de TODAS as tabelas no
 * iframe antes do print. Em lotes isso escala mal (muitas medições de DOM,
 * cloneNode e reflow) e pode deixar a UI presa em "Preparando laudos…".
 *
 * Aqui mantemos apenas o ajuste de largura do pipeline individual e deixamos
 * o próprio CSS do laudo (`@page`, `thead` repetido, `break-inside: avoid` e
 * `.laudo-a4-page-break`) fazer a paginação vetorial nativa do navegador.
 */
function buildBatchPrintHook(margins: { top: number; right: number; bottom: number; left: number }): string {
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
      document.documentElement.setAttribute('data-laudo-batch-ready', 'true');
    };
  })();
</script>`;
}

function stripFixedFooter(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  template.content.querySelectorAll(".laudo-a4-rodape-fixed").forEach((el) => el.remove());
  return template.innerHTML;
}

async function prepareFragment(
  proto: string,
  analistaAtual: GerarLaudoLoteArgs["analistaAtual"],
  assinaturaLaudo: GerarLaudoLoteArgs["assinaturaLaudo"],
): Promise<PreparedLaudoFragment | null> {
  const hyd = await withTimeout(hydrateAtendimentoForLaudo(proto), HYDRATION_TIMEOUT_MS, `Hidratação de ${proto}`);
  if (!hyd || hyd.printable.length === 0) return null;

  let historicoByExameId: Record<number, { linhaHtml: string; graficoHtml: string }> = {};
  try {
    historicoByExameId = await withTimeout(fetchHistoricoPorExame({
      pacienteCpf: hyd.paciente.cpf,
      excludeProtocolo: hyd.paciente.protocolo,
      exames: hyd.printable,
      customByExame: hyd.customByExame,
    }), HISTORICO_TIMEOUT_MS, `Histórico de ${proto}`);
  } catch (error) {
    logger.warn("laudoBatchPdf", "histórico ignorado no lote", {
      protocolo: proto,
      error: (error as Error)?.message,
    });
  }

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

  return {
    protocolo: proto,
    html,
    totalExames: hyd.printable.length,
    margins: hyd.margins,
  };
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

  let completed = 0;
  const prepared = await runWithConcurrency(protocolos, HYDRATION_CONCURRENCY, async (proto) => {
    onProgress?.(completed / protocolos.length, `Preparando ${proto}…`);
    try {
      return await prepareFragment(proto, analistaAtual, assinaturaLaudo);
    } catch (error) {
      logger.warn("laudoBatchPdf", "atendimento ignorado no lote", {
        protocolo: proto,
        error: (error as Error)?.message,
      });
      return null;
    } finally {
      completed += 1;
      onProgress?.(Math.min(0.88, completed / protocolos.length), `Preparados ${completed}/${protocolos.length}`);
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    }
  });

  const fragmentos = prepared.filter((p): p is PreparedLaudoFragment => !!p);
  const totalExames = fragmentos.reduce((sum, f) => sum + f.totalExames, 0);
  const sharedMargins = fragmentos[0]?.margins ?? { top: 4, right: 11, bottom: 4, left: 11 };

  if (fragmentos.length === 0) {
    throw new Error("Nenhum exame liberado encontrado para os atendimentos selecionados.");
  }

  onProgress?.(0.9, "Abrindo diálogo de impressão…");

  // Mesma sanitização do individual; concatena fragmentos como UM documento.
  const htmlConcatenado = fragmentos.map((frag, index) => {
    const html = index === 0 ? frag.html : stripFixedFooter(frag.html);
    // Marca a PRIMEIRA tabela.laudo-a4-page do 2º atendimento em diante com
    // page-break antes, preservando a ordem de atendimento sem recalcular o DOM.
    if (index === 0) return html;
    return html.replace(
      /<table class="laudo-a4-page(?!\s+laudo-a4-page-break)"/,
      '<table class="laudo-a4-page laudo-a4-page-break"',
    );
  }).join("\n");

  const sanitized = sanitizeHtmlForPrint(htmlConcatenado);
  const hook = buildBatchPrintHook(sharedMargins);
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
