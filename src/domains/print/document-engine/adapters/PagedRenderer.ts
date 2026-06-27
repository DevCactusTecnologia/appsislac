/**
 * PagedRenderer — única superfície do SISLAC que conhece Paged.js.
 *
 * Lazy-load: o import dinâmico só dispara quando alguém realmente
 * renderiza um documento (página de impressão), mantendo o bundle
 * inicial do SISLAC sem custo.
 *
 * Caso seja necessário substituir Paged.js no futuro, basta criar
 * um novo adapter (ex.: WeasyRenderer) que respeite a interface
 * `RenderAdapter` — nenhum outro arquivo precisa mudar.
 */

import type { RenderAdapter, RenderOptions, RenderResult } from "./RenderAdapter";
import type { WatermarkSpec } from "../types";

export class PagedRenderer implements RenderAdapter {
  readonly name = "pagedjs";

  async render({ document: doc, host }: RenderOptions): Promise<RenderResult> {
    // Import dinâmico — Paged.js (~150KB gzip) só carrega aqui.
    const pagedjs = await import("pagedjs");
    const Previewer = (pagedjs as { Previewer: new () => PagedPreviewer }).Previewer;

    // Limpa host antes de paginar (re-renderização).
    host.innerHTML = "";

    // HTML legado ainda pode conter CSS de marca d'água por pseudo-elemento.
    // No Document Engine 3.0 a marca é responsabilidade exclusiva do adapter;
    // por isso a neutralização é aplicada DEPOIS do HTML do laudo.
    const runtimeCss = buildRuntimeCss(doc.geometry);
    const footerHtml = extractFooterHtml(doc.html);

    // Conteúdo passado para o Previewer é HTML; CSS vai como folha embutida.
    const content = `<style>${doc.css}</style>${doc.html}<style>${runtimeCss}</style>`;
    const stylesheets: Array<{ _href?: string }> = [];

    const previewer = new Previewer();
    const flow = await previewer.preview(content, stylesheets, host);

    const pageCount = (flow?.total as number) ?? host.querySelectorAll(".pagedjs_page").length;

    // Marca d'água: injetada por página via hook DOM (full-cover, sem disputar @page).
    injectWatermark(host, doc.watermark);
    injectFixedFooters(host, footerHtml, doc.geometry);

    return { pageCount };
  }
}

interface PagedPreviewer {
  preview(
    content: string | HTMLElement,
    stylesheets: Array<{ _href?: string }> | string[],
    renderTo: HTMLElement,
  ): Promise<{ total?: number } | null>;
}

function injectWatermark(host: HTMLElement, wm: WatermarkSpec): void {
  if (!wm.enabled || !wm.url) return;
  const pages = host.querySelectorAll<HTMLElement>(".pagedjs_page");
  pages.forEach((page) => {
    // Ancora no .pagedjs_pagebox para cobrir TODA a folha (incluindo margens).
    const pagebox = page.querySelector<HTMLElement>(".pagedjs_pagebox") ?? page;
    pagebox.style.position = "relative";
    const mark = page.ownerDocument.createElement("div");
    mark.className = "sislac-watermark";
    mark.setAttribute("aria-hidden", "true");
    Object.assign(mark.style, {
      position: "absolute",
      inset: "0",
      pointerEvents: "none",
      zIndex: "0",
      backgroundImage: `url(${JSON.stringify(wm.url)})`,
      backgroundRepeat: "no-repeat",
      backgroundPosition: "center center",
      backgroundSize: `${wm.sizePct}% auto`,
      opacity: String(wm.opacity),
      transform: `rotate(${wm.rotation}deg)`,
      transformOrigin: "center center",
    } satisfies Partial<CSSStyleDeclaration>);
    pagebox.insertBefore(mark, pagebox.firstChild);
    // Garante que o conteúdo da página fique acima da marca d'água.
    Array.from(pagebox.children).forEach((child) => {
      if (child === mark) return;
      const el = child as HTMLElement;
      if (!el.style.position) el.style.position = "relative";
      if (!el.style.zIndex) el.style.zIndex = "1";
    });
  });
}

function buildRuntimeCss(geometry: { marginRightMm: number; marginBottomMm: number; marginLeftMm: number }): string {
  return `
    /* Document Engine 3.0: o adapter controla a marca d'água por página. */
    body::before,
    .pagedjs_page .laudo-a4-page::before {
      content: none !important;
      display: none !important;
      background-image: none !important;
    }

    /* O rodapé institucional original continua reservando espaço na paginação,
       mas a cópia visível é fixada pelo adapter no final de cada folha. */
    .pagedjs_page .laudo-a4-page > tfoot {
      visibility: hidden !important;
    }
    .sislac-fixed-footer {
      position: absolute;
      left: ${geometry.marginLeftMm}mm;
      right: ${geometry.marginRightMm}mm;
      bottom: ${geometry.marginBottomMm}mm;
      z-index: 2;
      pointer-events: none;
      color: #000 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .sislac-fixed-footer,
    .sislac-fixed-footer * {
      box-sizing: border-box !important;
      max-width: 100% !important;
    }
  `;
}

function extractFooterHtml(html: string): string | null {
  const template = document.createElement("template");
  template.innerHTML = html;
  const footer = template.content.querySelector<HTMLElement>(".laudo-a4-rodape");
  return footer?.innerHTML?.trim() || null;
}

function injectFixedFooters(
  host: HTMLElement,
  footerHtml: string | null,
  geometry: { marginRightMm: number; marginBottomMm: number; marginLeftMm: number },
): void {
  if (!footerHtml) return;
  const pages = host.querySelectorAll<HTMLElement>(".pagedjs_page");
  pages.forEach((page) => {
    const pagebox = page.querySelector<HTMLElement>(".pagedjs_pagebox") ?? page;
    pagebox.style.position = "relative";
    const footer = page.ownerDocument.createElement("div");
    footer.className = "sislac-fixed-footer laudo-a4-rodape";
    footer.setAttribute("aria-hidden", "true");
    footer.innerHTML = footerHtml;
    Object.assign(footer.style, {
      left: `${geometry.marginLeftMm}mm`,
      right: `${geometry.marginRightMm}mm`,
      bottom: `${geometry.marginBottomMm}mm`,
    } satisfies Partial<CSSStyleDeclaration>);
    pagebox.appendChild(footer);
  });
}
