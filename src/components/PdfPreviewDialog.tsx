import { useEffect, useRef, useState } from "react";
import { FileText, Download, Printer, Send, Loader2, Link2, Check, Share2, X } from "lucide-react";
import StandardDialog from "@/components/ui/standard-dialog";
import { toast } from "@/hooks/use-toast";
import {
  renderToBlobAdvanced,
  getCachedPdfBlob,
  RenderCancelledError,
  type RenderProgress,
  uploadPdfAndGetUrl,
  criarShortlinkPdf,
  enviarPdfWhatsappCloud,
  buildWaUrl,
  type ComprovanteTipo,
} from "@/lib/comprovantes";

interface PdfPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  /** HTML markup to render as PDF (use buildComprovanteHtml / buildOrcamentoHtml). */
  html: string;
  /** Filename used for download and upload (without forcing .pdf — added if missing). */
  filename: string;
  /** Title shown in the dialog header. */
  title?: string;
  /** Optional subtitle (e.g., protocol · date). */
  subtitle?: string;
  /** WhatsApp recipient phone (digits, will be normalized). */
  whatsappPhone?: string;
  /**
   * Builder for the WhatsApp message. Receives the public PDF URL once
   * the upload finishes. If omitted, the WhatsApp button stays hidden.
   */
  buildWhatsappMessage?: (publicUrl: string) => string;
  /**
   * Identificadores opcionais usados para encurtar o link e para tentar o
   * envio via WhatsApp Cloud API (Meta). Se omitidos, o botão usa apenas
   * wa.me com a URL longa.
   */
  comprovante?: { protocolo: string; tipo: ComprovanteTipo };
}


