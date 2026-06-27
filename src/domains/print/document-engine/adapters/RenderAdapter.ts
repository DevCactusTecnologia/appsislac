/**
 * RenderAdapter — interface oficial de renderização do Document Engine.
 *
 * Toda implementação concreta (Paged.js, futura WeasyPrint server-side,
 * Chrome headless puro etc.) deve respeitar este contrato.
 *
 * A regra é estrita: NENHUM código do SISLAC fora de `adapters/` pode
 * importar a biblioteca de renderização. Toda chamada passa pelo
 * DocumentRenderer (facade) que delega ao adapter ativo.
 */

import type { ComposedDocument } from "../types";

export interface RenderOptions {
  /** Documento a ser renderizado. */
  document: ComposedDocument;
  /** Elemento host onde o adapter deve materializar as páginas. */
  host: HTMLElement;
}

export interface RenderResult {
  /** Número de páginas produzidas. */
  pageCount: number;
}

export interface RenderAdapter {
  readonly name: string;
  render(opts: RenderOptions): Promise<RenderResult>;
}
