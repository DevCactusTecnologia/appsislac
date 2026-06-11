// HTML builders para comprovantes (pagamento/atendimento/comparecimento) e
// orçamentos. Extraído de src/lib/comprovantes.ts (Fase: domain slicing).
//
// Pipeline: `buildComprovanteHtml()` tenta primeiro renderizar o template
// configurado em Configurações → Documentos via `renderDocumentoTemplate()`,
// e cai para o layout legado hardcoded quando não há template ativo.
// Branding (logo + dados institucionais) SEMPRE vem de `getLabConfig()`.
import QRCode from "qrcode";
import { fmtBRL } from "@/lib/utils";
import { escapeHtml as esc } from "@/lib/escapeHtml";
import { getLabConfig } from "@/data/labConfigStore";
import {
  renderDocumentoTemplate,
  type DocumentoRenderContext,
} from "@/lib/documentoRenderer";
import { type DocumentoTipo } from "@/data/documentoTemplatesStore";
import { codigoVerificacao } from "@/domains/result/services/comprovantesValidation";

export type ComprovanteTipo = "pagamento" | "atendimento" | "comparecimento";

export interface ComprovanteData {
  tipo: ComprovanteTipo;
  protocolo: string;
  data: string;
  paciente: { nome: string; cpf?: string; nascimento?: string; idade?: string };
  convenio?: string;
  solicitante?: string;
  unidade?: { nome: string; endereco?: string; cidade?: string; estado?: string };
  exames?: { nome: string; material?: string; valor?: number }[];
  pagamentos?: { tipo: string; data: string; valor: number }[];
  totais?: { subtotal: number; desconto: number; pago: number; total: number; saldo: number };
}

export interface OrcamentoPDFData {
  id: string;
  data: string;
  paciente: string;
  convenio: string;
  solicitante?: string;
  exames: string[];
  subtotal: number;
  desconto: number;
  total: number;
}

const tipoConfig: Record<ComprovanteTipo, { label: string; accent: string }> = {
  pagamento: { label: "RECIBO DE PAGAMENTO", accent: "#111111" },
  atendimento: { label: "COMPROVANTE DE ATENDIMENTO", accent: "#111111" },
  comparecimento: { label: "DECLARAÇÃO DE COMPARECIMENTO", accent: "#111111" },
};

const COMPROVANTE_TO_DOCUMENTO_TIPO: Record<ComprovanteTipo, DocumentoTipo> = {
  pagamento: "comprovante_pagamento",
  atendimento: "comprovante_atendimento",
  comparecimento: "declaracao_comparecimento",
};

// ===== Helpers numéricos (valor por extenso pt-BR) =====

function numeroPorExtenso(n: number): string {
  if (n === 0) return "zero";
  const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

  function ate999(num: number): string {
    if (num === 0) return "";
    if (num === 100) return "cem";
    const c = Math.floor(num / 100);
    const resto = num % 100;
    const partes: string[] = [];
    if (c > 0) partes.push(centenas[c]);
    if (resto > 0) {
      if (resto < 20) partes.push(unidades[resto]);
      else {
        const d = Math.floor(resto / 10);
        const u = resto % 10;
        partes.push(u === 0 ? dezenas[d] : `${dezenas[d]} e ${unidades[u]}`);
      }
    }
    return partes.join(" e ");
  }

  const partes: string[] = [];
  const milhoes = Math.floor(n / 1_000_000);
  const milhares = Math.floor((n % 1_000_000) / 1_000);
  const resto = n % 1_000;

  if (milhoes > 0) partes.push(milhoes === 1 ? "um milhão" : `${ate999(milhoes)} milhões`);
  if (milhares > 0) partes.push(milhares === 1 ? "mil" : `${ate999(milhares)} mil`);
  if (resto > 0) partes.push(ate999(resto));
  return partes.join(" e ");
}

