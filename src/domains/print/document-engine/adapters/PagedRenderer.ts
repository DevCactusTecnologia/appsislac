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
    const runtimeCss = buildRuntimeCss();

    // Conteúdo passado para o Previewer é HTML; CSS vai como folha embutida.
    const content = `<style>${doc.css}</style>${doc.html}<style>${runtimeCss}</style>`;
    const stylesheets: Array<{ _href?: string }> = [];

    const previewer = new Previewer();
    const flow = await previewer.preview(content, stylesheets, host);

    const pageCount = (flow?.total as number) ?? host.querySelectorAll(".pagedjs_page").length;

    // Marca d'água: injetada por página via hook DOM (full-cover, sem disputar @page).
    injectWatermark(host, doc.watermark);

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
      zIndex: "1",
      backgroundImage: `url(${JSON.stringify(wm.url)})`,
      backgroundRepeat: "no-repeat",
      backgroundPosition: "center center",
      backgroundSize: `${wm.sizePct}% auto`,
      opacity: String(wm.opacity),
      transform: `rotate(${wm.rotation}deg)`,
      transformOrigin: "center center",
    } satisfies Partial<CSSStyleDeclaration>);
    pagebox.insertBefore(mark, pagebox.firstChild);
    // Garante que textos/tabelas fiquem acima da marca d'água.
    Array.from(pagebox.children).forEach((child) => {
      if (child === mark) return;
      const el = child as HTMLElement;
      if (!el.style.position) el.style.position = "relative";
      if (!el.style.zIndex) el.style.zIndex = "2";
    });
  });
}

function buildRuntimeCss(): string {
  return `
    /* Document Engine 3.0: o adapter controla a marca d'água por página. */
    body::before,
    .pagedjs_page .laudo-a4-page::before {
      content: none !important;
      display: none !important;
      background-image: none !important;
    }

    /* O laudo antigo define a tabela como branca. Dentro das páginas físicas
       do Paged.js isso cobre a marca d'água. Mantemos a folha branca, mas o
       conteúdo fica transparente para a marca aparecer no vazio da página. */
    .pagedjs_pagebox,
    .pagedjs_area,
    .pagedjs_page_content,
    .pagedjs_page .laudo-a4-page,
    .pagedjs_page .laudo-a4-corpo,
    .pagedjs_page #laudo-content {
      background: transparent !important;
    }
  `;
}
