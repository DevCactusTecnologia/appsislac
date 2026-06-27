/**
 * LayoutEngine — resolve a geometria oficial da página.
 *
 * Constraint travada (mem://constraints/layout-impressao-travado.md):
 * margens padrão 4/11/4/11mm. O LayoutEngine apenas valida e completa
 * com fallbacks, NUNCA altera margens fornecidas pelo chamador.
 */

import type { PageGeometry } from "./types";

export const DEFAULT_GEOMETRY: PageGeometry = {
  marginTopMm: 4,
  marginRightMm: 11,
  marginBottomMm: 4,
  marginLeftMm: 11,
};

export function resolveGeometry(
  override?: Partial<{ top: number; right: number; bottom: number; left: number }>,
): PageGeometry {
  return {
    marginTopMm: Number.isFinite(override?.top) ? (override!.top as number) : DEFAULT_GEOMETRY.marginTopMm,
    marginRightMm: Number.isFinite(override?.right) ? (override!.right as number) : DEFAULT_GEOMETRY.marginRightMm,
    marginBottomMm: Number.isFinite(override?.bottom) ? (override!.bottom as number) : DEFAULT_GEOMETRY.marginBottomMm,
    marginLeftMm: Number.isFinite(override?.left) ? (override!.left as number) : DEFAULT_GEOMETRY.marginLeftMm,
  };
}

/** Largura útil em mm (A4 = 210mm). */
export function usefulWidthMm(g: PageGeometry): number {
  return 210 - g.marginLeftMm - g.marginRightMm;
}

/** Altura útil em mm (A4 = 297mm). */
export function usefulHeightMm(g: PageGeometry): number {
  return 297 - g.marginTopMm - g.marginBottomMm;
}
