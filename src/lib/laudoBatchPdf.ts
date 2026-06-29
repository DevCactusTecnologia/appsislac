// Geração de PDF em LOTE com os laudos finalizados (download direto).
//
// Reaproveita 100% da pipeline do laudo individual:
//  - `hydrateAtendimentoForLaudo` (mesmo `reloadExames` do componente)
//  - `buildLaudoHtml` (mesmo HTML/CSS travado por constraint)
//
// O lote concatena o HTML de cada atendimento (separado por page-break),
// renderiza em iframe oculto, fotografa CADA `.laudo-a4-page` via
// html2canvas e monta um único PDF A4 via jsPDF. O usuário recebe o
// arquivo direto pelo download nativo do navegador.

import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { hydrateAtendimentoForLaudo } from "@/pages/ResultadoDetalhe/services/hydrateAtendimentoForLaudo";
import { buildLaudoHtml } from "@/pages/ResultadoDetalhe/services/laudoHtmlBuilder";
import { sanitizeHtmlForPrint } from "@/lib/sanitizeHtml";
import { fetchHistoricoPorExame } from "@/pages/ResultadoDetalhe/services/historicoResultados";

export interface GerarLaudoLoteArgs {
  /** Protocolos a incluir, JÁ na ordem desejada (asc por número de atendimento). */
  protocolos: string[];
  /** Analista responsável pela impressão em lote (usado no bloco de assinatura). */
  analistaAtual: { nome: string; iniciais: string };
  /** Assinatura do analista (carimbo/imagem). */
  assinaturaLaudo: { tipo: "carimbo" | "imagem"; conselho: string | null; url: string | null };
  /** Nome final do arquivo .pdf (sem extensão). */
  filename: string;
  /** Callback opcional de progresso 0..1. */
  onProgress?: (frac: number, msg?: string) => void;
}

export interface GerarLaudoLoteResult {
  totalAtendimentos: number;
  totalExames: number;
  ms: number;
}

const WRAPPER_ID = "__sislac_batch_pdf_wrapper__";

function createOffscreenIframe(): HTMLIFrameElement {
  const existing = document.getElementById(WRAPPER_ID) as HTMLIFrameElement | null;
  if (existing) existing.remove();
  const iframe = document.createElement("iframe");
  iframe.id = WRAPPER_ID;
  // Largura A4 ≈ 794px @96dpi. Mantemos width fixo para garantir
  // que o layout horizontal feche dentro da página A4 do jsPDF.
  iframe.style.cssText = [
    "position:fixed",
    "left:-99999px",
    "top:0",
    "width:794px",
    "height:1123px",
    "border:0",
    "visibility:hidden",
    "pointer-events:none",
  ].join(";");
  document.body.appendChild(iframe);
  return iframe;
}

async function waitForFontsAndPaint(doc: Document): Promise<void> {
  try { if (doc.fonts && doc.fonts.ready) await doc.fonts.ready; } catch { /* noop */ }
  await new Promise<void>((res) => requestAnimationFrame(() => requestAnimationFrame(() => res())));
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

  // ── 1. Hidrata + monta HTML por atendimento ───────────────────────
  const fragmentos: string[] = [];
  let totalExames = 0;
  for (let i = 0; i < protocolos.length; i++) {
    const proto = protocolos[i];
    onProgress?.(i / (protocolos.length * 2), `Carregando ${proto}…`);
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
    totalExames += hyd.printable.length;
    // Separador entre atendimentos: força nova folha A4 no PDF final.
    fragmentos.push(`<div class="batch-atendimento" data-protocolo="${proto}">${sanitizeHtmlForPrint(html)}</div>`);
  }

  if (fragmentos.length === 0) {
    throw new Error("Nenhum exame liberado encontrado para os atendimentos selecionados.");
  }

  // ── 2. Renderiza tudo num iframe oculto ───────────────────────────
  const iframe = createOffscreenIframe();
  const docHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;background:#fff;}
    body{width:794px;}
    .batch-atendimento{position:relative;width:794px;}
    /* Esconde rodapé fixo no offscreen — html2canvas captura por página
       individual e o rodapé fixo aparece em cima do conteúdo. */
    .laudo-a4-rodape-fixed{position:static !important;display:block !important;margin-top:16px;}
  </style></head><body>${fragmentos.join("")}</body></html>`;
  const cdoc = iframe.contentDocument!;
  cdoc.open();
  cdoc.write(docHtml);
  cdoc.close();
  await waitForFontsAndPaint(cdoc);
  // Aguarda um beat extra para imagens externas (logo/assinatura) carregarem.
  await new Promise<void>((r) => setTimeout(r, 300));

  // ── 3. Captura cada `.laudo-a4-page` e adiciona ao PDF ────────────
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const A4 = { w: 210, h: 297 };
  const pages = Array.from(cdoc.querySelectorAll<HTMLElement>(".laudo-a4-page"));
  if (pages.length === 0) {
    iframe.remove();
    throw new Error("Falha ao renderizar laudos para PDF.");
  }
  for (let i = 0; i < pages.length; i++) {
    onProgress?.(0.5 + i / (pages.length * 2), `Gerando página ${i + 1}/${pages.length}…`);
    const el = pages[i];
    const canvas = await html2canvas(el, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      windowWidth: 794,
    });
    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    const imgHmm = (canvas.height * A4.w) / canvas.width;
    if (i > 0) pdf.addPage("a4", "portrait");
    if (imgHmm <= A4.h) {
      pdf.addImage(imgData, "JPEG", 0, 0, A4.w, imgHmm, undefined, "FAST");
    } else {
      // Fatia em múltiplas folhas A4 quando o exame é longo.
      const sliceMm = A4.h;
      let offsetMm = 0;
      let first = true;
      while (offsetMm < imgHmm - 0.5) {
        if (!first) pdf.addPage("a4", "portrait");
        pdf.addImage(imgData, "JPEG", 0, -offsetMm, A4.w, imgHmm, undefined, "FAST");
        offsetMm += sliceMm;
        first = false;
      }
    }
  }

  pdf.save(`${filename}.pdf`);
  iframe.remove();
  onProgress?.(1, "Concluído");
  return { totalAtendimentos: fragmentos.length, totalExames, ms: performance.now() - t0 };
}
