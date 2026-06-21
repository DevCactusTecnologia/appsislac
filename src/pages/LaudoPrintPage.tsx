/**
 * LaudoPrintPage — página dedicada de visualização e impressão de laudo.
 *
 * Fluxo Worklab/SISLAC:
 *
 *   ResultadoDetalhe → savePrintContext(...) → window.open('/resultado/:id/print')
 *                                                            ↓
 *                                              loadPrintContext() + iframe
 *                                                            ↓
 *                                                    window.print() (vetorial)
 *                                                            ↓
 *                                                 clearPrintContext()
 *
 * Página mínima por contrato (constraint @worklab-style-print):
 *   • Sem sidebar, sem menu, sem dashboard, sem providers extras.
 *   • Apenas barra superior compacta com "Imprimir novamente" e "Fechar"
 *     (escondida na impressão via @media print).
 *   • Nenhuma query/render extra: o HTML chega pronto via sessionStorage.
 *   • Segurança: ProtectedRoute garante auth/permissão; o HTML embutido
 *     foi construído na sessão autenticada do mesmo usuário/tenant —
 *     RLS já filtrou na origem.
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

export default function LaudoPrintPage() {
  const { id } = useParams<{ id: string }>();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [ctx, setCtx] = useState<PrintContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const printedRef = useRef(false);

  // Carrega o contexto uma vez. Validação estrita: o atendimento da URL
  // precisa coincidir com o atendimento do contexto — protege contra
  // colagem manual de URL ou contexto residual de outra impressão.
  useEffect(() => {
    const loaded = loadPrintContext();
    if (!loaded) {
      setError("Sessão de impressão expirada ou inexistente. Volte ao laudo e clique em Imprimir novamente.");
      return;
    }
    if (id && loaded.atendimentoId !== id) {
      setError("Contexto de impressão inválido para este laudo.");
      return;
    }
    setCtx(loaded);
    // Atualiza título da janela (o Chrome usa como nome ao "Salvar como PDF").
    if (loaded.title) {
      try {
        document.title = loaded.title;
      } catch {
        /* noop */
      }
    }
  }, [id]);

  // Auto-print: dispara assim que o iframe terminar de carregar o laudo.
  // Não usa setTimeout arbitrário — escuta o `load` do iframe.
  useEffect(() => {
    if (!ctx) return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    const triggerPrint = () => {
      if (printedRef.current) return;
      printedRef.current = true;
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        /* noop */
      }
      // Limpa o contexto após disparar o print — evita reuso indevido.
      // O usuário ainda pode acionar "Imprimir novamente" via iframe.print().
      clearPrintContext();
    };

    iframe.addEventListener("load", triggerPrint, { once: true });
    // Caso o iframe já tenha carregado antes do listener (corrida), tenta agora.
    if (iframe.contentDocument?.readyState === "complete") {
      triggerPrint();
    }
    return () => {
      iframe.removeEventListener("load", triggerPrint);
    };
  }, [ctx]);

  const handleReprint = () => {
    try {
      iframeRef.current?.contentWindow?.focus();
      iframeRef.current?.contentWindow?.print();
    } catch {
      /* noop */
    }
  };

  const handleClose = () => {
    try {
      window.close();
    } catch {
      /* noop */
    }
  };

  if (error) {
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

  if (!ctx) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Carregando laudo…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-900">
      {/* Barra de ações — invisível na impressão */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-2 bg-background border-b print:hidden"
      >
        <div className="text-xs text-muted-foreground truncate" title={ctx.title}>
          {ctx.title}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="default" onClick={handleReprint}>
            <Printer className="h-4 w-4 mr-1.5" /> Imprimir
          </Button>
          <Button size="sm" variant="outline" onClick={handleClose}>
            <X className="h-4 w-4 mr-1.5" /> Fechar
          </Button>
        </div>
      </div>

      {/* O laudo é renderizado em iframe para isolar o `<html>/<head>/<style>`
          do laudo (com @page, @media print, fontes etc.) do shell do app.
          Na impressão, ocultamos o shell via `print:hidden` e expandimos o
          iframe para 100vh, deixando o laudo ocupar a página de impressão. */}
      <iframe
        ref={iframeRef}
        title="Laudo"
        srcDoc={ctx.html}
        className="w-full h-[calc(100vh-44px)] border-0 bg-white print:fixed print:inset-0 print:h-screen print:w-screen"
      />
    </div>
  );
}
