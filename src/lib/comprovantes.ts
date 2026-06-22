// ----------------------------------------------------------------------------
// SISLAC Document Ownership (IA-first semantics) — RECEIPTS LAYER (FACHADA)
//   Lab Data  = institutional identity  (labConfigStore — SINGLE SOURCE)
//   Documents = reusable templates      (documentoTemplatesStore)
//   Receipts  = OPERATIONAL INSTANCES   (orquestração neste arquivo)
//
// FASE 3D.1 (Onda 1) — Notificações WhatsApp:
//   O envio via WhatsApp dos PDFs operacionais (comprovante de atendimento,
//   orçamento) é feito EXCLUSIVAMENTE pela arquitetura Meta Centralizada:
//     enqueueNotification() → whatsapp_outbox → whatsapp-dispatcher → Meta
//
//   Helpers `enviarOrcamentoPorWhatsapp`, `enviarComprovantePorWhatsapp` e
//   `buildWaUrl` foram REMOVIDOS. Não há mais wa.me, links manuais ou envio
//   direto para a Graph API a partir do front. Os componentes de preview
//   (PdfPreviewDialog) recebem a prop `notify` e disparam a outbox.
// ----------------------------------------------------------------------------
import { ensureLabLogoLoaded } from "@/data/labConfigStore";

// ── Render pipeline (PDF) ───────────────────────────────────────────────────
import {
  renderAndSave,
} from "@/domains/result/services/comprovantesRender";
export {
  getDocumentoMarginsMm,
  renderToBlob,
  renderToBlobAdvanced,
  getCachedPdfBlob,
  clearPdfBlobCache,
  RenderCancelledError,
  type RenderStage,
  type RenderProgress,
  type RenderOptions,
} from "@/domains/result/services/comprovantesRender";

// ── Validação legal + códigos de verificação ────────────────────────────────
import { validarLaboratorioParaComprovante } from "@/domains/result/services/comprovantesValidation";
export {
  codigoVerificacao,
  codigoVerificacaoDeComprovante,
  validarLaboratorioParaComprovante,
} from "@/domains/result/services/comprovantesValidation";

// ── HTML builders (recibos + orçamento) ─────────────────────────────────────
import {
  buildComprovanteHtml,
  buildOrcamentoHtml,
  COMPROVANTE_TO_DOCUMENTO_TIPO,
  type ComprovanteData,
  type OrcamentoPDFData,
} from "@/domains/result/services/comprovantesHtml";
export {
  buildComprovanteHtml,
  buildOrcamentoHtml,
  buildDocumentoFooterHtml,
  valorPorExtenso,
  type ComprovanteTipo,
  type ComprovanteData,
  type OrcamentoPDFData,
} from "@/domains/result/services/comprovantesHtml";

// ── Upload + shortlink ──────────────────────────────────────────────────────
import {
  uploadPdfAndGetUrl,
  criarShortlinkPdf,
} from "@/domains/result/services/comprovantesUpload";
export { uploadPdfAndGetUrl, criarShortlinkPdf };

// ============================================================================
// Geração local (download). O envio por WhatsApp foi removido — use
// `enqueueNotification` em `@/lib/whatsapp/enqueueNotification` via o
// componente `PdfPreviewDialog` (prop `notify`).
// ============================================================================

export async function gerarOrcamentoPDF(o: OrcamentoPDFData): Promise<void> {
  await ensureLabLogoLoaded();
  await renderAndSave(buildOrcamentoHtml(o), `orcamento-${o.id}.pdf`);
}

export async function gerarComprovantePDF(d: ComprovanteData): Promise<void> {
  const v = validarLaboratorioParaComprovante(d.tipo);
  if (!v.ok) {
    const erro = new Error(
      `Não foi possível emitir o comprovante. Configure os dados legais do laboratório:\n\n• ${v.erros.join("\n• ")}`,
    );
    (erro as Error & { code?: string }).code = "LAB_CONFIG_INCOMPLETA";
    throw erro;
  }
  await ensureLabLogoLoaded();
  await renderAndSave(
    buildComprovanteHtml(d),
    `comprovante-${d.tipo}-${d.protocolo}.pdf`,
    COMPROVANTE_TO_DOCUMENTO_TIPO[d.tipo],
  );
}
