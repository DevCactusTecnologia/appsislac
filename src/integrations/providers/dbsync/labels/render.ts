/**
 * Renderer mínimo de etiqueta DBSync.
 *
 * - Se o apoio enviar `raw_epl`, ele é preservado e devolvido (single source of truth).
 * - Caso contrário, geramos um EPL2 conservador com as informações canônicas.
 * - Provider-agnostic: aceita `ExternalLabelData` de qualquer provider futuro.
 */

import type { ExternalLabelData } from "./types";

function escEpl(s: string): string {
  return String(s ?? "").replace(/"/g, "'").replace(/[\r\n]+/g, " ");
}

export function renderExternalLabelEpl(data: ExternalLabelData): string {
  if (data.raw_epl && data.raw_epl.trim().length > 0) return data.raw_epl;

  const lines: string[] = [];
  lines.push("N");
  lines.push("q400");
  lines.push("Q200,24");
  // Cabeçalho com mnemônicos agrupados (até 6 por etiqueta).
  const mnem = (data.mnemonic_group ?? []).slice(0, 6).join(" ").toUpperCase();
  lines.push(`A20,15,0,4,1,1,N,"${escEpl(mnem || data.provider)}"`);
  // Material/volume/transporte.
  const meta = [data.material, data.volume, data.transport]
    .filter(Boolean)
    .join(" · ");
  if (meta) lines.push(`A20,55,0,2,1,1,N,"${escEpl(meta)}"`);
  // Protocolo externo (texto pequeno).
  if (data.external_protocol) {
    lines.push(`A20,80,0,2,1,1,N,"PROT ${escEpl(data.external_protocol)}"`);
  }
  // Code128 do barcode do apoio.
  lines.push(`B20,110,0,1,2,2,60,B,"${escEpl(data.barcode)}"`);
  lines.push("P1");
  return lines.join("\n");
}