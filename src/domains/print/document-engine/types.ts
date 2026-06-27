/**
 * SISLAC Document Engine 3.0 — Tipos do documento semântico.
 *
 * Um documento é composto por BLOCOS, não por HTML. O Document Engine
 * orquestra a composição; o Render Adapter materializa em páginas.
 *
 * Nenhum tipo aqui conhece a engine de renderização (Paged.js etc.).
 */

export type DocumentBlockKind =
  | "header"
  | "watermark"
  | "body"
  | "exam"
  | "signature"
  | "footer";

export interface DocumentBlock {
  kind: DocumentBlockKind;
  /** Identificador estável (ex.: id do exame). */
  id?: string;
  /** HTML interno do bloco. Já sanitizado quando aplicável. */
  html: string;
  /** Se true, o bloco NÃO pode ser fragmentado entre páginas. */
  unbreakable?: boolean;
}

export interface PageGeometry {
  /** Margens da página A4 em mm. */
  marginTopMm: number;
  marginRightMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
}

export interface WatermarkSpec {
  enabled: boolean;
  url: string | null;
  opacity: number;
  sizePct: number;
  rotation: number;
}

export interface SemanticDocument {
  /** Título do arquivo (Chrome usa em "Salvar como PDF"). */
  title: string;
  /** Geometria da página. */
  geometry: PageGeometry;
  /** Cabeçalho (mesmo HTML em todas as páginas). */
  header: DocumentBlock;
  /** Rodapé (mesmo HTML em todas as páginas). */
  footer: DocumentBlock;
  /** Marca d'água global. */
  watermark: WatermarkSpec;
  /** Sequência ordenada de blocos do corpo (exames + assinatura). */
  body: DocumentBlock[];
  /** CSS adicional específico do documento (templates científicos etc.). */
  css?: string;
}

/** Saída do Document Composer pronta para o Render Adapter. */
export interface ComposedDocument {
  title: string;
  /** HTML completo do <body>. */
  html: string;
  /** CSS completo já com @page/running elements/break rules. */
  css: string;
  /** Geometria preservada para o adapter. */
  geometry: PageGeometry;
  /** Spec da marca d'água preservada para o adapter (injetada por página). */
  watermark: WatermarkSpec;
}
