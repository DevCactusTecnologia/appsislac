// Renderiza o HTML final de um documento (comprovante / declaração / etc.)
// a partir do template salvo em `documento_templates` + dados do contexto.
//
// Estratégia:
//   1) Se houver template PADRÃO ATIVO para o tipo, usa-o.
//   2) Caso contrário, retorna null e o chamador deve usar o layout legado.
//   3) Cabeçalho/rodapé são pré-pendados/anexados se houver templates desses
//      tipos com padrão configurado.

import { renderPlaceholders } from "@/lib/mapaPlaceholders";
import { normalizeMapaHtml } from "@/lib/mapaSharedStyles";
import {
  getTemplatePadrao,
  type DocumentoTipo,
} from "@/data/documentoTemplatesStore";
import { getLabConfig } from "@/data/labConfigStore";
import { fmtBRL } from "@/lib/utils";
import { escapeHtml as escape } from "@/lib/escapeHtml";
import { buildDocumentoFooterHtml, type ComprovanteTipo } from "@/lib/comprovantes";
import { removerLinhasHorizontaisDocumento } from "@/lib/documentoTemplatesPadrao";
import { buildWatermarkCss } from "@/lib/watermark";
import type { PlaceholderData } from "@/types/domain";


export interface DocumentoRenderContext {
  /** Dados do paciente */
  paciente: {
    nome: string;
    cpf?: string;
    nascimento?: string;
    idade?: string;
    sexo?: string;
  };
  /** Dados do atendimento / documento */
  atendimento: {
    protocolo: string;
    data: string;
    convenio?: string;
    solicitante?: string;
    prioridade?: string;
    dataCadastro?: string;
    dataFinalizacao?: string;
  };
  /** Unidade que emite */
  unidade?: {
    nome: string;
    endereco?: string;
    cidade?: string;
    estado?: string;
    telefone?: string;
  };
  /** Lista de exames */
  exames?: { nome: string; material?: string; valor?: number }[];
  /** Pagamentos efetuados */
  pagamentos?: { tipo: string; data: string; valor: number }[];
  /** Totais financeiros */
  totais?: {
    subtotal: number;
    desconto: number;
    pago: number;
    total: number;
    saldo: number;
  };
}

/** Constrói o objeto de dados achatado para renderPlaceholders. */
function buildData(ctx: DocumentoRenderContext): PlaceholderData {
  const lab = getLabConfig();
  return {
    paciente: { ...ctx.paciente } as PlaceholderData,
    atendimento: { ...ctx.atendimento } as PlaceholderData,
    protocolo: ctx.atendimento.protocolo,
    convenio: { nome: ctx.atendimento.convenio ?? "" },
    solicitante: { nome: ctx.atendimento.solicitante ?? "" },
    unidade: (ctx.unidade ?? {}) as PlaceholderData,
    laboratorio: {
      nome: lab.nome ?? "",
      cnpj: lab.cnpj ?? "",
      telefone: lab.telefone ?? "",
      email: lab.email ?? "",
      endereco: lab.endereco ?? "",
      cidade: lab.cidade ?? "",
      estado: lab.estado ?? "",
      logo: lab.logo ?? "",
      razaoSocial: lab.razaoSocial ?? "",
      inscricaoMunicipal: lab.inscricaoMunicipal ?? "",
      cnes: lab.cnes ?? "",
      responsavelTecnico: lab.responsavelTecnico ?? "",
      responsavelTecnicoConselho: lab.responsavelTecnicoConselho ?? "",
      responsavelTecnicoNumero: lab.responsavelTecnicoNumero ?? "",
      responsavelTecnicoUf: lab.responsavelTecnicoUf ?? "",
    },
    sistema: {
      dataImpressao: new Date().toLocaleString("pt-BR"),
      usuario: "",
    },
    // Listas dinâmicas substituídas como blocos HTML pré-renderizados:
    exames: { lista: renderListaExames(ctx) },
    pagamentos: { lista: renderListaPagamentos(ctx) },
    totais: ctx.totais
      ? {
          subtotal: fmtBRL(ctx.totais.subtotal),
          desconto: fmtBRL(ctx.totais.desconto),
          pago: fmtBRL(ctx.totais.pago),
          total: fmtBRL(ctx.totais.total),
          saldo: fmtBRL(ctx.totais.saldo),
        }
      : {},
  };
}

