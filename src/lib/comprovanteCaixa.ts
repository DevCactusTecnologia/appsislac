// Comprovante de fechamento de caixa — Fase 5.6.
// Documento simples, A4 portrait, impresso via printHtmlInHiddenFrame.
import { escapeHtml } from "@/lib/escapeHtml";
import { formatDateBR } from "@/lib/dateBR";
import { printHtmlInHiddenFrame } from "@/lib/printHtml";
import { fmtBRL } from "@/lib/utils";
import { adminReportHeaderHtml } from "@/lib/adminReportHeader";
import type { CaixaFechamentoResumo } from "@/data/caixaSessoesStore";

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return `${formatDateBR(d)} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

interface ComprovanteArgs {
  resumo: CaixaFechamentoResumo;
  unidadeNome: string;
  abertoPor: string;
  fechadoPor: string;
}

export function imprimirComprovanteFechamento(args: ComprovanteArgs): void {
  const { resumo, unidadeNome, abertoPor, fechadoPor } = args;
  const linhas = [
    ["Saldo de abertura", fmtBRL(resumo.valor_abertura)],
    ["Entradas em dinheiro", `+ ${fmtBRL(resumo.entradas_dinheiro)}`],
    ["Entradas em PIX", `+ ${fmtBRL(resumo.entradas_pix)}`],
    ["Saídas pagas", `- ${fmtBRL(resumo.saidas)}`],
  ];

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
  <title>Fechamento de Caixa</title>
  <style>
    @page { size: A4 portrait; margin: 16mm 14mm; }
    * { box-sizing: border-box; }
    body { font: 12px/1.45 -apple-system, "Segoe UI", Roboto, Inter, system-ui, sans-serif; color:#111; margin:0; }
    h1 { font-size: 16px; margin: 0 0 4px; }
    .muted { color:#666; font-size: 11px; }
    .grid { display:grid; grid-template-columns: 1fr 1fr; gap: 4mm 8mm; margin: 6mm 0 4mm; }
    .grid div b { display:block; font-size:10px; text-transform:uppercase; letter-spacing:.04em; color:#666; }
    table { width:100%; border-collapse: collapse; margin-top: 4mm; }
    td { padding: 6px 4px; border-bottom: 1px solid #e5e7eb; }
    td:last-child { text-align:right; font-variant-numeric: tabular-nums; }
    tfoot td { border-bottom: 0; border-top: 2px solid #111; font-weight: 700; font-size: 13px; padding-top: 8px; }
    .sign { margin-top: 14mm; display:flex; gap: 10mm; }
    .sign div { flex:1; border-top:1px solid #111; padding-top: 2mm; font-size: 10px; text-align:center; color:#444; }
  </style></head><body>
  ${adminReportHeaderHtml({ titulo: "Fechamento de Caixa", subtitulo: escapeHtml(unidadeNome) })}
  <section class="grid">
    <div><b>Unidade</b>${escapeHtml(unidadeNome)}</div>
    <div><b>Abertura</b>${fmtDateTime(resumo.aberta_em)}</div>
    <div><b>Aberto por</b>${escapeHtml(abertoPor)}</div>
    <div><b>Fechamento</b>${fmtDateTime(resumo.fechada_em)}</div>
    <div><b>Fechado por</b>${escapeHtml(fechadoPor)}</div>
    <div><b>Sessão</b>#${resumo.sessao_id}</div>
  </section>
  <table>
    <tbody>
      ${linhas.map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`).join("")}
    </tbody>
    <tfoot>
      <tr><td>Saldo final</td><td>${escapeHtml(fmtBRL(resumo.saldo_final))}</td></tr>
    </tfoot>
  </table>
  <div class="sign">
    <div>Responsável pela abertura</div>
    <div>Responsável pelo fechamento</div>
  </div>
  </body></html>`;

  printHtmlInHiddenFrame({ html, documentTitle: `Fechamento de Caixa #${resumo.sessao_id}` });
}
