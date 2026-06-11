import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download, X, Loader2, RectangleVertical, RectangleHorizontal, Maximize2, Minimize2 } from "lucide-react";
import { printHtmlInHiddenFrame } from "@/lib/printHtml";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { wrapHtmlAsA4Preview, type MapaOrientation } from "@/lib/mapaA4Preview";


export type { MapaOrientation };

interface MapaPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  html: string;
  titulo?: string;
  totalExames?: number;
  loading?: boolean;
  /** Orientação atual da pré-visualização. */
  orientation?: MapaOrientation;
  /** Disparado quando o usuário muda a orientação — o pai deve regerar o HTML. */
  onOrientationChange?: (o: MapaOrientation) => void;
}

export default function MapaPreviewDialog({
  open,
  onOpenChange,
  html,
  titulo = "Pré-visualização do mapa",
  totalExames,
  loading = false,
  orientation = "portrait",
  onOrientationChange,
}: MapaPreviewDialogProps) {
  const { theme } = useTheme();
  const [maximized, setMaximized] = useState(false);
  const previewHtml = useMemo(
    () => wrapHtmlAsA4Preview(html, orientation),
    [html, orientation, theme],
  );

  const handlePrint = () => {
    printHtmlInHiddenFrame({ html, frameId: "mapa-trabalho-print-frame" });
  };

  const handleDownload = () => {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    a.download = `mapa-trabalho-${stamp}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-0 flex flex-col gap-0 overflow-hidden",
          maximized
            ? "max-w-none w-screen h-screen rounded-none border-0"
            : "max-w-5xl w-[95vw] h-[90vh]",
        )}
      >
        <DialogHeader className="px-6 pr-14 py-4 border-b border-border/40">
          <DialogTitle asChild>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <span className="text-base font-semibold truncate">{titulo}</span>
                {typeof totalExames === "number" && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    · {totalExames} exame(s)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {onOrientationChange && (
                  <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-xl border border-border/30">
                    <button
                      type="button"
                      onClick={() => onOrientationChange("portrait")}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                        orientation === "portrait"
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      aria-label="Orientação retrato"
                    >
                      <RectangleVertical className="h-3.5 w-3.5" />
                      Retrato
                    </button>
                    <button
                      type="button"
                      onClick={() => onOrientationChange("landscape")}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                        orientation === "landscape"
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      aria-label="Orientação paisagem"
                    >
                      <RectangleHorizontal className="h-3.5 w-3.5" />
                      Paisagem
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setMaximized((v) => !v)}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label={maximized ? "Restaurar tamanho" : "Expandir tela"}
                  title={maximized ? "Restaurar" : "Expandir"}
                >
                  {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 bg-muted/30">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <iframe
              key={`${orientation}-${theme}`}
              title="Pré-visualização"
              srcDoc={previewHtml}
              className="w-full h-full border-0 bg-background"
            />
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/40 flex-row justify-between sm:justify-between gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="rounded-2xl gap-2 h-9">
            <X className="h-3.5 w-3.5" /> Fechar
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDownload} disabled={loading || !html} className="rounded-2xl gap-2 h-9">
              <Download className="h-3.5 w-3.5" /> Baixar HTML
            </Button>
            <Button size="sm" onClick={handlePrint} disabled={loading || !html} className="rounded-2xl gap-2 h-9">
              <Printer className="h-3.5 w-3.5" /> Imprimir
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
