// Sanitização central de HTML para qualquer conteúdo originado do editor
// (CKEditor) antes de ser renderizado via dangerouslySetInnerHTML / innerHTML.
// DOMPurify (default) já remove <script>, event handlers (on*) e javascript:
// URLs, mantendo tags de formatação, tabelas, estilos inline e classes,
// preservando 100% do layout visual dos laudos/mapas/documentos.

import DOMPurify from "dompurify";

const sharedConfig = {
  FORBID_TAGS: ["script", "iframe", "object", "embed", "link", "meta", "base"],
  FORBID_ATTR: ["srcdoc", "formaction"],
  ALLOW_DATA_ATTR: true,
  KEEP_CONTENT: true,
} as const;

/** Sanitiza HTML preservando formatação visível. Use sempre antes de
 *  renderizar HTML vindo do editor / banco. */
export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return "";
  return DOMPurify.sanitize(String(input), sharedConfig) as unknown as string;
}
