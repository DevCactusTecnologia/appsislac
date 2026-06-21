// SSOT — cabeçalho institucional dos relatórios administrativos.
//
// Aplicado em LGPD, Auditoria, Dossiê e demais relatórios internos. Lê os
// dados legais do laboratório de `getLabConfig()` (única fonte para
// branding) e renderiza no estilo Lovable Minimalist (preto sobre branco,
// sem cor corporativa).
//
// NÃO substitui `buildEmitenteHeader` (comprovantes/orçamento) — aquele tem
// QR de quitação e regras próprias.

import { escapeHtml } from "./escapeHtml";
import { getLabConfig } from "@/data/labConfigStore";
import { formatNowBR } from "./dateBR";

export interface AdminReportHeaderOptions {
  /** Título do relatório (ex.: "Relatório de Conformidade LGPD"). */
  titulo: string;
  /** Subtítulo/período opcional (ex.: "Janeiro/2026 — Junho/2026"). */
  subtitulo?: string;
}

const STYLE = [
  "border-bottom:1px solid #0f172a",
  "padding-bottom:10px",
  "margin-bottom:16px",
  "display:flex",
  "align-items:flex-start",
  "justify-content:space-between",
  "gap:16px",
].join(";");

/**
 * Retorna o HTML do cabeçalho administrativo (logo + razão social + CNPJ +
 * CNES + endereço + título do relatório + data de emissão).
 *
 * Use dentro de `bodyHtml` antes do conteúdo principal do relatório.
 */
export function buildAdminReportHeader({
  titulo,
  subtitulo,
}: AdminReportHeaderOptions): string {
  const lab = getLabConfig();
  const linhasLab: string[] = [];
  const razao = lab.razaoSocial || lab.nome;
  if (razao) linhasLab.push(`<strong>${escapeHtml(razao)}</strong>`);
  const ids: string[] = [];
  if (lab.cnpj) ids.push(`CNPJ ${escapeHtml(lab.cnpj)}`);
  if (lab.cnes) ids.push(`CNES ${escapeHtml(lab.cnes)}`);
  if (ids.length) linhasLab.push(ids.join(" · "));
  const endereco: string[] = [];
  if (lab.endereco) endereco.push(String(lab.endereco));
  if (lab.cidade) endereco.push(String(lab.cidade));
  if (lab.estado) endereco.push(String(lab.estado));
  if (endereco.length) linhasLab.push(escapeHtml(endereco.join(" — ")));
  const contato: string[] = [];
  if (lab.telefone) contato.push(String(lab.telefone));
  if (lab.email) contato.push(String(lab.email));
  if (contato.length) linhasLab.push(escapeHtml(contato.join(" · ")));

  const logoHtml = lab.logo
    ? `<img src="${escapeHtml(lab.logo)}" alt="" style="height:48px;width:auto;object-fit:contain;" />`
    : "";

  const labBlock = `
    <div style="font-size:10pt;line-height:1.4;color:#0f172a;">
      ${linhasLab.join("<br/>")}
    </div>`;

  const tituloBlock = `
    <div style="text-align:right;font-size:10pt;color:#475569;">
      <div style="font-size:14pt;font-weight:600;color:#0f172a;line-height:1.2;">${escapeHtml(titulo)}</div>
      ${subtitulo ? `<div style="margin-top:2px;">${escapeHtml(subtitulo)}</div>` : ""}
      <div style="margin-top:4px;">Emitido em ${escapeHtml(formatNowBR())}</div>
    </div>`;

  return `<header style="${STYLE}">
    <div style="display:flex;align-items:flex-start;gap:12px;">
      ${logoHtml}
      ${labBlock}
    </div>
    ${tituloBlock}
  </header>`;
}