function renderListaExames(ctx: DocumentoRenderContext): string {
  const exs = ctx.exames ?? [];
  if (exs.length === 0) return "";
  const rows = exs
    .map(
      (e) => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${escape(e.nome)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;color:#666;">${escape(e.material ?? "—")}</td>
        ${
          e.valor != null
            ? `<td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${fmtBRL(e.valor)}</td>`
            : ""
        }
      </tr>`,
    )
    .join("");
  return `<table style="width:100%;border-collapse:collapse;font-size:13px;">
    <thead><tr>
      <th style="text-align:left;padding:6px 10px;background:#f5f5f8;font-size:10px;text-transform:uppercase;color:#666;">Exame</th>
      <th style="text-align:left;padding:6px 10px;background:#f5f5f8;font-size:10px;text-transform:uppercase;color:#666;">Material</th>
      ${exs.some((e) => e.valor != null) ? `<th style="text-align:right;padding:6px 10px;background:#f5f5f8;font-size:10px;text-transform:uppercase;color:#666;">Valor</th>` : ""}
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderListaPagamentos(ctx: DocumentoRenderContext): string {
  const ps = ctx.pagamentos ?? [];
  if (ps.length === 0) return "";
  const rows = ps
    .map(
      (p) => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${escape(p.tipo)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;color:#666;">${escape(p.data)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${fmtBRL(p.valor)}</td>
      </tr>`,
    )
    .join("");
  return `<table style="width:100%;border-collapse:collapse;font-size:13px;">
    <tbody>${rows}</tbody>
  </table>`;
}


/**
 * Renderiza um documento usando o template configurado. Retorna `null`
 * quando não houver template padrão para o tipo (caller deve usar fallback).
 */
export function renderDocumentoTemplate(
  tipo: DocumentoTipo,
  ctx: DocumentoRenderContext,
): string | null {
  const tpl = getTemplatePadrao(tipo);
  if (!tpl || !tpl.conteudo.trim()) return null;

  const data = buildData(ctx);
  const corpo = renderPlaceholders(
    unwrapBlockPlaceholders(normalizeMapaHtml(removerLinhasHorizontaisDocumento(tpl.conteudo))),
    data,
  );

  // Determina se deve exibir o cabeçalho/rodapé genérico configurado no laboratório.
  // Por padrão, comprovantes e declarações são auto-contidos e não exibem o
  // cabeçalho/rodapé genérico para evitar duplicidade de branding.
  const tplConfig = (tpl.config || {}) as any;
  const isComprovante = [
    "comprovante_pagamento",
    "comprovante_atendimento",
    "declaracao_comparecimento",
    "orcamento",
  ].includes(tipo);

  const exibirCabecalho = tplConfig.exibirCabecalho === true || (!isComprovante && tplConfig.ocultarCabecalho !== true);
  const exibirRodape = tplConfig.exibirRodape === true || (!isComprovante && tplConfig.ocultarRodape !== true);

  const cabecalho = exibirCabecalho ? renderHeaderFooter("cabecalho", data) : "";
  const rodape = exibirRodape ? renderHeaderFooter("rodape", data) : "";

  // Rodapé legal padrão (QR code + código de verificação + assinatura RT).
  // Aplicado automaticamente apenas aos tipos de comprovante/declaração.
  const tipoToComprovante: Partial<Record<DocumentoTipo, ComprovanteTipo>> = {
    comprovante_pagamento: "pagamento",
    comprovante_atendimento: "atendimento",
    declaracao_comparecimento: "comparecimento",
    orcamento: "pagamento", // Orçamento usa o mesmo layout de rodapé de pagamento (sem QR de quitação se não houver totais pagos)
  };
  const compTipo = tipoToComprovante[tipo];
  const rodapePadrao = compTipo
    ? buildDocumentoFooterHtml({
        tipo: compTipo,
        protocolo: ctx.atendimento.protocolo,
        data: ctx.atendimento.data,
        paciente: ctx.paciente,
        convenio: ctx.atendimento.convenio,
        solicitante: ctx.atendimento.solicitante,
        unidade: ctx.unidade,
        exames: ctx.exames,
        pagamentos: ctx.pagamentos,
        totais: ctx.totais,
      })
    : "";

  return `<div style="font-family:'Inter','Segoe UI',system-ui,sans-serif;color:#1a1a2e;padding:12px;max-width:640px;margin:0 auto;background:#fff;">
    ${cabecalho}
    <div class="documento-corpo">${corpo}</div>
    ${rodapePadrao}
    ${rodape}
  </div>`;
}

function renderHeaderFooter(
  tipo: "cabecalho" | "rodape",
  data: PlaceholderData,
): string {
  const tpl = getTemplatePadrao(tipo);
  if (!tpl || !tpl.conteudo.trim()) return "";
  return `<div class="documento-${tipo}">${renderPlaceholders(
    unwrapBlockPlaceholders(normalizeMapaHtml(removerLinhasHorizontaisDocumento(tpl.conteudo))),
    data,
  )}</div>`;
}

/**
 * Renderiza apenas o cabeçalho/rodapé padrão (template marcado como padrão
 * em /configuracoes → Documentos) a partir de um contexto de impressão.
 * Retorna string vazia se não houver template configurado — o caller é
 * responsável por aplicar fallback se necessário.
 *
 * Usado por: impressão de laudos (Resultados), comprovantes, etc.
 */
export function renderCabecalhoPadrao(ctx: DocumentoRenderContext): string {
  return renderHeaderFooter("cabecalho", buildData(ctx));
}

export function renderRodapePadrao(ctx: DocumentoRenderContext): string {
  return renderHeaderFooter("rodape", buildData(ctx));
}

/**
 * Placeholders que serão substituídos por blocos HTML (<table>) NÃO podem
 * ficar dentro de <p>…</p> — o navegador "expulsa" a tabela do parágrafo
 * e quebra todo o layout. Removemos esse wrapper para compatibilidade com layouts legados.
 */
const BLOCK_PLACEHOLDERS = ["exames.lista", "pagamentos.lista"];
function unwrapBlockPlaceholders(html: string): string {
  let out = html;
  for (const tag of BLOCK_PLACEHOLDERS) {
    const re = new RegExp(
      `<p[^>]*>\\s*(\\{\\{\\s*${tag.replace(".", "\\.")}\\s*\\}\\})\\s*</p>`,
      "g",
    );
    out = out.replace(re, "$1");
  }
  return out;
}

/** Lista de placeholders aceitos no editor de documentos. */
import type { PlaceholderDef } from "./mapaPlaceholders";

export const DOCUMENTO_PLACEHOLDERS: PlaceholderDef[] = [
  // Paciente
  { tag: "paciente.nome", label: "Nome do paciente", group: "Paciente" },
  { tag: "paciente.cpf", label: "CPF", group: "Paciente" },
  { tag: "paciente.nascimento", label: "Data de nascimento", group: "Paciente" },
  { tag: "paciente.idade", label: "Idade", group: "Paciente" },
  { tag: "paciente.sexo", label: "Sexo", group: "Paciente" },
  // Atendimento
  { tag: "atendimento.protocolo", label: "Protocolo", group: "Atendimento" },
  { tag: "atendimento.data", label: "Data do atendimento", group: "Atendimento" },
  { tag: "atendimento.prioridade", label: "Prioridade", group: "Atendimento" },
  { tag: "atendimento.dataCadastro", label: "Data de cadastro", group: "Atendimento" },
  { tag: "atendimento.dataFinalizacao", label: "Data de finalização", group: "Atendimento" },
  // Convênio / Solicitante
  { tag: "convenio.nome", label: "Convênio", group: "Convênio" },
  { tag: "solicitante.nome", label: "Solicitante", group: "Solicitante" },
  // Unidade
  { tag: "unidade.nome", label: "Nome da unidade", group: "Unidade" },
  { tag: "unidade.endereco", label: "Endereço", group: "Unidade" },
  { tag: "unidade.cidade", label: "Cidade", group: "Unidade" },
  { tag: "unidade.estado", label: "Estado", group: "Unidade" },
  { tag: "unidade.telefone", label: "Telefone", group: "Unidade" },
  // Laboratório
  { tag: "laboratorio.nome", label: "Nome", group: "Laboratório" },
  { tag: "laboratorio.razaoSocial", label: "Razão social", group: "Laboratório" },
  { tag: "laboratorio.cnpj", label: "CNPJ", group: "Laboratório" },
  { tag: "laboratorio.telefone", label: "Telefone", group: "Laboratório" },
  { tag: "laboratorio.email", label: "E-mail", group: "Laboratório" },
  { tag: "laboratorio.endereco", label: "Endereço", group: "Laboratório" },
  { tag: "laboratorio.cidade", label: "Cidade", group: "Laboratório" },
  { tag: "laboratorio.estado", label: "Estado", group: "Laboratório" },
  { tag: "laboratorio.inscricaoMunicipal", label: "Inscrição municipal", group: "Laboratório" },
  { tag: "laboratorio.cnes", label: "CNES", group: "Laboratório" },
  { tag: "laboratorio.responsavelTecnico", label: "Responsável técnico", group: "Laboratório" },
  { tag: "laboratorio.responsavelTecnicoConselho", label: "Conselho do RT", group: "Laboratório" },
  { tag: "laboratorio.responsavelTecnicoNumero", label: "Nº do conselho do RT", group: "Laboratório" },
  { tag: "laboratorio.responsavelTecnicoUf", label: "UF do conselho do RT", group: "Laboratório" },
  // Listas
  { tag: "exames.lista", label: "Lista de exames (tabela)", group: "Exame" },
  { tag: "pagamentos.lista", label: "Lista de pagamentos (tabela)", group: "Pagamentos" },
  // Totais
  { tag: "totais.subtotal", label: "Subtotal", group: "Totais" },
  { tag: "totais.desconto", label: "Desconto", group: "Totais" },
  { tag: "totais.pago", label: "Total pago", group: "Totais" },
  { tag: "totais.total", label: "Total geral", group: "Totais" },
  { tag: "totais.saldo", label: "Saldo", group: "Totais" },
  // Sistema
  { tag: "sistema.dataImpressao", label: "Data de impressão", group: "Sistema" },
];
