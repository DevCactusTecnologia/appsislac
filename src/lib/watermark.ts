// SSOT — Marca d'água global para documentos impressos (laudos, comprovantes,
// orçamentos, etc.). A configuração vive em `tenant_lab_config.watermark` (jsonb)
// e é replicada no `LabConfig` para consumo síncrono pelos builders de HTML.
//
// O CSS produzido por `buildWatermarkCss` é puramente aditivo:
//   - Usa `body::before` com `position: fixed` (cobre o A4 inteiro em cada
//     página impressa via @media print)
//   - Para o laudo, também aplica `.laudo-a4-page::before` (cada folha A4 é
//     uma região independente, então o pseudo precisa repetir por página)
// Não toca em nenhuma regra existente — basta concatenar ao final do <style>.
//
// Para evitar render incorreto, o navegador precisa de
// `-webkit-print-color-adjust: exact` e `print-color-adjust: exact` (já
// presentes no shell).

export interface WatermarkConfig {
  enabled: boolean;
  /** Data URL (data:image/...) ou URL pública absoluta. */
  url: string | null;
  /** Chave S3 (opcional, para upload gerenciado). */
  key?: string | null;
  /** 0.02 – 0.5 (recomendado 0.06 – 0.12 para não atrapalhar leitura). */
  opacity: number;
  /** % da largura da página (10 – 100). 60 = bom default. */
  sizePct: number;
  /** Rotação em graus (-180 a 180). */
  rotation: number;
}

export const DEFAULT_WATERMARK: WatermarkConfig = {
  enabled: false,
  url: null,
  key: null,
  opacity: 0.08,
  sizePct: 60,
  rotation: 0,
};

export function normalizeWatermark(raw: unknown): WatermarkConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_WATERMARK };
  const r = raw as Record<string, unknown>;
  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : DEFAULT_WATERMARK.enabled,
    url: typeof r.url === "string" && r.url ? r.url : null,
    key: typeof r.key === "string" && r.key ? r.key : null,
    opacity: clamp(toNum(r.opacity, DEFAULT_WATERMARK.opacity), 0.02, 0.5),
    sizePct: clamp(toNum(r.sizePct, DEFAULT_WATERMARK.sizePct), 10, 100),
    rotation: clamp(toNum(r.rotation, DEFAULT_WATERMARK.rotation), -180, 180),
  };
}

function toNum(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}
function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * CSS aditivo que pinta a marca d'água em cada página impressa.
 * Aplica em dois alvos:
 *   - `body::before` — cobre documentos que ocupam `body` direto (comprovantes,
 *     orçamentos, declarações via `wrapA4Document`).
 *   - `.laudo-a4-page::before` — cada folha A4 do laudo é uma região fechada
 *     (overflow:hidden), então o pseudo é replicado por página.
 *
 * Retorna string vazia quando desabilitado ou sem imagem.
 */
export function buildWatermarkCss(wm: WatermarkConfig | null | undefined): string {
  const w = normalizeWatermark(wm);
  if (!w.enabled || !w.url) return "";
  const url = JSON.stringify(w.url);
  const common = `
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    background-image: url(${url});
    background-repeat: no-repeat;
    background-position: center center;
    background-size: ${w.sizePct}% auto;
    opacity: ${w.opacity};
    transform: rotate(${w.rotation}deg);
    transform-origin: center center;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  `;
  return `
    /* Marca d'água — gerada por buildWatermarkCss(). */
    body { position: relative; }
    body::before { ${common} position: fixed; }
    .laudo-a4-page { position: relative; }
    .laudo-a4-page::before { ${common} }
    .laudo-a4-page > * { position: relative; z-index: 1; }
  `;
}
