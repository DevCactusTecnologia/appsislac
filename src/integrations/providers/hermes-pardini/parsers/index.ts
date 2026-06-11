/**
 * Parsers XML reais — Hermes Pardini.
 *
 * Implementação leve baseada em regex/DOM tolerante. NÃO depende de libs
 * externas (compatível com browser e Deno). Para a fase real de homologação,
 * pode ser substituída por um parser SAX/streaming sem alterar a interface.
 */

import type {
  GetResultadoOutput,
  ParsedResponse,
  ResultadoExameDTO,
  VerificarRecebimentoOutput,
} from "../dto";
import {
  extractResultadosBlock,
  parseResultadosLote,
  toLegacyGetResultadoOutput,
  ParseDebug,
} from "./resultadosLote";

/** Remove namespaces (`hp:tag` -> `tag`) para simplificar matching. */
function stripNs(xml: string): string {
  return xml.replace(/<\/?[a-zA-Z0-9]+:/g, (m) => (m.startsWith("</") ? "</" : "<"));
}

function pick(xml: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : undefined;
}

function pickAll(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}

function detectFault(xml: string): { code?: string; message?: string } | null {
  const fault = pick(xml, "Fault");
  if (!fault) return null;
  return {
    code: pick(fault, "faultcode") ?? pick(fault, "Code"),
    message: pick(fault, "faultstring") ?? pick(fault, "Reason"),
  };
}

export function parseVerificarRecebimento(
  rawXml: string,
): ParsedResponse<VerificarRecebimentoOutput> {
  const xml = stripNs(rawXml);
  const fault = detectFault(xml);
  if (fault) {
    return { ok: false, raw: rawXml, faultCode: fault.code, faultString: fault.message };
  }
  const body =
    pick(xml, "verificarRecebimentoPedidoResponse") ??
    pick(xml, "verificarRecebimentoPedidoReturn") ??
    xml;
  const recebido =
    (pick(body, "recebido") ?? pick(body, "status") ?? "").toLowerCase() === "true" ||
    (pick(body, "situacao") ?? "").toUpperCase() === "RECEBIDO";
  return {
    ok: true,
    raw: rawXml,
    data: {
      externalProtocol: pick(body, "numeroPedido") ?? "",
      recebido,
      dataRecebimento: pick(body, "dataRecebimento"),
      situacao: pick(body, "situacao"),
      mensagem: pick(body, "mensagem"),
    },
  };
}

export function parseGetResultadoPedido(
  rawXml: string,
): ParsedResponse<GetResultadoOutput> {
  const xml = stripNs(rawXml);
  const dbg = new ParseDebug();
  const fault = detectFault(xml);
  if (fault) {
    dbg.error("getResultadoPedido: SOAP Fault", fault);
    return {
      ok: false,
      raw: rawXml,
      faultCode: fault.code,
      faultString: fault.message,
      debug: dbg.events,
    };
  }

  // Se o envelope traz o XML real `<Resultados>` (formato Resultados v1.2 do
  // XSD oficial), delega ao parser estruturado e converte para o DTO legado
  // mantendo retro-compatibilidade com o polling existente.
  if (extractResultadosBlock(rawXml)) {
    dbg.info("getResultadoPedido: usando parser Resultados v1.2");
    const lote = parseResultadosLote(rawXml, dbg);
    if (!lote.ok) {
      return {
        ok: false,
        raw: rawXml,
        faultCode: lote.faultCode,
        faultString: lote.faultString,
        debug: dbg.events,
      };
    }
    // Anexa PDF (URL ou base64) quando o envelope o entrega ao lado do XML.
    const pdfFields = extractPdfFields(xml);
    const data = toLegacyGetResultadoOutput(lote.data!);
    if (pdfFields.url) data.laudoPdfUrl = pdfFields.url;
    if (pdfFields.base64) data.laudoPdfBase64 = pdfFields.base64;
    if (pdfFields.url || pdfFields.base64) {
      dbg.info("getResultadoPedido: PDF anexo detectado", {
        url: !!pdfFields.url,
        base64Bytes: pdfFields.base64?.length ?? 0,
      });
    }
    return { ok: true, raw: rawXml, data, debug: dbg.events };
  }

  // Fallback: estrutura legada/fictícia (campos planos `<exame><codigo>...`).
  dbg.warn("getResultadoPedido: usando fallback legado (sem <Resultados>)");
  const body =
    pick(xml, "getResultadoPedidoResponse") ??
    pick(xml, "getResultadoPedidoReturn") ??
    xml;

  const exames: ResultadoExameDTO[] = pickAll(body, "exame").map((bloco) => ({
    codigoApoio: pick(bloco, "codigo") ?? "",
    nomeExame: pick(bloco, "nome") ?? "",
    status: (pick(bloco, "status") ?? "FINAL").toUpperCase(),
    valor: pick(bloco, "valor"),
    unidade: pick(bloco, "unidade"),
    referencia: pick(bloco, "referencia"),
    metodo: pick(bloco, "metodo"),
    material: pick(bloco, "material"),
    liberadoEm: pick(bloco, "dataLiberacao"),
    observacao: pick(bloco, "observacao"),
  }));

  const statusGlobal = (pick(body, "statusPedido") ?? "FINAL").toUpperCase() as GetResultadoOutput["status"];

  return {
    ok: true,
    raw: rawXml,
    data: {
      externalProtocol: pick(body, "numeroPedido") ?? "",
      pacienteNome: pick(body, "pacienteNome"),
      pacienteDocumento: pick(body, "pacienteDocumento"),
      dataColeta: pick(body, "dataColeta"),
      dataLiberacao: pick(body, "dataLiberacao"),
      status: ["PARCIAL", "FINAL", "PENDENTE", "ERRO"].includes(statusGlobal)
        ? statusGlobal
        : "FINAL",
      exames,
      laudoPdfUrl: pick(body, "laudoPdfUrl") ?? pick(body, "urlLaudo"),
      laudoPdfBase64: extractPdfFields(xml).base64,
    },
    debug: dbg.events,
  };
}

/**
 * Extrai campos PDF do envelope: URL externo (`laudoPdfUrl`/`urlLaudo`/`pdfUrl`)
 * e base64 embarcado (`pdf`/`PDF`/`pdfBase64`/`laudoPdfBase64`).
 * Tolerante a wrappers que sirvam o PDF como CDATA texto.
 */
function extractPdfFields(xmlNoNs: string): { url?: string; base64?: string } {
  const url =
    pick(xmlNoNs, "laudoPdfUrl") ??
    pick(xmlNoNs, "urlLaudo") ??
    pick(xmlNoNs, "pdfUrl");
  let base64 =
    pick(xmlNoNs, "pdfBase64") ??
    pick(xmlNoNs, "laudoPdfBase64") ??
    pick(xmlNoNs, "pdf") ??
    pick(xmlNoNs, "PDF");
  if (base64) {
    base64 = base64
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/\s+/g, "");
    if (!/^[A-Za-z0-9+/=]+$/.test(base64) || base64.length < 32) base64 = undefined;
  }
  return {
    url: url && url.trim() ? url.trim() : undefined,
    base64,
  };
}