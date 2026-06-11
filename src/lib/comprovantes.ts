// ----------------------------------------------------------------------------
// SISLAC Document Ownership (IA-first semantics) — RECEIPTS LAYER (FACHADA)
//   Lab Data  = institutional identity  (labConfigStore — SINGLE SOURCE)
//   Documents = reusable templates      (documentoTemplatesStore)
//   Receipts  = OPERATIONAL INSTANCES   (orquestração neste arquivo)
//
// Este arquivo é uma fachada fina sobre os domain services em
// `src/domains/result/services/`:
//   - comprovantesHtml      → builders HTML (header, rodapé, recibos, orçamento)
//   - comprovantesRender    → pipeline PDF (html2pdf, cache, progresso)
//   - comprovantesUpload    → upload + shortlink (edge functions)
//   - comprovantesWhatsapp  → envio via WhatsApp Cloud + buildWaUrl
//   - comprovantesValidation → códigos de verificação + validação legal
//
// A API pública histórica (`gerar*PDF`, `enviar*PorWhatsapp`, `build*Html`,
// `codigoVerificacao*`, `validarLaboratorioParaComprovante`) é preservada via
// re-exports — nenhum caller precisa mudar.
// ----------------------------------------------------------------------------
import { ensureLabLogoLoaded } from "@/data/labConfigStore";
import { fmtBRL } from "@/lib/utils";

// ── Render pipeline (PDF) ───────────────────────────────────────────────────
import {
  renderToBlob,
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
  tipoConfig,
  type ComprovanteData,
  type OrcamentoPDFData,
} from "@/domains/result/services/comprovantesHtml";
export {
  buildComprovanteHtml,
  buildDocumentoFooterHtml,
  buildOrcamentoHtmlPublic,
  valorPorExtenso,
  type ComprovanteTipo,
  type ComprovanteData,
  type OrcamentoPDFData,
} from "@/domains/result/services/comprovantesHtml";

// ── Upload + shortlink + WhatsApp ───────────────────────────────────────────
import {
  uploadPdfAndGetUrl,
  criarShortlinkPdf,
} from "@/domains/result/services/comprovantesUpload";
import {
  enviarPdfWhatsappCloud,
  buildWaUrl,
} from "@/domains/result/services/comprovantesWhatsapp";
export { uploadPdfAndGetUrl, criarShortlinkPdf, enviarPdfWhatsappCloud };

// ============================================================================
// Orquestração — geração local (download) e envio por WhatsApp.
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

export async function enviarOrcamentoPorWhatsapp(
  o: OrcamentoPDFData,
  telefone?: string,
): Promise<void> {
  await ensureLabLogoLoaded();
  let pdfUrl: string | null = null;
  try {
    const blob = await renderToBlob(buildOrcamentoHtml(o));
    pdfUrl = await uploadPdfAndGetUrl(blob, `orcamento-${o.id}.pdf`);
  } catch (err) {
    void err;
    await gerarOrcamentoPDF(o); // fallback: baixa o PDF
  }
  const examesList = o.exames.map((e, i) => `  ${i + 1}. ${e}`).join("\n");
  const linkLine = pdfUrl
    ? `📎 *PDF:* ${pdfUrl}`
    : `📎 O PDF do orçamento foi baixado — anexe o arquivo a esta conversa.`;
  const msg = [
    `📋 *ORÇAMENTO ${o.id}*`,
    "",
    `Olá *${o.paciente}*, segue o orçamento solicitado:`,
    "",
    `🏥 Convênio: ${o.convenio}`,
    o.solicitante ? `👨‍⚕️ Solicitante: ${o.solicitante}` : "",
    "",
    `🔬 *Exames (${o.exames.length}):*`,
    examesList,
    "",
    `💰 *Total: ${fmtBRL(o.total)}*`,
    "",
    linkLine,
  ].filter(Boolean).join("\n");
  window.open(buildWaUrl(telefone, msg), "_blank");
}

export async function enviarComprovantePorWhatsapp(
  d: ComprovanteData,
  telefone?: string,
): Promise<void> {
  const v = validarLaboratorioParaComprovante(d.tipo);
  if (!v.ok) {
    const erro = new Error(
      `Não foi possível enviar o comprovante. Configure os dados legais do laboratório:\n\n• ${v.erros.join("\n• ")}`,
    );
    (erro as Error & { code?: string }).code = "LAB_CONFIG_INCOMPLETA";
    throw erro;
  }
  await ensureLabLogoLoaded();
  let pdfUrl: string | null = null;
  try {
    const blob = await renderToBlob(buildComprovanteHtml(d), COMPROVANTE_TO_DOCUMENTO_TIPO[d.tipo]);
    const longUrl = await uploadPdfAndGetUrl(
      blob,
      `comprovante-${d.tipo}-${d.protocolo}.pdf`,
    );
    const short = await criarShortlinkPdf({
      pdfUrl: longUrl,
      protocolo: d.protocolo,
      tipo: d.tipo,
    });
    pdfUrl = short?.shortUrl ?? longUrl;
  } catch (err) {
    void err;
    await gerarComprovantePDF(d);
  }
  const tipoLabel = tipoConfig[d.tipo].label;
  const totalLine = d.totais ? `\n💰 *Total: ${fmtBRL(d.totais.total)}*` : "";
  const linkLine = pdfUrl
    ? `📎 *PDF:* ${pdfUrl}`
    : `📎 O PDF foi baixado — anexe o arquivo a esta conversa.`;
  const msg = [
    `📋 *${tipoLabel}*`,
    `Protocolo: *${d.protocolo}*`,
    `Data: ${d.data}`,
    "",
    `Olá *${d.paciente.nome}*, segue seu comprovante.${totalLine}`,
    "",
    linkLine,
  ].join("\n");
  window.open(buildWaUrl(telefone, msg), "_blank");
}
