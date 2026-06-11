// PDF render pipeline (html2pdf.js) + cache LRU + progresso/cancelamento.
// Extraído de src/lib/comprovantes.ts (Fase: domain slicing).
// Comportamento preservado literalmente; comprovantes.ts re-exporta o
// contrato público para retro-compat de imports antigos.
import { getTemplatePadrao, type DocumentoTipo } from "@/data/documentoTemplatesStore";

/** Margens default (mm) — usadas quando o template não define margens próprias. */
const DEFAULT_MARGINS_MM: [number, number, number, number] = [18, 18, 22, 18];

/**
 * Resolve as margens de impressão (em mm) configuradas no template padrão
 * do tipo de documento informado. Cada documento tem suas próprias margens,
 * editadas em Configurações → Documentos → editor de template.
 */
export function getDocumentoMarginsMm(
  tipo?: DocumentoTipo,
): [number, number, number, number] {
  if (!tipo) return [...DEFAULT_MARGINS_MM];
  const tpl = getTemplatePadrao(tipo);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = (tpl?.config as any)?.margins as
    | { top?: number; right?: number; bottom?: number; left?: number }
    | undefined;
  if (!m) return [...DEFAULT_MARGINS_MM];
  const pick = (v: unknown, fb: number) => (Number.isFinite(Number(v)) ? Number(v) : fb);
  return [
    pick(m.top, DEFAULT_MARGINS_MM[0]),
    pick(m.right, DEFAULT_MARGINS_MM[1]),
    pick(m.bottom, DEFAULT_MARGINS_MM[2]),
    pick(m.left, DEFAULT_MARGINS_MM[3]),
  ];
}

// html2pdf.js (~370 KB minificado) é caro para entrar no chunk inicial — só é
// necessário quando o usuário efetivamente gera/imprime/baixa um PDF. Carregamos
// dinamicamente e cacheamos a Promise para não duplicar requisições.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let html2pdfPromise: Promise<any> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loadHtml2Pdf(): Promise<any> {
  if (!html2pdfPromise) {
    html2pdfPromise = import("html2pdf.js").then((m) => (m as { default: unknown }).default ?? m);
  }
  return html2pdfPromise;
}

// Same as renderAndSave but returns the PDF as a Blob (no auto-download).
export async function renderToBlob(html: string, tipo?: DocumentoTipo): Promise<Blob> {
  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.left = "-10000px";
  wrapper.style.top = "0";
  wrapper.style.width = "640px";
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);
  try {
    const html2pdf = await loadHtml2Pdf();
    const blob: Blob = await html2pdf()
      .set({
        margin: getDocumentoMarginsMm(tipo),
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", letterRendering: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"], avoid: ["tr", "table", ".no-break"] },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .from(wrapper.firstElementChild as HTMLElement)
      .outputPdf("blob");
    return blob;
  } finally {
    wrapper.remove();
  }
}

// ===== Cancellable + progress-aware PDF rendering with module-level cache =====

export type RenderStage =
  | "preparing"
  | "rendering"   // html2canvas
  | "converting"  // jsPDF
  | "finalizing"
  | "done";

export interface RenderProgress {
  stage: RenderStage;
  /** 0..1 estimate based on current stage. */
  progress: number;
  label: string;
}

export class RenderCancelledError extends Error {
  constructor() {
    super("PDF generation cancelled");
    this.name = "RenderCancelledError";
  }
}

export interface RenderOptions {
  signal?: AbortSignal;
  onProgress?: (p: RenderProgress) => void;
}

const stageMeta: Record<RenderStage, { progress: number; label: string }> = {
  preparing:  { progress: 0.05, label: "Preparando documento..." },
  rendering:  { progress: 0.25, label: "Renderizando layout (html2canvas)..." },
  converting: { progress: 0.7,  label: "Convertendo para PDF (jsPDF)..." },
  finalizing: { progress: 0.92, label: "Finalizando arquivo..." },
  done:       { progress: 1,    label: "Concluído" },
};

