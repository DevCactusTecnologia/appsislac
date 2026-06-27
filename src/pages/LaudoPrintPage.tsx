/**
 * LaudoPrintPage — página dedicada de impressão de laudo.
 *
 * Document Engine 3.0:
 *
 *   ResultadoDetalhe → savePrintContext(...) → window.open('/resultado/:id/print')
 *                                                            ↓
 *                                              loadPrintContext()
 *                                                            ↓
 *                                              DocumentRenderer.render(host)
 *                                                            ↓
 *                                              Paged.js (isolado em PagedRenderer)
 *                                                            ↓
 *                                              window.print()  ← DOM JÁ paginado
 *
 * Quem decide a composição agora é o Document Engine, não o navegador.
 * O adapter Paged.js é detalhe interno e pode ser substituído sem
 * impacto neste arquivo.
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
  /* Visualização em tela: páginas A4 reais empilhadas. */
  .print-host { display: flex; flex-direction: column; align-items: center; gap: 8mm; padding: 8mm 0; }
  .print-host .pagedjs_page { background: #ffffff; box-shadow: 0 2px 16px rgba(0,0,0,0.08); }
  @media print {
    html, body { background: #ffffff !important; margin: 0 !important; padding: 0 !important; }
    .print-host { gap: 0 !important; padding: 0 !important; }
    .print-host .pagedjs_page { box-shadow: none !important; }
    .no-print { display: none !important; }
  }
`;

export default function LaudoPrintPage() {
  const { id } = useParams<{ id: string }>();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [ctx, setCtx] = useState<PrintContext | null>(null);
  const [status, setStatus] = useState<"idle" | "paginating" | "ready" | "error">("idle");
  const [pageCount, setPageCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const printedRef = useRef(false);

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

  useEffect(() => {
    if (!ctx) return;
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;

    const watermark: WatermarkSpec = ctx.watermark ?? { enabled: false, url: null, opacity: 0.08, sizePct: 60, rotation: 0 };
    const composed: ComposedDocument = {
      title: ctx.title,
      html: ctx.html,
      css: "",
      geometry: resolveGeometry(),
      watermark,
    };

    setStatus("paginating");
    (async () => {
      try {
        const result = await renderDocument(composed, host);
        if (cancelled) return;
        setPageCount(result.pageCount);
        setStatus("ready");

        if (!printedRef.current) {
          printedRef.current = true;
          window.setTimeout(() => {
            try { window.focus(); window.print(); } catch { /* noop */ }
            clearPrintContext();
          }, 120);
        }
      } catch (e) {
        if (cancelled) return;
        console.error("[Document Engine 3.0] Falha ao paginar:", e);
        setError("Não foi possível paginar o laudo.");
        setStatus("error");
      }
    })();

    return () => { cancelled = true; };
  }, [ctx]);

  const handleReprint = () => {
    try { window.focus(); window.print(); } catch { /* noop */ }
  };
  const handleClose = () => { try { window.close(); } catch { /* noop */ } };

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
      <style>{PAGED_RUNTIME_CSS}</style>
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-2 bg-background border-b">
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
      <div ref={hostRef} className="print-host" />
    </div>
  );
}