export function valorPorExtenso(valor: number): string {
  if (!isFinite(valor) || valor < 0) return "";
  const inteiros = Math.floor(valor);
  const centavos = Math.round((valor - inteiros) * 100);
  const parteInt = numeroPorExtenso(inteiros);
  const moeda = inteiros === 1 ? "real" : "reais";
  if (centavos === 0) return `${parteInt} ${moeda}`;
  const parteCent = numeroPorExtenso(centavos);
  const cent = centavos === 1 ? "centavo" : "centavos";
  if (inteiros === 0) return `${parteCent} ${cent}`;
  return `${parteInt} ${moeda} e ${parteCent} ${cent}`;
}

// ===== QR Code + data formatada =====

function gerarQrSvg(payload: string): string {
  try {
    const qr = QRCode.create(payload, { errorCorrectionLevel: "L" });
    const size = qr.modules.size;
    const cells: string[] = [];
    const r = 0.35;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (qr.modules.get(x, y)) {
          cells.push(`<rect x="${x}" y="${y}" width="1" height="1" rx="${r}" ry="${r}"/>`);
        }
      }
    }
    const total = size + 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 ${total} ${total}" shape-rendering="geometricPrecision" width="128" height="128" style="display:block;background:#fff;border:1px solid #f0f0f0;"><g fill="#000">${cells.join("")}</g></svg>`;
  } catch {
    return "";
  }
}

function dataAtualPorExtenso(): string {
  const hoje = new Date();
  const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  return `${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`;
}

// ===== Cabeçalho + rodapé =====

export function buildEmitenteHeader(badgeLabel: string): string {
  const lab = getLabConfig();
  const labName = (lab.nome && lab.nome.trim()) || "SISLAC";
  const razao = lab.razaoSocial?.trim() && lab.razaoSocial.trim() !== labName
    ? lab.razaoSocial.trim()
    : "";
  const enderecoLinha = [lab.endereco, [lab.cidade, lab.estado].filter(Boolean).join("/")]
    .filter(Boolean)
    .join(" — ");
  const contactLine = [lab.telefone, lab.email].filter(Boolean).join(" · ");
  const docLine = [
    lab.cnpj ? `CNPJ ${lab.cnpj}` : "",
    lab.inscricaoMunicipal ? `IM ${lab.inscricaoMunicipal}` : "",
    lab.cnes ? `CNES ${lab.cnes}` : "",
  ].filter(Boolean).join(" · ");
  const logoBlock = lab.logo
    ? `<img src="${esc(lab.logo)}" alt="Logo" style="max-height:60px;max-width:170px;object-fit:contain;margin:0 0 10px 0;display:block;" />`
    : "";
  return `
  <div style="border-bottom:1.5px solid #111;padding-bottom:14px;margin-bottom:18px;">
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="vertical-align:top;width:170px;">${logoBlock}</td>
        <td style="vertical-align:top;text-align:left;padding-left:${lab.logo ? "16" : "0"}px;">
          <p style="font-size:15px;font-weight:700;color:#111;margin:0;letter-spacing:.2px;">${esc(labName)}</p>
          ${razao ? `<p style="font-size:10.5px;color:#444;margin:2px 0 0 0;">${esc(razao)}</p>` : ""}
          ${enderecoLinha ? `<p style="font-size:10px;color:#555;margin:3px 0 0 0;">${esc(enderecoLinha)}</p>` : ""}
          ${contactLine ? `<p style="font-size:10px;color:#555;margin:1px 0 0 0;">${esc(contactLine)}</p>` : ""}
          ${docLine ? `<p style="font-size:10px;color:#555;margin:1px 0 0 0;">${esc(docLine)}</p>` : ""}
        </td>
      </tr>
    </table>
    <p style="text-align:center;font-size:13px;font-weight:700;letter-spacing:3px;color:#111;margin:14px 0 0 0;text-transform:uppercase;">${esc(badgeLabel)}</p>
  </div>`;
}

