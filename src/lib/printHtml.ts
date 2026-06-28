// Helper compartilhado para impressão de HTML sem abrir popup nova.
// Chrome (e iframes sandbox do preview) bloqueiam window.open com blob/about:blank.
// Usamos um iframe oculto na própria página, escrevemos o HTML e disparamos print().

export interface PrintHtmlOptions {
  /** HTML completo (idealmente com <html><head><title>...) */
  html: string;
  /** Identificador opcional para reaproveitar/limpar o iframe. */
  frameId?: string;
  /** Remove o iframe após a impressão (default: true). */
  removeAfter?: boolean;
  /** Título sugerido para o arquivo PDF (Chrome usa document.title da
   *  janela pai como nome padrão ao "Salvar como PDF"). Quando informado,
   *  trocamos o título do documento pai temporariamente e restauramos
   *  após a impressão. */
  documentTitle?: string;
}

/**
 * Renderiza HTML em um iframe oculto e dispara a impressão.
 * Não abre nova aba — funciona dentro de previews sandboxed.
 */
export function printHtmlInHiddenFrame({
  html,
  frameId = "lov-print-frame",
  removeAfter = true,
  documentTitle,
}: PrintHtmlOptions): void {
  // Limpa eventual iframe anterior com o mesmo id
  const existing = document.getElementById(frameId);
  if (existing) existing.remove();

  const iframe = document.createElement("iframe");
  iframe.id = frameId;
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = "210mm";
  iframe.style.height = "297mm";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";

  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  // Chrome pode usar o título da janela PAI como nome do arquivo ao salvar
  // como PDF a partir de um iframe oculto. Trocamos temporariamente e mantemos
  // por tempo suficiente para o diálogo "Salvar como PDF" capturar o nome.
  const previousParentTitle = document.title;
  const previousTopTitle = (() => {
    try { return window.top?.document?.title; } catch { return undefined; }
  })();
  if (documentTitle) {
    try { document.title = documentTitle; } catch { /* noop */ }
    try { if (window.top?.document) window.top.document.title = documentTitle; } catch { /* noop */ }
    try { if (iframe.contentDocument) iframe.contentDocument.title = documentTitle; } catch { /* noop */ }
  }

  const triggerPrint = () => {
    const runBeforePrint = async () => {
      try {
        const hook = (iframe.contentWindow as Window & { __lovableBeforePrint?: () => void | Promise<void> } | null)?.__lovableBeforePrint;
        if (typeof hook === "function") {
          // Aplica timeout — se o hook travar (fonts.ready, etc.) seguimos
          // mesmo assim para imprimir, ao invés de nunca chamar print().
          await Promise.race([
            Promise.resolve().then(() => hook()),
            new Promise((resolve) => window.setTimeout(resolve, 2000)),
          ]);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[printHtml] beforePrint hook falhou:", err);
      }
    };

    void runBeforePrint().finally(() => {
      const printedAt = Date.now();
      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        window.removeEventListener("afterprint", onAfter);
        window.removeEventListener("focus", onFocus);
        iframe.contentWindow?.removeEventListener?.("afterprint", onAfter);
        if (documentTitle) {
          try { document.title = previousParentTitle; } catch { /* noop */ }
          try { if (previousTopTitle !== undefined && window.top?.document) window.top.document.title = previousTopTitle; } catch { /* noop */ }
        }
        if (removeAfter) {
          try { iframe.remove(); } catch { /* noop */ }
        }
      };
      const onAfter = () => {
        const elapsed = Date.now() - printedAt;
        window.setTimeout(cleanup, elapsed < 2_000 ? 60_000 : 300);
      };
      const onFocus = () => {
        const elapsed = Date.now() - printedAt;
        if (elapsed >= 2_000) window.setTimeout(cleanup, 800);
      };
      window.addEventListener("afterprint", onAfter);
      window.addEventListener("focus", onFocus);
      try { iframe.contentWindow?.addEventListener?.("afterprint", onAfter); } catch { /* noop */ }
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[printHtml] print() falhou:", err);
        cleanup();
      }
      window.setTimeout(cleanup, 5 * 60_000);
    });
  };


  // Algumas engines renderizam imediatamente; outras precisam de onload.
  if (doc.readyState === "complete") {
    window.setTimeout(triggerPrint, 50);
  } else {
    iframe.onload = () => window.setTimeout(triggerPrint, 50);
  }
}
