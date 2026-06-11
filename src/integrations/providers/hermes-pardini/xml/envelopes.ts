/**
 * Geradores de envelopes SOAP — Hermes Pardini B2B Apoio (Multiapoio).
 *
 * Atualizado para o contrato vigente: namespace `b2b/apoio/schemas`,
 * autenticação via `<login>`/`<passwd>` no body (não usa WS-Security),
 * e novos parâmetros `papelTimbrado` (laudo personalizado) e
 * `valorReferencia` (VR individualizado, 0/1).
 */

const NS = "http://hermespardini.com.br/b2b/apoio/schemas";
const SOAP_ENC = "http://schemas.xmlsoap.org/soap/encoding/";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function envHeader(rootOp: string, inner: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:sch="${NS}">
  <soapenv:Header/>
  <soapenv:Body>
    <sch:${rootOp} soapenv:encodingStyle="${SOAP_ENC}">
${inner}
    </sch:${rootOp}>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function defaultAno(input: { ano?: number; externalProtocol: string }): number {
  if (input.ano && Number.isFinite(input.ano)) return input.ano;
  // Tenta extrair "20XX" do prefixo do protocolo externo.
  const m = String(input.externalProtocol).match(/(20\d{2})/);
  if (m) return Number(m[1]);
  return new Date().getFullYear();
}

export function envelopeVerificarRecebimentoPedido(input: {
  clientCode: string;
  externalProtocol: string;
  ano?: number;
  login?: string;
  passwd?: string;
}): string {
  const login = input.login ?? input.clientCode ?? "";
  const passwd = input.passwd ?? "";
  const ano = defaultAno(input);
  const inner =
`      <login xsi:type="xsd:string">${escapeXml(login)}</login>
      <passwd xsi:type="xsd:string">${escapeXml(passwd)}</passwd>
      <anoCodPedApoio xsi:type="xsd:long">${ano}</anoCodPedApoio>
      <CodPedApoio xsi:type="xsd:string">${escapeXml(input.externalProtocol)}</CodPedApoio>`;
  return envHeader("verificarRecebimentoPedido", inner);
}

export function envelopeGetResultadoPedido(input: {
  clientCode: string;
  externalProtocol: string;
  ano?: number;
  login?: string;
  passwd?: string;
  codExmApoio?: string;
  pdf?: 0 | 1;
  versaoResultado?: number;
  papelTimbrado?: boolean;
  valorReferencia?: 0 | 1;
}): string {
  const login = input.login ?? input.clientCode ?? "";
  const passwd = input.passwd ?? "";
  const ano = defaultAno(input);
  const codExm = input.codExmApoio ?? "";
  const pdf = input.pdf == null ? "" : String(input.pdf);
  const versao = input.versaoResultado ?? 1;
  const papelTimbrado = input.papelTimbrado ? "true" : "false";
  const vr = input.valorReferencia ?? 0;
  const inner =
`      <login xsi:type="xsd:string">${escapeXml(login)}</login>
      <passwd xsi:type="xsd:string">${escapeXml(passwd)}</passwd>
      <anoCodPedApoio xsi:type="xsd:long">${ano}</anoCodPedApoio>
      <CodPedApoio xsi:type="xsd:string">${escapeXml(input.externalProtocol)}</CodPedApoio>
      <CodExmApoio xsi:type="xsd:string">${escapeXml(codExm)}</CodExmApoio>
      <PDF xsi:type="xsd:long">${pdf}</PDF>
      <versaoResultado xsi:type="xsd:long">${versao}</versaoResultado>
      <papelTimbrado xsi:type="xsd:boolean">${papelTimbrado}</papelTimbrado>
      <valorReferencia xsi:type="xsd:long">${vr}</valorReferencia>`;
  return envHeader("getResultadoPedido", inner);
}

export const SOAP_ACTIONS = {
  verificarRecebimentoPedido: `${NS}/verificarRecebimentoPedido`,
  getResultadoPedido: `${NS}/getResultadoPedido`,
} as const;