export function buildAssinaturaRodape(codigo: string, qrSvg: string): string {
  const lab = getLabConfig();
  const cidadeUf = [lab.cidade, lab.estado].filter(Boolean).join("/");
  const local = cidadeUf ? `${cidadeUf}, ${dataAtualPorExtenso()}.` : `${dataAtualPorExtenso()}.`;
  return `
  <div class="no-break" style="margin-top:24px;page-break-inside:avoid;break-inside:avoid;">
    <p style="font-size:11px;color:#333;margin:0;">${esc(local)}</p>
    <table style="width:100%;margin-top:14px;padding-top:10px;border-collapse:collapse;">
      <tr>
        <td style="vertical-align:top;width:74px;padding-right:10px;">${qrSvg}</td>
        <td style="vertical-align:top;font-size:9px;color:#777;line-height:1.5;">
          <p style="margin:0;">Documento emitido eletronicamente em <strong style="color:#333;">${esc(new Date().toLocaleString("pt-BR"))}</strong>.</p>
          <p style="margin:3px 0 0 0;">Cód. verificação: <strong style="color:#111;font-family:'Courier New',monospace;font-variant-numeric:tabular-nums;">${esc(codigo)}</strong></p>
          <p style="margin:3px 0 0 0;color:#999;">Aponte a câmera no QR para abrir a página de verificação on-line deste documento.</p>
        </td>
      </tr>
    </table>
  </div>`;
}

/** Rodapé padrão (assinatura + QR de verificação) exposto para templates customizados. */
export function buildDocumentoFooterHtml(d: ComprovanteData): string {
  const codigo = codigoVerificacao(
    `${d.tipo}|${d.protocolo}|${d.paciente.nome}|${d.data}|${d.totais?.total ?? ""}`,
  );
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "";
  const verificationLink = origin ? `${origin}/verificar/${codigo}` : codigo;
  const qrSvg = gerarQrSvg(verificationLink);
  return buildAssinaturaRodape(codigo, qrSvg);
}

// ===== Builders principais =====

