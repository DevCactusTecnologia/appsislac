/**
 * LaudoPrintPage — página dedicada de impressão de laudo.
 *
 * Fluxo Document Engine 3.0:
 *
 *   ResultadoDetalhe → savePrintContext(...) → window.open('/resultado/:id/print')
 *                                                            ↓
 *                                              loadPrintContext()  ← html + watermark
 *                                                            ↓
 *                                              DocumentRenderer.render(host)
 *                                                            ↓
 *                                              Paged.js (isolado no adapter)
 *                                                            ↓
 *                                              window.print()  ← DOM JÁ paginado
 *
 * Quem decide a composição agora é o Document Engine, NÃO o navegador.
 * O Paged.js é apenas o adapter ativo — está totalmente encapsulado por
 * `src/domains/print/document-engine/adapters/PagedRenderer.ts`.
 */

import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Printer, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  loadPrintContext,
  clearPrintContext,
  type PrintContext,
} from "@/domains/print/printContext";
import { renderDocument, resolveGeometry, type ComposedDocument, type WatermarkSpec } from "@/domains/print/document-engine";

const PAGED_RUNTIME_CSS = `
  /* Paged.js renderiza páginas reais — o navegador só materializa. */
  html, body { background: #e9ecef; margin: 0; padding: 0; }
  .pagedjs_pages { display: flex; flex-direction: column; align-items: center; gap: 8mm; padding: 8mm 0; }
  .pagedjs_page { background: #ffffff; box-shadow: 0 2px 16px rgba(0,0,0,0.08); }
  @media print {
    html, body { background: #ffffff; }
    .pagedjs_pages { gap: 0; padding: 0; }
    .pagedjs_page { box-shadow: none; break-after: page; }
  }
`;

export default function LaudoPrintPage() {
  const { id } = useParams<{ id: string }>();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [ctx, setCtx] = useState<PrintContext | null>(null);
  const [status, setStatus] = useState<"idle" | "paginating" | "ready" | "error">("idle");
  const [pageCount, setPageCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const printedRef = useRef(false);

  // 1. Carrega contexto (mesmo contrato do fluxo anterior).
  useEffect(() => {
    const loaded = loadPrintContext();
    if (!loaded) {
      setError("Sessão de impressão expirada ou inexistente. Volte ao laudo e clique em Imprimir novamente.");
      setStatus("error");
      return;
    }
    if (id && loaded.atendimentoId !== id) {
      setError("Contexto de impressão inválido para este laudo.");
      setStatus("error");
      return;
    }
    setCtx(loaded);
    if (loaded.title) {
      try { document.title = loaded.title; } catch { /* noop */ }
    }
  }, [id]);

  // 2. Bootstrap do iframe (isola CSS do app shell) + paginação Paged.js.
  useEffect(() => {
    if (!ctx) return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    let cancelled = false;

    const bootstrap = async () => {
      // Documento vazio dentro do iframe — Paged.js criará as páginas.
      const doc = iframe.contentDocument;
      if (!doc) return;
      doc.open();
      doc.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><title>${escapeAttr(ctx.title)}</title><style>${PAGED_RUNTIME_CSS}</style></head><body><div id="paged-host"></div></body></html>`);
      doc.close();

      const host = doc.getElementById("paged-host") as HTMLElement | null;
      if (!host) return;

      const watermark: WatermarkSpec = ctx.watermark ?? { enabled: false, url: null, opacity: 0.08, sizePct: 60, rotation: 0 };

      // O ctx.html já é "<style>...</style><body content>". Empacotamos como
      // ComposedDocument — geometria/css principais já estão no <style>.
      const composed: ComposedDocument = {
        title: ctx.title,
        html: ctx.html,
        css: "",
        geometry: resolveGeometry(),
        watermark,
      };

      setStatus("paginating");
      try {
        const result = await renderDocument(composed, host);
        if (cancelled) return;
        setPageCount(result.pageCount);
        setStatus("ready");

        if (!printedRef.current) {
          printedRef.current = true;
          // Aguarda layout final dentro do iframe.
          window.setTimeout(() => {
            try {
              iframe.contentWindow?.focus();
              iframe.contentWindow?.print();
            } catch { /* noop */ }
            clearPrintContext();
          }, 80);
        }
      } catch (e) {
        if (cancelled) return;
        console.error("[Document Engine 3.0] Falha ao paginar:", e);
        setError("Não foi possível paginar o laudo.");
        setStatus("error");
      }
    };

    void bootstrap();
    return () => { cancelled = true; };
  }, [ctx]);

  const handleReprint = () => {
    try {
      iframeRef.current?.contentWindow?.focus();
      iframeRef.current?.contentWindow?.print();
    } catch { /* noop */ }
  };

  const handleClose = () => {
    try { window.close(); } catch { /* noop */ }
  };

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md text-center space-y-3">
          <AlertTriangle className="h-10 w-10 text-amber-600 mx-auto" />
          <h1 className="text-lg font-semibold text-foreground">Não foi possível abrir o laudo</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={handleClose}>Fechar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-900">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-2 bg-background border-b print:hidden">
        <div className="text-xs text-muted-foreground truncate" title={ctx?.title}>
          {ctx?.title}
          {status === "paginating" && <span className="ml-2 italic">— Paginando…</span>}
          {status === "ready" && pageCount > 0 && <span className="ml-2">— {pageCount} página{pageCount > 1 ? "s" : ""}</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="default" onClick={handleReprint} disabled={status !== "ready"}>
            <Printer className="h-4 w-4 mr-1.5" /> Imprimir
          </Button>
          <Button size="sm" variant="outline" onClick={handleClose}>
            <X className="h-4 w-4 mr-1.5" /> Fechar
          </Button>
        </div>
      </div>

      <div ref={hostRef as never} className="hidden" aria-hidden="true" />
      <iframe
        ref={iframeRef}
        title="Laudo"
        className="w-full h-[calc(100vh-44px)] border-0 bg-white print:fixed print:inset-0 print:h-screen print:w-screen"
      />
    </div>
  );
}

function escapeAttr(s: string): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