function emit(opts: RenderOptions | undefined, stage: RenderStage) {
  const m = stageMeta[stage];
  opts?.onProgress?.({ stage, progress: m.progress, label: m.label });
}

function checkCancel(opts: RenderOptions | undefined) {
  if (opts?.signal?.aborted) throw new RenderCancelledError();
}

// FNV-1a 32-bit hash — leve e suficiente para chave de cache do HTML.
function hashHtml(html: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < html.length; i++) {
    h ^= html.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16);
}

/** Cache LRU simples (até 8 PDFs) por (chave do consumidor + hash do HTML). */
const PDF_CACHE_MAX = 8;
const pdfBlobCache = new Map<string, Blob>();

function cacheKey(scope: string | undefined, html: string): string {
  return `${scope ?? "default"}::${hashHtml(html)}`;
}

export function getCachedPdfBlob(scope: string | undefined, html: string): Blob | null {
  const key = cacheKey(scope, html);
  const blob = pdfBlobCache.get(key);
  if (!blob) return null;
  // Touch — move ao final (LRU)
  pdfBlobCache.delete(key);
  pdfBlobCache.set(key, blob);
  return blob;
}

function setCachedPdfBlob(scope: string | undefined, html: string, blob: Blob) {
  const key = cacheKey(scope, html);
  pdfBlobCache.delete(key);
  pdfBlobCache.set(key, blob);
  while (pdfBlobCache.size > PDF_CACHE_MAX) {
    const first = pdfBlobCache.keys().next().value;
    if (first === undefined) break;
    pdfBlobCache.delete(first);
  }
}

export function clearPdfBlobCache(scope?: string) {
  if (!scope) {
    pdfBlobCache.clear();
    return;
  }
  const prefix = `${scope}::`;
  for (const k of [...pdfBlobCache.keys()]) {
    if (k.startsWith(prefix)) pdfBlobCache.delete(k);
  }
}

/**
 * Geração de PDF com etapas observáveis e cancelamento cooperativo.
 * - `signal`: AbortSignal para cancelar (aborta nos pontos entre etapas).
 * - `onProgress`: callback de progresso por estágio.
 * - `cacheScope`: chave estável (ex.: protocolo) para cache compartilhado entre aberturas.
 */
export async function renderToBlobAdvanced(
  html: string,
  opts: RenderOptions & { cacheScope?: string; tipo?: DocumentoTipo } = {},
): Promise<Blob> {
  // 1) Cache hit — devolve sem trabalho.
  const cached = getCachedPdfBlob(opts.cacheScope, html);
  if (cached) {
    emit(opts, "done");
    return cached;
  }

  checkCancel(opts);
  emit(opts, "preparing");

  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.left = "-10000px";
  wrapper.style.top = "0";
  wrapper.style.width = "640px";
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);

  try {
    checkCancel(opts);

    // html2pdf expõe um worker com etapas encadeáveis: toContainer → toCanvas → toPdf → output.
    // Isso permite emitir progresso real entre etapas e checar cancelamento.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const html2pdf = await loadHtml2Pdf();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const worker: any = html2pdf()
      .set({
        margin: getDocumentoMarginsMm(opts.tipo),
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", letterRendering: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"], avoid: ["tr", "table", ".no-break"] },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .from(wrapper.firstElementChild as HTMLElement);

    emit(opts, "rendering");
    await worker.toContainer();
    checkCancel(opts);
    await worker.toCanvas();
    checkCancel(opts);

    emit(opts, "converting");
    await worker.toPdf();
    checkCancel(opts);

    emit(opts, "finalizing");
    const blob: Blob = await worker.output("blob");
    checkCancel(opts);

    setCachedPdfBlob(opts.cacheScope, html, blob);
    emit(opts, "done");
    return blob;
  } finally {
    wrapper.remove();
  }
}