export function buildComprovanteHtml(d: ComprovanteData): string {
  // 1) Template configurado em Configurações → Documentos (tem prioridade).
  const ctx: DocumentoRenderContext = {
    paciente: d.paciente,
    atendimento: {
      protocolo: d.protocolo,
      data: d.data,
      convenio: d.convenio,
      solicitante: d.solicitante,
    },
    unidade: d.unidade,
    exames: d.exames,
    pagamentos: d.pagamentos,
    totais: d.totais,
  };
  const fromTemplate = renderDocumentoTemplate(COMPROVANTE_TO_DOCUMENTO_TIPO[d.tipo], ctx);
  if (fromTemplate) return fromTemplate;

  // 2) Fallback: layout legado hardcoded.
  const cfg = tipoConfig[d.tipo];
  const codigo = codigoVerificacao(`${d.tipo}|${d.protocolo}|${d.paciente.nome}|${d.data}|${d.totais?.total ?? ""}`);
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "";
  const verificationLink = origin ? `${origin}/verificar/${codigo}` : codigo;
  const qrSvg = gerarQrSvg(verificationLink);

  const idPaciente = `
  <div style="margin-bottom:14px;">
    <p style="font-size:9.5px;font-weight:700;letter-spacing:1.5px;color:#666;margin:0 0 6px 0;text-transform:uppercase;">Identificação do paciente</p>
    <table style="width:100%;border-collapse:collapse;font-size:11px;">
      <tr>
        <td style="padding:3px 0;color:#555;width:90px;">Nome</td>
        <td style="padding:3px 0;color:#111;font-weight:600;">${esc(d.paciente.nome)}</td>
      </tr>
      ${d.paciente.cpf ? `<tr><td style="padding:3px 0;color:#555;">CPF</td><td style="padding:3px 0;color:#111;">${esc(d.paciente.cpf)}</td></tr>` : ""}
      ${d.paciente.nascimento ? `<tr><td style="padding:3px 0;color:#555;">Nascimento</td><td style="padding:3px 0;color:#111;">${esc(d.paciente.nascimento)}${d.paciente.idade ? ` (${esc(d.paciente.idade)})` : ""}</td></tr>` : ""}
    </table>
  </div>`;

  const idAtendimento = `
  <div style="margin-bottom:18px;">
    <p style="font-size:9.5px;font-weight:700;letter-spacing:1.5px;color:#666;margin:0 0 6px 0;text-transform:uppercase;">Identificação do atendimento</p>
    <table style="width:100%;border-collapse:collapse;font-size:11px;">
      <tr>
        <td style="padding:3px 0;color:#555;width:90px;">Protocolo</td>
        <td style="padding:3px 0;color:#111;font-family:'Courier New',monospace;font-weight:700;">${esc(d.protocolo)}</td>
      </tr>
      <tr>
        <td style="padding:3px 0;color:#555;">Data</td>
        <td style="padding:3px 0;color:#111;">${esc(d.data)}</td>
      </tr>
      ${d.convenio ? `<tr><td style="padding:3px 0;color:#555;">Convênio</td><td style="padding:3px 0;color:#111;">${esc(d.convenio)}</td></tr>` : ""}
      ${d.solicitante ? `<tr><td style="padding:3px 0;color:#555;">Solicitante</td><td style="padding:3px 0;color:#111;">${esc(d.solicitante)}</td></tr>` : ""}
      ${d.unidade ? `<tr><td style="padding:3px 0;color:#555;">Unidade</td><td style="padding:3px 0;color:#111;">${esc(d.unidade.nome)}${d.unidade.cidade ? ` — ${esc(d.unidade.cidade)}${d.unidade.estado ? `/${esc(d.unidade.estado)}` : ""}` : ""}</td></tr>` : ""}
    </table>
  </div>`;

  let corpoEspecifico = "";

  if (d.tipo === "pagamento") {
    const total = d.totais?.total ?? 0;
    const pago = d.totais?.pago ?? 0;
    const saldo = d.totais?.saldo ?? 0;
    const subtotal = d.totais?.subtotal ?? 0;
    const desconto = d.totais?.desconto ?? 0;
    const isParcial = saldo > 0.005;
    const valorRecebido = pago > 0 ? pago : total;
    const extenso = valorPorExtenso(valorRecebido);
    const formaPagto = (d.pagamentos ?? []).map(p => p.tipo).filter(Boolean);
    const formaTxt = formaPagto.length > 0 ? formaPagto.join(", ") : "—";

    const declaracao = isParcial
      ? `Recebemos de <strong>${esc(d.paciente.nome)}</strong>${d.paciente.cpf ? `, CPF ${esc(d.paciente.cpf)}` : ""}, a importância de <strong>${fmtBRL(valorRecebido)}</strong> (${esc(extenso)}), referente a pagamento <strong>parcial</strong> dos serviços laboratoriais identificados sob o protocolo nº ${esc(d.protocolo)}, restando saldo devedor de <strong>${fmtBRL(saldo)}</strong>. Este recibo refere-se exclusivamente ao valor efetivamente recebido nesta data e <strong>não constitui quitação total da obrigação</strong>.`
      : `Recebemos de <strong>${esc(d.paciente.nome)}</strong>${d.paciente.cpf ? `, CPF ${esc(d.paciente.cpf)}` : ""}, a importância de <strong>${fmtBRL(valorRecebido)}</strong> (${esc(extenso)}), referente ao pagamento integral dos serviços laboratoriais identificados sob o protocolo nº ${esc(d.protocolo)}, dando ao pagador, por este recibo, <strong>plena, geral e irrevogável quitação</strong> da obrigação.`;

    const exames = (d.exames ?? []).filter(e => e?.nome);
    const tabelaExames = exames.length > 0 ? `
    <div style="margin-top:6px;">
      <p style="font-size:9.5px;font-weight:700;letter-spacing:1.5px;color:#666;margin:0 0 6px 0;text-transform:uppercase;">Discriminação dos serviços</p>
      <table style="width:100%;border-collapse:collapse;font-size:11px;border-top:1px solid #111;">
        <thead>
          <tr>
            <th style="text-align:left;padding:6px 4px;border-bottom:1px solid #111;font-size:9.5px;text-transform:uppercase;letter-spacing:1px;color:#444;font-weight:700;">Exame</th>
            <th style="text-align:left;padding:6px 4px;border-bottom:1px solid #111;font-size:9.5px;text-transform:uppercase;letter-spacing:1px;color:#444;font-weight:700;">Material</th>
            <th style="text-align:right;padding:6px 4px;border-bottom:1px solid #111;font-size:9.5px;text-transform:uppercase;letter-spacing:1px;color:#444;font-weight:700;">Valor</th>
          </tr>
        </thead>
        <tbody>
          ${exames.map(e => `<tr>
            <td style="padding:6px 4px;border-bottom:1px solid #ececec;">${esc(e.nome)}</td>
            <td style="padding:6px 4px;border-bottom:1px solid #ececec;color:#555;">${esc(e.material ?? "—")}</td>
            <td style="padding:6px 4px;border-bottom:1px solid #ececec;text-align:right;font-variant-numeric:tabular-nums;">${fmtBRL(e.valor ?? 0)}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>` : "";

    const tabelaPagamentos = (d.pagamentos ?? []).length > 0 ? `
    <div style="margin-top:14px;">
      <p style="font-size:9.5px;font-weight:700;letter-spacing:1.5px;color:#666;margin:0 0 6px 0;text-transform:uppercase;">Pagamentos recebidos</p>
      <table style="width:100%;border-collapse:collapse;font-size:11px;border-top:1px solid #111;">
        <tbody>
          ${d.pagamentos!.map(p => `<tr>
            <td style="padding:6px 4px;border-bottom:1px solid #ececec;">${esc(p.tipo)}</td>
            <td style="padding:6px 4px;border-bottom:1px solid #ececec;color:#555;">${esc(p.data)}</td>
            <td style="padding:6px 4px;border-bottom:1px solid #ececec;text-align:right;font-variant-numeric:tabular-nums;font-weight:600;">${fmtBRL(p.valor)}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>` : "";

    const totaisBox = d.totais ? `
    <div style="margin-top:14px;border:1px solid #111;padding:12px 14px;">
      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <tr><td style="padding:3px 0;color:#555;">Subtotal</td><td style="padding:3px 0;text-align:right;font-variant-numeric:tabular-nums;">${fmtBRL(subtotal)}</td></tr>
        ${desconto > 0 ? `<tr><td style="padding:3px 0;color:#555;">Desconto</td><td style="padding:3px 0;text-align:right;font-variant-numeric:tabular-nums;">- ${fmtBRL(desconto)}</td></tr>` : ""}
        <tr><td style="padding:6px 0 3px 0;color:#555;border-top:1px solid #ddd;">Total dos serviços</td><td style="padding:6px 0 3px 0;text-align:right;font-variant-numeric:tabular-nums;border-top:1px solid #ddd;">${fmtBRL(total)}</td></tr>
        <tr><td style="padding:3px 0;color:#555;">Valor recebido</td><td style="padding:3px 0;text-align:right;font-weight:700;font-variant-numeric:tabular-nums;">${fmtBRL(pago)}</td></tr>
        ${isParcial ? `<tr><td style="padding:3px 0;color:#a02020;font-weight:600;">Saldo devedor</td><td style="padding:3px 0;text-align:right;color:#a02020;font-weight:700;font-variant-numeric:tabular-nums;">${fmtBRL(saldo)}</td></tr>` : ""}
      </table>
    </div>` : "";

    corpoEspecifico = `
    <div style="margin-bottom:14px;padding:14px 16px;background:#fafafa;border-left:3px solid #111;">
      <p style="font-size:11.5px;line-height:1.65;color:#111;margin:0;text-align:justify;">${declaracao}</p>
      <p style="font-size:10.5px;color:#555;margin:8px 0 0 0;"><strong>Forma de pagamento:</strong> ${esc(formaTxt)}</p>
      ${isParcial ? `<p style="font-size:10px;color:#a02020;margin:6px 0 0 0;font-weight:600;">⚠ Recibo parcial — não dá quitação total da obrigação.</p>` : ""}
    </div>
    ${tabelaExames}
    ${tabelaPagamentos}
    ${totaisBox}`;
  } else if (d.tipo === "atendimento") {
    const exames = (d.exames ?? []).filter(e => e?.nome);
    const declaracao = `Declaramos para os devidos fins que o(a) Sr(a). <strong>${esc(d.paciente.nome)}</strong>${d.paciente.cpf ? `, portador(a) do CPF ${esc(d.paciente.cpf)}` : ""}, foi atendido(a) por este laboratório na data <strong>${esc(d.data)}</strong>${d.unidade ? `, na unidade <strong>${esc(d.unidade.nome)}</strong>` : ""}, sob o protocolo nº <strong>${esc(d.protocolo)}</strong>, para realização dos exames laboratoriais abaixo discriminados.`;

    const tabelaExames = exames.length > 0 ? `
    <div style="margin-top:6px;">
      <p style="font-size:9.5px;font-weight:700;letter-spacing:1.5px;color:#666;margin:0 0 6px 0;text-transform:uppercase;">Exames solicitados (${exames.length})</p>
      <table style="width:100%;border-collapse:collapse;font-size:11px;border-top:1px solid #111;">
        <thead>
          <tr>
            <th style="text-align:left;padding:6px 4px;border-bottom:1px solid #111;font-size:9.5px;text-transform:uppercase;letter-spacing:1px;color:#444;font-weight:700;width:30px;">#</th>
            <th style="text-align:left;padding:6px 4px;border-bottom:1px solid #111;font-size:9.5px;text-transform:uppercase;letter-spacing:1px;color:#444;font-weight:700;">Exame</th>
            <th style="text-align:left;padding:6px 4px;border-bottom:1px solid #111;font-size:9.5px;text-transform:uppercase;letter-spacing:1px;color:#444;font-weight:700;">Material</th>
          </tr>
        </thead>
        <tbody>
          ${exames.map((e, i) => `<tr>
            <td style="padding:6px 4px;border-bottom:1px solid #ececec;color:#777;font-variant-numeric:tabular-nums;">${i + 1}</td>
            <td style="padding:6px 4px;border-bottom:1px solid #ececec;">${esc(e.nome)}</td>
            <td style="padding:6px 4px;border-bottom:1px solid #ececec;color:#555;">${esc(e.material ?? "—")}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>` : "";

    corpoEspecifico = `
    <div style="margin-bottom:14px;padding:14px 16px;background:#fafafa;border-left:3px solid #111;">
      <p style="font-size:11.5px;line-height:1.65;color:#111;margin:0;text-align:justify;">${declaracao}</p>
    </div>
    ${tabelaExames}
    <p style="font-size:10px;color:#777;font-style:italic;margin:14px 0 0 0;">Este documento comprova o atendimento e a solicitação dos exames listados, <strong>não substitui o laudo</strong> e <strong>não contém resultados</strong>. O laudo, quando liberado, será emitido em documento próprio assinado pelo responsável técnico.</p>`;
  } else {
    const declaracao = `Declaramos, para os devidos fins de direito, que o(a) Sr(a). <strong>${esc(d.paciente.nome)}</strong>${d.paciente.cpf ? `, portador(a) do CPF ${esc(d.paciente.cpf)}` : ""}, compareceu a esta unidade${d.unidade ? ` (<strong>${esc(d.unidade.nome)}</strong>)` : ""} na data <strong>${esc(d.data)}</strong>, no horário aproximado das <strong>______</strong> às <strong>______</strong>, para realização de exames laboratoriais sob o protocolo nº <strong>${esc(d.protocolo)}</strong>.`;

    corpoEspecifico = `
    <div style="margin-bottom:14px;padding:14px 16px;background:#fafafa;border-left:3px solid #111;">
      <p style="font-size:11.5px;line-height:1.65;color:#111;margin:0;text-align:justify;">${declaracao}</p>
      <p style="font-size:11.5px;line-height:1.65;color:#111;margin:10px 0 0 0;text-align:justify;">Por ser expressão da verdade, firmamos a presente declaração.</p>
    </div>`;
  }

  return `
<div id="comprovante-print" style="font-family:'Inter','Segoe UI',Helvetica,Arial,sans-serif;color:#111;padding:0;max-width:680px;margin:0 auto;background:#fff;line-height:1.5;font-size:11px;font-variant-numeric:tabular-nums;word-wrap:break-word;overflow-wrap:break-word;">
  ${buildEmitenteHeader(cfg.label)}
  <div style="page-break-inside:avoid;">${idPaciente}${idAtendimento}</div>
  <div>${corpoEspecifico}</div>
  ${buildAssinaturaRodape(codigo, qrSvg)}
</div>`;
}

export function buildOrcamentoHtml(o: OrcamentoPDFData): string {
  return `
<div id="orcamento-print" style="font-family:'Inter','Segoe UI',system-ui,sans-serif;color:#1a1a2e;padding:32px 28px;max-width:640px;margin:0 auto;background:#fff;">
  ${buildEmitenteHeader("ORÇAMENTO")}

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px 24px;margin-bottom:18px;">
    <div><p style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:1px;margin:0;">Código</p><p style="font-size:13px;font-weight:600;margin:2px 0 0 0;">${esc(o.id)}</p></div>
    <div><p style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:1px;margin:0;">Data</p><p style="font-size:13px;font-weight:600;margin:2px 0 0 0;">${esc(o.data)}</p></div>
    <div style="grid-column:1 / span 2"><p style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:1px;margin:0;">Paciente</p><p style="font-size:13px;font-weight:600;margin:2px 0 0 0;">${esc(o.paciente)}</p></div>
    <div><p style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:1px;margin:0;">Convênio</p><p style="font-size:13px;margin:2px 0 0 0;">${esc(o.convenio)}</p></div>
    ${o.solicitante ? `<div><p style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:1px;margin:0;">Solicitante</p><p style="font-size:13px;margin:2px 0 0 0;">${esc(o.solicitante)}</p></div>` : ""}
  </div>

  <div style="margin-bottom:18px;">
    <p style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px 0;font-weight:700;">Exames (${o.exames.length})</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead><tr>
        <th style="background:#f5f5f8;text-align:left;padding:8px 12px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666;font-weight:700;">Exame</th>
        <th style="background:#f5f5f8;text-align:right;padding:8px 12px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666;font-weight:700;width:48px;">Nº</th>
      </tr></thead>
      <tbody>
        ${o.exames.map((e, i) => `<tr>
          <td style="padding:9px 12px;border-bottom:1px solid #eee;">${esc(e)}</td>
          <td style="padding:9px 12px;border-bottom:1px solid #eee;text-align:right;color:#666;">${i + 1}</td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>

  <div style="background:#f8f8fb;border-radius:10px;padding:14px 16px;margin-top:16px;">
    <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;"><span style="color:#666;">Subtotal</span><span>${fmtBRL(o.subtotal)}</span></div>
    ${o.desconto > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;color:#16a34a;"><span>Desconto</span><span>- ${fmtBRL(o.desconto)}</span></div>` : ""}
    <div style="display:flex;justify-content:space-between;border-top:2px solid #1a1a2e;margin-top:8px;padding-top:10px;font-size:18px;font-weight:800;"><span>Total</span><span>${fmtBRL(o.total)}</span></div>
  </div>

  <div style="text-align:center;margin-top:14px;padding:10px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:11px;color:#92400e;font-weight:600;">
    ⏳ Orçamento válido por 30 dias a partir da data de emissão
  </div>

  <div style="text-align:center;margin-top:24px;padding-top:14px;border-top:1px dashed #ccc;">
    <p style="font-size:11px;color:#999;line-height:1.6;margin:0;">Este documento é um orçamento e não possui valor fiscal.</p>
    <p style="font-size:10px;color:#bbb;margin:4px 0 0 0;">${esc(getLabConfig().nome || "SISLAC")} · documento gerado eletronicamente</p>
  </div>
</div>`;
}

/** Mantido como helper exportado para callers públicos. */
export function buildOrcamentoHtmlPublic(o: OrcamentoPDFData): string {
  return buildOrcamentoHtml(o);
}

export { COMPROVANTE_TO_DOCUMENTO_TIPO, tipoConfig };
