/**
 * SISLAC Document Engine 3.0 — barrel oficial.
 *
 * Exporta apenas a API pública do motor de documentos. Adapters
 * concretos (Paged.js) NÃO são re-exportados — quem precisa
 * renderizar usa `renderDocument` do DocumentRenderer.
 */

export type {
  DocumentBlock,
  DocumentBlockKind,
  PageGeometry,
  SemanticDocument,
  ComposedDocument,
  WatermarkSpec,
} from "./types";

export { DEFAULT_GEOMETRY, resolveGeometry, usefulWidthMm, usefulHeightMm } from "./LayoutEngine";
export { compose } from "./DocumentComposer";
export { renderDocument, activeAdapterName } from "./adapters/DocumentRenderer";
