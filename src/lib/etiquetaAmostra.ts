// Geração e impressão de etiqueta de amostra (formato 50x30mm).
// Inclui: protocolo do atendimento, código completo da amostra (com DV),
// paciente, material, data de coleta e código de barras visual (Code 128 simplificado via barras CSS).

import { printHtmlInHiddenFrame } from "./printHtml";
import { resolveDestino, type TipoProcesso } from "./labApoio";

export interface EtiquetaAmostraData {
  codigoBarra: string;          // Ex.: A-20260423-000001-7
  protocoloAtendimento?: string;// Ex.: ATD-2026-0000123
  pacienteNome?: string;
  pacienteIdade?: string;       // Ex.: "34 anos"
  material?: string;
  dataColeta?: string;          // ISO ou já formatada
  observacao?: string;
  copias?: number;              // default 1
  /** Destino do exame (Fase 1 multi-lab). Aditivo, opcional. */
  tipoProcesso?: TipoProcesso | string | null;
  labApoioNome?: string | null;
  labApoioId?: string | null;
  /** Nome do laboratório próprio (tenant) — exibido em INTERNO. */
  laboratorioPropriaNome?: string | null;
  /** Protocolo externo do laboratório de apoio (quando houver). */
  protocoloExterno?: string | null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtData(d: string | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Gera barras pseudo-Code128 baseadas no hash dos caracteres.
 * Visualmente convincente; suficiente para conferência humana.
 * Para leitura óptica real, recomenda-se substituir por uma lib (jsbarcode).
 */
function gerarBarrasSvg(codigo: string): string {
  const widths: number[] = [];
  // Padrão de início
  widths.push(2, 1, 2, 1);
  for (const ch of codigo) {
    const code = ch.charCodeAt(0);
    // 4 barras por caractere com larguras 1-3
    widths.push((code % 3) + 1);
    widths.push(((code >> 2) % 3) + 1);
    widths.push(((code >> 4) % 3) + 1);
    widths.push(((code >> 1) % 2) + 1);
  }
  // Padrão de fim
  widths.push(2, 3, 2);

  const unit = 1.2; // mm por unidade
  const totalUnits = widths.reduce((a, b) => a + b, 0);
  const widthMm = totalUnits * unit;
  const heightMm = 12;

  let x = 0;
  let bars = "";
  widths.forEach((w, i) => {
    if (i % 2 === 0) {
      bars += `<rect x="${x}" y="0" width="${w * unit}" height="${heightMm}" fill="#000" />`;
    }
    x += w * unit;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${widthMm}mm" height="${heightMm}mm" viewBox="0 0 ${widthMm} ${heightMm}" preserveAspectRatio="none">${bars}</svg>`;
}

function renderEtiqueta(data: EtiquetaAmostraData): string {
  const barras = gerarBarrasSvg(data.codigoBarra);
  const paciente = data.pacienteNome
    ? `${escapeHtml(data.pacienteNome)}${data.pacienteIdade ? ` <span class="idade">(${escapeHtml(data.pacienteIdade)})</span>` : ""}`
    : "—";

  // Destino do exame — apenas renderiza se houver algo significativo
  const destino = (data.tipoProcesso || data.labApoioNome || data.labApoioId)
    ? resolveDestino({
        tipoProcesso: data.tipoProcesso ?? "INTERNO",
        labApoioId: data.labApoioId ?? null,
        labApoioNome: data.labApoioNome ?? null,
        laboratorioPropriaNome: data.laboratorioPropriaNome ?? null,
      })
    : null;

  const destinoHtml = destino
    ? `<div class="destino" style="background:${destino.cor.bg};color:${destino.cor.fg};">
         ${escapeHtml(destino.tipo === "INTERNO" ? destino.label : `→ ${destino.label}`)}
       </div>`
    : "";

  const protocoloExternoHtml = data.protocoloExterno
    ? `<div class="protocolo-ext"><span class="lbl">EXT</span><span class="val">${escapeHtml(data.protocoloExterno)}</span></div>`
    : "";

  return `
    <div class="etiqueta">
      <div class="topo">
        <div class="protocolo">
          <span class="lbl">ATD</span>
          <span class="val">${escapeHtml(data.protocoloAtendimento || "—")}</span>
        </div>
        <div class="data">${escapeHtml(fmtData(data.dataColeta))}</div>
      </div>

      ${destinoHtml}
      ${protocoloExternoHtml}

      <div class="paciente">${paciente}</div>
      <div class="material">${escapeHtml(data.material || "—")}</div>

      <div class="barcode">${barras}</div>
      <div class="codigo">${escapeHtml(data.codigoBarra)}</div>

      ${data.observacao ? `<div class="obs">${escapeHtml(data.observacao)}</div>` : ""}
    </div>
  `;
}

export function imprimirEtiquetaAmostra(data: EtiquetaAmostraData): void {
  const copias = Math.max(1, data.copias ?? 1);
  const etiquetas = Array.from({ length: copias }, () => renderEtiqueta(data)).join("");

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Etiqueta ${escapeHtml(data.codigoBarra)}</title>
  <style>
    @page {
      size: 50mm 30mm;
      margin: 0;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    }
    .etiqueta {
      width: 50mm;
      height: 30mm;
      padding: 1.5mm 2mm;
      page-break-after: always;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
    }
    .etiqueta:last-child { page-break-after: auto; }
    .topo {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 6.5pt;
      line-height: 1;
    }
    .destino {
      align-self: flex-start;
      font-size: 6pt;
      font-weight: 800;
      letter-spacing: 0.3px;
      padding: 0.6mm 1.4mm;
      border-radius: 0.8mm;
      line-height: 1;
      text-transform: uppercase;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .protocolo .lbl {
      font-weight: 700;
      background: #000;
      color: #fff;
      padding: 0.5mm 1mm;
      border-radius: 0.5mm;
      font-size: 5.5pt;
      margin-right: 1mm;
    }
    .protocolo .val {
      font-family: ui-monospace, "SF Mono", Menlo, monospace;
      font-weight: 700;
      font-size: 7pt;
    }
    .protocolo-ext {
      display: flex;
      align-items: center;
      gap: 1mm;
      font-size: 5.5pt;
      line-height: 1;
      margin-top: 0.4mm;
    }
    .protocolo-ext .lbl {
      background: #1f2937;
      color: #fff;
      padding: 0.4mm 1mm;
      border-radius: 0.5mm;
      font-weight: 700;
      letter-spacing: 0.3px;
    }
    .protocolo-ext .val {
      font-family: ui-monospace, "SF Mono", Menlo, monospace;
      font-weight: 700;
      font-size: 6pt;
    }
    .data {
      font-size: 6pt;
      color: #333;
    }
    .paciente {
      font-size: 8pt;
      font-weight: 700;
      line-height: 1.1;
      margin-top: 0.5mm;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .paciente .idade {
      font-weight: 400;
      font-size: 6.5pt;
      color: #555;
    }
    .material {
      font-size: 6.5pt;
      color: #222;
      line-height: 1.1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .barcode {
      width: 100%;
      height: 9mm;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .barcode svg {
      width: 100%;
      height: 100%;
    }
    .codigo {
      text-align: center;
      font-family: ui-monospace, "SF Mono", Menlo, monospace;
      font-size: 7pt;
      font-weight: 700;
      letter-spacing: 0.5px;
      line-height: 1;
    }
    .obs {
      font-size: 5.5pt;
      color: #444;
      font-style: italic;
      line-height: 1.1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    @media screen {
      body {
        padding: 20px;
        background: #f3f4f6;
      }
      .etiqueta {
        background: #fff;
        border: 1px dashed #999;
        margin: 0 auto 8px;
      }
    }
  </style>
</head>
<body>
  ${etiquetas}
</body>
</html>`;

  printHtmlInHiddenFrame({ html, frameId: "lov-etiqueta-amostra" });
}