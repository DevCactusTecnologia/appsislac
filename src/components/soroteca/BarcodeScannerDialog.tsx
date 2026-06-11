// Diálogo de leitura de código de barras via câmera.
// Usa a Web BarcodeDetector API (Chrome/Edge/Android nativo). Quando indisponível,
// orienta o usuário a usar leitor USB/Bluetooth — que segue funcionando no fundo
// via captura de teclado (HID) feita pela página Soroteca.

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Barcode, Camera, Keyboard, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (codigo: string) => void;
}

// Fallback declarativo — a tipagem do BarcodeDetector ainda não está em lib.dom
// em todos os ambientes TS. Mantemos o uso defensivo.
type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
};

function getBarcodeDetector(): BarcodeDetectorLike | null {
  const w = window as unknown as {
    BarcodeDetector?: new (opts?: { formats?: string[] }) => BarcodeDetectorLike;
  };
  if (!w.BarcodeDetector) return null;
  try {
    return new w.BarcodeDetector({
      formats: ["code_128", "code_39", "ean_13", "ean_8", "qr_code", "itf"],
    });
  } catch {
    return null;
  }
}

export default function BarcodeScannerDialog({ open, onOpenChange, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const [supported, setSupported] = useState<boolean>(true);
  const [running, setRunning] = useState<boolean>(false);
  const [erro, setErro] = useState<string | null>(null);
  const [manual, setManual] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    const det = getBarcodeDetector();
    detectorRef.current = det;
    setSupported(!!det);
    setErro(null);
    if (det) startCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setRunning(true);
        loop();
      }
    } catch (e) {
      // Camera error — UI exibe estado de erro via setErro abaixo.
      void e;
      setErro("Não foi possível acessar a câmera. Verifique as permissões do navegador.");
    }
  }

  function stopCamera() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setRunning(false);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  async function loop() {
    const det = detectorRef.current;
    const video = videoRef.current;
    if (!det || !video) return;
    try {
      if (video.readyState >= 2 && video.videoWidth > 0) {
        const codes = await det.detect(video);
        const first = codes[0]?.rawValue?.trim();
        if (first) {
          handleDetected(first);
          return;
        }
      }
    } catch (e) {
      // erros transitórios — continuamos
      console.debug("[scanner] detect error", e);
    }
    rafRef.current = requestAnimationFrame(loop);
  }

  function handleDetected(codigo: string) {
    stopCamera();
    onDetected(codigo);
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = manual.trim();
    if (!v) {
      toast.error("Informe um código.");
      return;
    }
    handleDetected(v);
    setManual("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Barcode className="w-5 h-5" />
            Ler código de barras
          </DialogTitle>
          <DialogDescription>
            Aponte a câmera para o código da amostra. Leitores USB/Bluetooth também
            funcionam — basta disparar a leitura com a página aberta.
          </DialogDescription>
        </DialogHeader>

        {supported ? (
          <div className="space-y-3">
            <div className="relative rounded-xl overflow-hidden border border-border bg-black aspect-video">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              {/* moldura guia */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-3/4 h-1/3 border-2 border-primary/70 rounded-md shadow-[0_0_0_2000px_rgba(0,0,0,0.25)]" />
              </div>
              {!running && !erro && (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-white/80">
                  Iniciando câmera…
                </div>
              )}
            </div>
            {erro && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2 text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span className="text-foreground/80">{erro}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-muted/30 p-4 flex items-start gap-3">
            <Camera className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">
                Leitura por câmera não suportada neste navegador.
              </p>
              <p>
                Use um leitor USB/Bluetooth (modo HID) — basta disparar o código com a
                página Soroteca aberta. Ou digite o código manualmente abaixo.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleManualSubmit} className="flex items-center gap-2 pt-1">
          <div className="relative flex-1">
            <Keyboard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              autoFocus
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="Ou digite/cole o código…"
              className="pl-9 font-mono"
            />
          </div>
          <Button type="submit" size="sm">
            Buscar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
