// Driver Hermes Pardini (Deno/edge) — espelho do driver TS em src/integrations.
// Mantido aqui porque edge functions não compartilham módulos com src/.
// Para Fase 3 (homologação real), apenas o transport precisa ser substituído.

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

export interface BaseInput {
  clientCode: string;
  externalProtocol: string;
  ano?: number;
  login?: string;
  passwd?: string;
}

export interface GetResultadoInput extends BaseInput {
  codExmApoio?: string;
  pdf?: 0 | 1;
  versaoResultado?: number;
  papelTimbrado?: boolean;
  valorReferencia?: 0 | 1;
}

function defaultAno(input: { ano?: number; externalProtocol: string }): number {
  if (input.ano && Number.isFinite(input.ano)) return input.ano;
  const m = String(input.externalProtocol).match(/(20\d{2})/);
  if (m) return Number(m[1]);
  return new Date().getFullYear();
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

function authBlock(i: BaseInput): string {
  const login = i.login ?? i.clientCode ?? "";
  const passwd = i.passwd ?? "";
  const ano = defaultAno(i);
  return `      <login xsi:type="xsd:string">${escapeXml(login)}</login>
      <passwd xsi:type="xsd:string">${escapeXml(passwd)}</passwd>
      <anoCodPedApoio xsi:type="xsd:long">${ano}</anoCodPedApoio>
      <CodPedApoio xsi:type="xsd:string">${escapeXml(i.externalProtocol)}</CodPedApoio>`;
}

export function envelopeVerificarRecebimento(input: BaseInput): string {
  return envHeader("verificarRecebimentoPedido", authBlock(input));
}

export function envelopeGetResultado(input: GetResultadoInput): string {
  const codExm = input.codExmApoio ?? "";
  const pdf = input.pdf == null ? "" : String(input.pdf);
  const versao = input.versaoResultado ?? 1;
  const papelTimbrado = input.papelTimbrado ? "true" : "false";
  const vr = input.valorReferencia ?? 0;
  const inner = `${authBlock(input)}
      <CodExmApoio xsi:type="xsd:string">${escapeXml(codExm)}</CodExmApoio>
      <PDF xsi:type="xsd:long">${pdf}</PDF>
      <versaoResultado xsi:type="xsd:long">${versao}</versaoResultado>
      <papelTimbrado xsi:type="xsd:boolean">${papelTimbrado}</papelTimbrado>
      <valorReferencia xsi:type="xsd:long">${vr}</valorReferencia>`;
  return envHeader("getResultadoPedido", inner);
}

export function envelopeGetPendenciaTecnica(i: BaseInput) {
  return envHeader("getPendenciaTecnica", authBlock(i));
}

export function envelopeGetRastreabilidade(i: BaseInput) {
  return envHeader("getRastreabilidade", authBlock(i));
}

export function envelopeGetLaudoPdf(i: BaseInput) {
  return envHeader("getLaudoPdf", authBlock(i));
}

// ───────── Mocks SOAP/XML ─────────

export function mockVerificarRecebimentoXml(numeroPedido: string): string {
  const recebido = (numeroPedido.length + numeroPedido.charCodeAt(0)) % 10 < 7;
  const data = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:hp="${NS}">
  <soapenv:Body>
    <hp:verificarRecebimentoPedidoResponse>
      <hp:numeroPedido>${numeroPedido}</hp:numeroPedido>
      <hp:recebido>${recebido}</hp:recebido>
      <hp:situacao>${recebido ? "RECEBIDO" : "EM_TRANSITO"}</hp:situacao>
      <hp:dataRecebimento>${recebido ? data : ""}</hp:dataRecebimento>
      <hp:mensagem>${recebido ? "Pedido recebido com sucesso" : "Aguardando recebimento"}</hp:mensagem>
    </hp:verificarRecebimentoPedidoResponse>
  </soapenv:Body>
</soapenv:Envelope>`;
}

export function mockGetResultadoXml(numeroPedido: string): string {
  const liberado = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:hp="${NS}">
  <soapenv:Body>
    <hp:getResultadoPedidoResponse>
      <hp:numeroPedido>${numeroPedido}</hp:numeroPedido>
      <hp:pacienteNome>PACIENTE TESTE MOCK</hp:pacienteNome>
      <hp:pacienteDocumento>00000000000</hp:pacienteDocumento>
      <hp:dataColeta>${liberado}</hp:dataColeta>
      <hp:dataLiberacao>${liberado}</hp:dataLiberacao>
      <hp:statusPedido>FINAL</hp:statusPedido>
      <hp:exames>
        <hp:exame>
          <hp:codigo>HEMOG</hp:codigo>
          <hp:nome>HEMOGRAMA COMPLETO</hp:nome>
          <hp:status>FINAL</hp:status>
          <hp:valor>4.8</hp:valor>
          <hp:unidade>milhões/mm³</hp:unidade>
          <hp:referencia>4.5 - 5.9</hp:referencia>
          <hp:dataLiberacao>${liberado}</hp:dataLiberacao>
        </hp:exame>
        <hp:exame>
          <hp:codigo>GLIC</hp:codigo>
          <hp:nome>GLICOSE</hp:nome>
          <hp:status>FINAL</hp:status>
          <hp:valor>92</hp:valor>
          <hp:unidade>mg/dL</hp:unidade>
          <hp:referencia>70 - 99</hp:referencia>
          <hp:dataLiberacao>${liberado}</hp:dataLiberacao>
        </hp:exame>
      </hp:exames>
    </hp:getResultadoPedidoResponse>
  </soapenv:Body>
</soapenv:Envelope>`;
}

export function mockGetPendenciaXml(numeroPedido: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:hp="${NS}">
  <soapenv:Body><hp:getPendenciaTecnicaResponse>
    <hp:numeroPedido>${numeroPedido}</hp:numeroPedido>
    <hp:pendencias>
      <hp:pendencia><hp:codigoExame>GLIC</hp:codigoExame><hp:tipo>AMOSTRA_INSUFICIENTE</hp:tipo><hp:descricao>Recoletar amostra</hp:descricao><hp:dataRegistro>${new Date().toISOString()}</hp:dataRegistro></hp:pendencia>
    </hp:pendencias>
  </hp:getPendenciaTecnicaResponse></soapenv:Body></soapenv:Envelope>`;
}

export function mockGetRastreabilidadeXml(numeroPedido: string): string {
  const now = new Date();
  const evt = (label: string, off: number) => {
    const d = new Date(now.getTime() - off * 60_000).toISOString();
    return `<hp:evento><hp:etapa>${label}</hp:etapa><hp:data>${d}</hp:data></hp:evento>`;
  };
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:hp="${NS}">
  <soapenv:Body><hp:getRastreabilidadeResponse>
    <hp:numeroPedido>${numeroPedido}</hp:numeroPedido>
    <hp:eventos>${evt("COLETA",240)}${evt("RECEBIDO_APOIO",120)}${evt("EM_ANALISE",60)}${evt("LIBERADO",5)}</hp:eventos>
  </hp:getRastreabilidadeResponse></soapenv:Body></soapenv:Envelope>`;
}

export function mockGetLaudoPdfXml(numeroPedido: string): string {
  // PDF mínimo (1 página) base64.
  const pdfMin = "JVBERi0xLjQKMSAwIG9iago8PC9UeXBlIC9DYXRhbG9nIC9QYWdlcyAyIDAgUj4+CmVuZG9iago" +
    "yIDAgb2JqCjw8L1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDE+PgplbmRvYmoKMyAwIG9iago8" +
    "PC9UeXBlIC9QYWdlIC9QYXJlbnQgMiAwIFIgL01lZGlhQm94IFswIDAgMzAwIDE0NF0+PgplbmRvYmoKeHJl" +
    "ZgowIDQKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTcgMDAwMDAg" +
    "biAKMDAwMDAwMDExMSAwMDAwMCBuIAp0cmFpbGVyCjw8L1NpemUgNCAvUm9vdCAxIDAgUj4+CnN0YXJ0eHJl" +
    "ZgoxNzMKJSVFT0Y=";
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:hp="${NS}">
  <soapenv:Body><hp:getLaudoPdfResponse>
    <hp:numeroPedido>${numeroPedido}</hp:numeroPedido>
    <hp:mimeType>application/pdf</hp:mimeType>
    <hp:conteudo>${pdfMin}</hp:conteudo>
  </hp:getLaudoPdfResponse></soapenv:Body></soapenv:Envelope>`;
}

// ───────── Transport ─────────

export interface SoapTransport {
  request(payload: string, soapAction?: string): Promise<{ status: number; body: string; durationMs: number }>;
}

export class MockSoapTransport implements SoapTransport {
  async request(payload: string): Promise<{ status: number; body: string; durationMs: number }> {
    const t0 = performance.now();
    const numeroPedido =
      extractTag(payload, "CodPedApoio") ??
      extractTag(payload, "numeroPedido") ??
      "MOCK-0000";
    let body: string;
    if (/verificarRecebimentoPedido/i.test(payload)) body = mockVerificarRecebimentoXml(numeroPedido);
    else if (/getResultadoPedido/i.test(payload)) body = mockGetResultadoXml(numeroPedido);
    else if (/getPendenciaTecnica/i.test(payload)) body = mockGetPendenciaXml(numeroPedido);
    else if (/getRastreabilidade/i.test(payload)) body = mockGetRastreabilidadeXml(numeroPedido);
    else if (/getLaudoPdf/i.test(payload)) body = mockGetLaudoPdfXml(numeroPedido);
    else body = soapFault("UnknownOperation", "Operação não suportada pelo mock");
    await new Promise((r) => setTimeout(r, 30 + Math.random() * 80));
    return { status: 200, body, durationMs: Math.round(performance.now() - t0) };
  }
}

export interface HttpTransportConfig {
  endpoint: string;
  username?: string;
  password?: string;
  timeoutMs?: number;
  soapActionPrefix?: string;
}

/**
 * Transport SOAP real (HTTP). Adiciona WS-Security UsernameToken quando
 * credenciais forem fornecidas. Suporta SOAPAction header e timeout.
 */
export class HttpSoapTransport implements SoapTransport {
  constructor(private cfg: HttpTransportConfig) {}

  async request(payload: string, soapAction?: string) {
    const t0 = performance.now();
    const enriched = this.cfg.username
      ? injectWsSecurity(payload, this.cfg.username, this.cfg.password ?? "")
      : payload;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.cfg.timeoutMs ?? 60_000);
    try {
      const res = await fetch(this.cfg.endpoint, {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          "SOAPAction": soapAction
            ? `"${(this.cfg.soapActionPrefix ?? "")}${soapAction}"`
            : "\"\"",
          "Accept": "text/xml, application/xml",
        },
        body: enriched,
      });
      const body = await res.text();
      return { status: res.status, body, durationMs: Math.round(performance.now() - t0) };
    } finally {
      clearTimeout(timer);
    }
  }
}

function injectWsSecurity(envelope: string, username: string, password: string): string {
  const header = `<soapenv:Header><wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" soapenv:mustUnderstand="1"><wsse:UsernameToken><wsse:Username>${escapeXml(username)}</wsse:Username><wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">${escapeXml(password)}</wsse:Password></wsse:UsernameToken></wsse:Security></soapenv:Header>`;
  if (/<soapenv:Header\s*\/>/i.test(envelope)) {
    return envelope.replace(/<soapenv:Header\s*\/>/i, header);
  }
  if (/<soapenv:Header[\s\S]*?<\/soapenv:Header>/i.test(envelope)) {
    return envelope.replace(/<soapenv:Header[\s\S]*?<\/soapenv:Header>/i, header);
  }
  return envelope.replace(/<soapenv:Body/i, `${header}<soapenv:Body`);
}

export function createTransport(
  mode: "MOCK" | "HOMOLOG" | "PROD",
  cfg?: HttpTransportConfig,
): SoapTransport {
  if (mode === "MOCK") return new MockSoapTransport();
  if (!cfg?.endpoint) {
    console.warn("[hermes] HOMOLOG/PROD sem endpoint — fallback MOCK");
    return new MockSoapTransport();
  }
  return new HttpSoapTransport(cfg);
}

function soapFault(code: string, msg: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body><soapenv:Fault><faultcode>${code}</faultcode><faultstring>${msg}</faultstring></soapenv:Fault></soapenv:Body>
</soapenv:Envelope>`;
}

// ───────── Parsers ─────────

function stripNs(xml: string): string {
  return xml.replace(/<\/?[a-zA-Z0-9]+:/g, (m) => (m.startsWith("</") ? "</" : "<"));
}
function pick(xml: string, tag: string): string | undefined {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? m[1].trim() : undefined;
}
function pickAll(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}
function extractTag(xml: string, tag: string): string | undefined {
  const m = xml.match(new RegExp(
    `<(?:[A-Za-z0-9_]+:)?${tag}(?=[\\s/>])[^>]*>([\\s\\S]*?)</(?:[A-Za-z0-9_]+:)?${tag}>`,
    "i",
  ));
  return m ? m[1].trim() : undefined;
}
function detectFault(xml: string): { code?: string; message?: string } | null {
  const fault = pick(xml, "Fault");
  if (!fault) return null;
  return { code: pick(fault, "faultcode"), message: pick(fault, "faultstring") };
}

export interface VerificarRecebimentoOutput {
  externalProtocol: string;
  recebido: boolean;
  dataRecebimento?: string;
  situacao?: string;
  mensagem?: string;
}

export interface ResultadoExameDTO {
  codigoApoio: string;
  nomeExame: string;
  status: string;
  valor?: string;
  unidade?: string;
  referencia?: string;
  metodo?: string;
  material?: string;
  liberadoEm?: string;
  observacao?: string;
}

export interface GetResultadoOutput {
  externalProtocol: string;
  pacienteNome?: string;
  pacienteDocumento?: string;
  dataColeta?: string;
  dataLiberacao?: string;
  status: "PARCIAL" | "FINAL" | "PENDENTE" | "ERRO";
  exames: ResultadoExameDTO[];
  laudoPdfUrl?: string;
}

export interface ParsedResponse<T> {
  ok: boolean;
  data?: T;
  faultCode?: string;
  faultString?: string;
  raw: string;
}

export function parseVerificarRecebimento(rawXml: string): ParsedResponse<VerificarRecebimentoOutput> {
  const xml = stripNs(rawXml);
  const fault = detectFault(xml);
  if (fault) return { ok: false, raw: rawXml, faultCode: fault.code, faultString: fault.message };
  const body = pick(xml, "verificarRecebimentoPedidoResponse") ?? xml;
  const recebido =
    (pick(body, "recebido") ?? "").toLowerCase() === "true" ||
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

export function parseGetResultado(rawXml: string): ParsedResponse<GetResultadoOutput> {
  const xml = stripNs(rawXml);
  const fault = detectFault(xml);
  if (fault) return { ok: false, raw: rawXml, faultCode: fault.code, faultString: fault.message };
  const body = pick(xml, "getResultadoPedidoResponse") ?? xml;
  const exames: ResultadoExameDTO[] = pickAll(body, "exame").map((b) => ({
    codigoApoio: pick(b, "codigo") ?? "",
    nomeExame: pick(b, "nome") ?? "",
    status: (pick(b, "status") ?? "FINAL").toUpperCase(),
    valor: pick(b, "valor"),
    unidade: pick(b, "unidade"),
    referencia: pick(b, "referencia"),
    metodo: pick(b, "metodo"),
    material: pick(b, "material"),
    liberadoEm: pick(b, "dataLiberacao"),
    observacao: pick(b, "observacao"),
  }));
  const statusGlobal = (pick(body, "statusPedido") ?? "FINAL").toUpperCase();
  const status: GetResultadoOutput["status"] =
    statusGlobal === "PARCIAL" || statusGlobal === "PENDENTE" || statusGlobal === "ERRO"
      ? (statusGlobal as GetResultadoOutput["status"])
      : "FINAL";
  return {
    ok: true,
    raw: rawXml,
    data: {
      externalProtocol: pick(body, "numeroPedido") ?? "",
      pacienteNome: pick(body, "pacienteNome"),
      pacienteDocumento: pick(body, "pacienteDocumento"),
      dataColeta: pick(body, "dataColeta"),
      dataLiberacao: pick(body, "dataLiberacao"),
      status,
      exames,
      laudoPdfUrl: pick(body, "laudoPdfUrl"),
    },
  };
}

export interface PendenciaDTO {
  codigoExame?: string;
  tipo?: string;
  descricao?: string;
  dataRegistro?: string;
}
export interface GetPendenciaOutput {
  externalProtocol: string;
  pendencias: PendenciaDTO[];
}
export function parseGetPendencia(rawXml: string): ParsedResponse<GetPendenciaOutput> {
  const xml = stripNs(rawXml);
  const fault = detectFault(xml);
  if (fault) return { ok: false, raw: rawXml, faultCode: fault.code, faultString: fault.message };
  const body = pick(xml, "getPendenciaTecnicaResponse") ?? xml;
  const pendencias: PendenciaDTO[] = pickAll(body, "pendencia").map((b) => ({
    codigoExame: pick(b, "codigoExame"),
    tipo: pick(b, "tipo"),
    descricao: pick(b, "descricao"),
    dataRegistro: pick(b, "dataRegistro"),
  }));
  return { ok: true, raw: rawXml, data: { externalProtocol: pick(body, "numeroPedido") ?? "", pendencias } };
}

export interface RastreEventoDTO { etapa?: string; data?: string; observacao?: string }
export interface GetRastreabilidadeOutput { externalProtocol: string; eventos: RastreEventoDTO[] }
export function parseGetRastreabilidade(rawXml: string): ParsedResponse<GetRastreabilidadeOutput> {
  const xml = stripNs(rawXml);
  const fault = detectFault(xml);
  if (fault) return { ok: false, raw: rawXml, faultCode: fault.code, faultString: fault.message };
  const body = pick(xml, "getRastreabilidadeResponse") ?? xml;
  const eventos: RastreEventoDTO[] = pickAll(body, "evento").map((b) => ({
    etapa: pick(b, "etapa"),
    data: pick(b, "data"),
    observacao: pick(b, "observacao"),
  }));
  return { ok: true, raw: rawXml, data: { externalProtocol: pick(body, "numeroPedido") ?? "", eventos } };
}

export interface GetLaudoPdfOutput {
  externalProtocol: string;
  mimeType: string;
  base64: string;
}
export function parseGetLaudoPdf(rawXml: string): ParsedResponse<GetLaudoPdfOutput> {
  const xml = stripNs(rawXml);
  const fault = detectFault(xml);
  if (fault) return { ok: false, raw: rawXml, faultCode: fault.code, faultString: fault.message };
  const body = pick(xml, "getLaudoPdfResponse") ?? xml;
  const conteudo = pick(body, "conteudo") ?? "";
  const mimeType = pick(body, "mimeType") ?? "application/pdf";
  return {
    ok: true,
    raw: rawXml,
    data: {
      externalProtocol: pick(body, "numeroPedido") ?? "",
      mimeType,
      base64: conteudo.replace(/\s+/g, ""),
    },
  };
}