const PdfPreviewDialog = ({
  open,
  onClose,
  html,
  filename,
  title = "Pré-visualização do PDF",
  subtitle,
  whatsappPhone,
  buildWhatsappMessage,
  comprovante,
}: PdfPreviewDialogProps) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [activeAction, setActiveAction] = useState<"print" | "download" | "copy" | "whatsapp" | null>(null);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<RenderProgress | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  
  const isMobileShareCapable =
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent || "");

  const lastRenderedRef = useRef<string | null>(null);

  const cacheScope = comprovante
    ? `${comprovante.tipo}:${comprovante.protocolo}`
    : filename;

  useEffect(() => {
    if (!open) {
      lastRenderedRef.current = null;
      setBlob(null);
      setBlobUrl(null);
      setCopiedUrl(null);
      setProgress(null);
      setActiveAction(null);
      abortRef.current?.abort();
      abortRef.current = null;
      return;
    }
    if (lastRenderedRef.current === html) return;
    lastRenderedRef.current = html;
    setCopiedUrl(null);
    setProgress(null);

    const cached = getCachedPdfBlob(cacheScope, html);
    if (cached) {
      const url = URL.createObjectURL(cached);
      setBlob(cached);
      setBlobUrl(url);
    } else {
      setBlob(null);
      setBlobUrl(null);
    }
  }, [open, html, cacheScope]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  const ensureBlob = async (): Promise<{ blob: Blob; url: string } | null> => {
    if (blob && blobUrl) return { blob, url: blobUrl };
    const cached = getCachedPdfBlob(cacheScope, html);
    if (cached) {
      const url = URL.createObjectURL(cached);
      setBlob(cached);
      setBlobUrl(url);
      return { blob: cached, url };
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setGenerating(true);
    setProgress({ stage: "preparing", progress: 0.05, label: "Preparando documento..." });
    try {
      const generated = await renderToBlobAdvanced(html, {
        signal: ctrl.signal,
        cacheScope,
        tipo: comprovante
          ? (comprovante.tipo === "pagamento"
              ? "comprovante_pagamento"
              : comprovante.tipo === "atendimento"
              ? "comprovante_atendimento"
              : "declaracao_comparecimento")
          : undefined,
        onProgress: (p) => setProgress(p),
      });
      const url = URL.createObjectURL(generated);
      setBlob(generated);
      setBlobUrl(url);
      return { blob: generated, url };
    } catch (e) {
      if (e instanceof RenderCancelledError) {
        toast({ title: "Geração cancelada", description: "O PDF não foi gerado." });
      } else {
        toast({ title: "Erro ao gerar PDF", description: "Tente novamente.", variant: "destructive" });
      }
      return null;
    } finally {
      abortRef.current = null;
      setGenerating(false);
      setProgress(null);
    }
  };

  const handleCancelGeneration = () => {
    abortRef.current?.abort();
  };

  const safeFilename = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;

  const handleDownload = async () => {
    setActiveAction("download");
    const r = await ensureBlob();
    if (!r) {
      setActiveAction(null);
      return;
    }
    const a = document.createElement("a");
    a.href = r.url;
    a.download = safeFilename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setActiveAction(null);
  };

  const handlePrint = async () => {
    setActiveAction("print");
    const r = await ensureBlob();
    if (!r) {
      setActiveAction(null);
      return;
    }
    const existing = document.getElementById("pdf-print-frame") as HTMLIFrameElement | null;
    if (existing) existing.remove();
    const iframe = document.createElement("iframe");
    iframe.id = "pdf-print-frame";
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.src = r.url;
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        void handleDownload();
        toast({ title: "Impressão bloqueada", description: "PDF baixado. Abra o arquivo para imprimir.", variant: "destructive" });
      } finally {
        setActiveAction(null);
      }
    };
    document.body.appendChild(iframe);
  };

  const handleWhatsapp = async () => {
    if (!buildWhatsappMessage) return;
    setActiveAction("whatsapp");
    const r = await ensureBlob();
    if (!r) {
      setActiveAction(null);
      return;
    }
    setSending(true);
    try {
      const longUrl = await uploadPdfAndGetUrl(r.blob, safeFilename);
      let shareUrl = longUrl;
      if (comprovante) {
        const short = await criarShortlinkPdf({
          pdfUrl: longUrl,
          protocolo: comprovante.protocolo,
          tipo: comprovante.tipo,
        });
        if (short?.shortUrl) shareUrl = short.shortUrl;
      }

      if (whatsappPhone && comprovante) {
        try {
          await enviarPdfWhatsappCloud({
            telefone: whatsappPhone,
            pdfUrl: longUrl,
            filename: safeFilename,
            caption: buildWhatsappMessage("").replace(/📎.*$/m, "").trim(),
            protocolo: comprovante.protocolo,
            tipo: comprovante.tipo,
          });
          toast({
            title: "Enviado pela WhatsApp Cloud API",
            description: "Anexo entregue diretamente para o paciente.",
          });
          setCopiedUrl(shareUrl);
          return;
        } catch (err) {
          const code = (err as Error & { code?: string })?.code;
          if (code !== "WHATSAPP_NAO_CONFIGURADO") {
            toast({
              title: "Falha no envio oficial",
              description: "Caindo no link via WhatsApp Web.",
              variant: "destructive",
            });
          }
        }
      }

      const msg = buildWhatsappMessage(shareUrl);
      window.open(buildWaUrl(whatsappPhone, msg), "_blank");
      setCopiedUrl(shareUrl);
      toast({ title: "Link gerado", description: "Mensagem do WhatsApp aberta com o link do PDF." });
    } catch (e) {
      void handleDownload();
      const fallback = buildWhatsappMessage("");
      const cleaned = fallback.replace(/📎.*$/m, "📎 O PDF foi baixado — anexe o arquivo a esta conversa.");
      window.open(buildWaUrl(whatsappPhone, cleaned), "_blank");
      toast({ title: "Falha no upload", description: "PDF baixado para anexo manual.", variant: "destructive" });
    } finally {
      setSending(false);
      setActiveAction(null);
    }
  };

  const handleShareMobile = async () => {
    setActiveAction("whatsapp");
    const r = await ensureBlob();
    if (!r) {
      setActiveAction(null);
      return;
    }
    try {
      const file = new File([r.blob], safeFilename, { type: "application/pdf" });
      const shareData: ShareData & { files?: File[] } = {
        files: [file],
        title: title,
        text: buildWhatsappMessage ? buildWhatsappMessage("").replace(/📎.*$/m, "").trim() : "",
      };
      if (typeof navigator.canShare === "function" && !navigator.canShare(shareData)) {
        throw new Error("share_unsupported");
      }
      await navigator.share(shareData);
    } catch (e) {
      const name = (e as Error)?.name;
      if (name !== "AbortError") {
        await handleWhatsapp();
      }
    } finally {
      setActiveAction(null);
    }
  };

  const handleCopyLink = async () => {
    if (copiedUrl) {
      try {
        await navigator.clipboard.writeText(copiedUrl);
        toast({ title: "Link copiado", description: "O link público do PDF foi copiado novamente." });
      } catch {
        toast({ title: "Não foi possível copiar", description: copiedUrl, variant: "destructive" });
      }
      return;
    }
    setActiveAction("copy");
    const r = await ensureBlob();
    if (!r) {
      setActiveAction(null);
      return;
    }
    setCopying(true);
    try {
      const url = await uploadPdfAndGetUrl(r.blob, safeFilename);
      try {
        await navigator.clipboard.writeText(url);
        toast({ title: "Link copiado!", description: "Cole em e-mails, chats ou onde quiser compartilhar." });
      } catch {
        toast({ title: "Link gerado", description: url });
      }
      setCopiedUrl(url);
    } catch (e) {
      toast({ title: "Falha ao gerar link", description: "Tente novamente em instantes.", variant: "destructive" });
    } finally {
      setCopying(false);
      setActiveAction(null);
    }
  };

  return (
    <StandardDialog
      open={open}
      onClose={onClose}
      icon={<FileText className="h-5 w-5 text-primary" />}
      title={title}
      subtitle={subtitle}
      maxWidth="5xl"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2 w-full">
          {generating && progress && (
            <div className="mr-auto flex items-center gap-3 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                <span className="font-medium text-foreground">{progress.label}</span>
              </div>
              <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${Math.round(progress.progress * 100)}%` }}
                />
              </div>
              <span className="tabular-nums">{Math.round(progress.progress * 100)}%</span>
              <button
                onClick={handleCancelGeneration}
                className="h-7 px-2 rounded-md border border-border bg-card text-[11px] font-semibold text-foreground hover:border-destructive/40 hover:text-destructive transition-all flex items-center gap-1"
              >
                <X className="h-3 w-3" />
                Cancelar
              </button>
            </div>
          )}
          <button
            onClick={onClose}
            className="h-10 px-4 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted/40 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handlePrint}
            disabled={generating || (activeAction !== null && activeAction !== "print")}
            className="h-10 px-4 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:border-primary/40 hover:bg-muted/40 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {activeAction === "print" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
            {activeAction === "print" ? (generating ? "Gerando..." : "Imprimindo...") : "Imprimir"}
          </button>
          <button
            onClick={handleDownload}
            disabled={generating || (activeAction !== null && activeAction !== "download")}
            className="h-10 px-4 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:border-primary/40 hover:bg-muted/40 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {activeAction === "download" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {activeAction === "download" ? (generating ? "Gerando..." : "Baixando...") : "Baixar PDF"}
          </button>
          <button
            onClick={handleCopyLink}
            disabled={generating || (activeAction !== null && activeAction !== "copy")}
            className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {activeAction === "copy" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : copiedUrl ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Link2 className="h-3.5 w-3.5" />
            )}
            {activeAction === "copy" ? (generating ? "Gerando..." : "Enviando...") : copiedUrl ? "Link copiado" : "Copiar link"}
          </button>
          {buildWhatsappMessage && (
            isMobileShareCapable ? (
              <button
                onClick={handleShareMobile}
                disabled={generating || (activeAction !== null && activeAction !== "whatsapp")}
                className="h-10 px-4 rounded-xl bg-[hsl(var(--status-success))] text-white text-xs font-semibold hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {activeAction === "whatsapp" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
                {activeAction === "whatsapp" ? (generating ? "Gerando..." : "Compartilhando...") : "Compartilhar PDF"}
              </button>
            ) : (
              <button
                onClick={handleWhatsapp}
                disabled={generating || (activeAction !== null && activeAction !== "whatsapp")}
                className="h-10 px-4 rounded-xl bg-[hsl(var(--status-success))] text-white text-xs font-semibold hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {activeAction === "whatsapp" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {activeAction === "whatsapp" ? (generating ? "Gerando..." : "Enviando...") : "Enviar WhatsApp"}
              </button>
            )
          )}
        </div>
      }
    >
      <div className="bg-muted/40 h-[70vh] overflow-auto p-6 flex justify-center">
        {html ? (
          <div
            className="bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)] rounded-sm border border-border/40"
            style={{
              width: "210mm",
              minHeight: "297mm",
              padding: "10mm",
              boxSizing: "border-box",
              flexShrink: 0,
            }}
          >
            <iframe
              srcDoc={html}
              title="Pré-visualização do PDF"
              className="w-full h-full bg-white border-0"
              style={{ minHeight: "calc(297mm - 20mm)" }}
            />
          </div>
        ) : (
          <div className="self-center flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-xs">Gerando pré-visualização...</p>
          </div>
        )}
      </div>
    </StandardDialog>
  );
};

export default PdfPreviewDialog;
