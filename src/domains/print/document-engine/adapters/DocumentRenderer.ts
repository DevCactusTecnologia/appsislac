/**
 * DocumentRenderer — facade oficial do Document Engine.
 *
 * Toda a aplicação chama APENAS o DocumentRenderer.render(). Qual
 * adapter está ativo é detalhe interno — hoje Paged.js, amanhã pode
 * ser outra engine.
 *
 * Trocar a engine = trocar a instância retornada por `getActiveAdapter`.
 * Nenhum arquivo de domínio precisa ser alterado.
 */

import type { RenderAdapter, RenderResult } from "./RenderAdapter";
import type { ComposedDocument } from "../types";
import { PagedRenderer } from "./PagedRenderer";

let _adapter: RenderAdapter | null = null;

function getActiveAdapter(): RenderAdapter {
  if (!_adapter) _adapter = new PagedRenderer();
  return _adapter;
}

/** Renderiza o documento composto no host fornecido. */
export async function renderDocument(doc: ComposedDocument, host: HTMLElement): Promise<RenderResult> {
  return getActiveAdapter().render({ document: doc, host });
}

/** Nome do adapter ativo (telemetria/diagnóstico). */
export function activeAdapterName(): string {
  return getActiveAdapter().name;
}
