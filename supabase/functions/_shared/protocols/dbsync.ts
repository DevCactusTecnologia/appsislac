// Driver DB Diagnósticos (Deno/edge) — espelho server-side do provider DBSync.
// Auto-contido: edge functions não compartilham módulos com src/.
// Quando vier homologação real, ajustar apenas namespace/SOAPAction/endpoint.

const NS = "http://dbsync.dbdiagnosticos.com.br/ws";

function escapeXml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function envelope(op: string, inner: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:dbs="${NS}">
  <soapenv:Header/>
  <soapenv:Body>
    <dbs:${op}>
${inner}
    </dbs:${op}>
  </soapenv:Body>
</soapenv:Envelope>`;
}

export interface DBSyncBaseInput {
  /** Usuário do apoio (vai inline no body, não em WS-Security). */
  usuario?: string;
  chave?: string;
  externalProtocol: string;
}

function authBlock(i: DBSyncBaseInput): string {
  return `      <dbs:Usuario>${escapeXml(i.usuario ?? "")}</dbs:Usuario>
      <dbs:Chave>${escapeXml(i.chave ?? "")}</dbs:Chave>`;
}

// ---------- Envelopes ----------

export function envelopeRecebeAtendimento(i: DBSyncBaseInput & {
  exames: Array<{ codigoExame: string; material?: string }>;
  codigoPaciente?: string;
}): string {
  const exames = i.exames
    .map(
      (e) => `        <dbs:Exame>
          <dbs:Codigo>${escapeXml(e.codigoExame)}</dbs:Codigo>${
            e.material ? `\n          <dbs:Material>${escapeXml(e.material)}</dbs:Material>` : ""
          }
        </dbs:Exame>`,
    )
    .join("\n");
  const inner = `${authBlock(i)}
      <dbs:Protocolo>${escapeXml(i.externalProtocol)}</dbs:Protocolo>${
        i.codigoPaciente ? `\n      <dbs:CodigoPaciente>${escapeXml(i.codigoPaciente)}</dbs:CodigoPaciente>` : ""
      }
      <dbs:Exames>
${exames}
      </dbs:Exames>`;
  return envelope("RecebeAtendimento", inner);
}

export function envelopeConsultaStatus(i: DBSyncBaseInput & { codigoExame?: string }): string {
  const inner = `${authBlock(i)}
      <dbs:Protocolo>${escapeXml(i.externalProtocol)}</dbs:Protocolo>${
        i.codigoExame ? `\n      <dbs:CodigoExame>${escapeXml(i.codigoExame)}</dbs:CodigoExame>` : ""
      }`;
  return envelope("ConsultaStatusAtendimento", inner);
}

export function envelopeConsultaLaudoPdf(i: DBSyncBaseInput & { codigoExame?: string }): string {
  const inner = `${authBlock(i)}
      <dbs:Protocolo>${escapeXml(i.externalProtocol)}</dbs:Protocolo>${
        i.codigoExame ? `\n      <dbs:CodigoExame>${escapeXml(i.codigoExame)}</dbs:CodigoExame>` : ""
      }`;
  return envelope("ConsultaLaudoPDF", inner);
}

export function envelopeListaPendentes(i: DBSyncBaseInput): string {
  const inner = `${authBlock(i)}
      <dbs:Protocolo>${escapeXml(i.externalProtocol)}</dbs:Protocolo>`;
  return envelope("ListaProcedimentosPendentes", inner);
}

export function envelopeConsultaRastreabilidade(i: DBSyncBaseInput): string {
  const inner = `${authBlock(i)}
      <dbs:Protocolo>${escapeXml(i.externalProtocol)}</dbs:Protocolo>`;
  return envelope("ConsultaRastreabilidade", inner);
}

export function envelopeConsultaEtiqueta(i: DBSyncBaseInput): string {
  const inner = `${authBlock(i)}
      <dbs:Protocolo>${escapeXml(i.externalProtocol)}</dbs:Protocolo>`;
  return envelope("ConsultaEtiqueta", inner);
}

// ---------- Parsers ----------

function pick(xml: string, tag: string): string | null {
  const re = new RegExp(
    `<(?:[a-zA-Z0-9]+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:[a-zA-Z0-9]+:)?${tag}>`,
    "i",
  );
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}
function pickAll(xml: string, tag: string): string[] {
  const re = new RegExp(
    `<(?:[a-zA-Z0-9]+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:[a-zA-Z0-9]+:)?${tag}>`,
    "gi",
  );
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1].trim());
  return out;
}
function pickFault(xml: string): string | null {
  return pick(xml, "faultstring") ?? pick(xml, "Fault") ?? pick(xml, "MensagemErro");
}

export interface ParseResult<T> {
  ok: boolean;
  data: T | null;
  faultString: string | null;
}

export function parseRecebeAtendimento(xml: string): ParseResult<{
  aceito: boolean;
  protocoloApoio: string | null;
  mensagem: string | null;
}> {
  const fault = pickFault(xml);
  if (fault) return { ok: false, data: null, faultString: fault };
  const protocolo = pick(xml, "ProtocoloApoio") ?? pick(xml, "Protocolo");
  const status = (pick(xml, "Resultado") ?? pick(xml, "Status") ?? "").toLowerCase();
  return {
    ok: true,
    data: {
      aceito: /ok|sucesso|aceit/i.test(status) || !!protocolo,
      protocoloApoio: protocolo,
      mensagem: pick(xml, "Mensagem"),
    },
    faultString: null,
  };
}

// status canônicos do SISLAC
export type CanonicalStatus =
  | "AGUARDANDO_ENVIO" | "ENVIADO" | "PROCESSANDO"
  | "RETORNO_RECEBIDO" | "FINALIZADO" | "FALHA";

const STATUS_RULES: Array<{ re: RegExp; canonical: CanonicalStatus }> = [
  { re: /aguardando/i, canonical: "AGUARDANDO_ENVIO" },
  { re: /enviad/i, canonical: "ENVIADO" },
  { re: /(recebid[oa]|área técnica|area tecnica|em análise|em analise|em processo|processand)/i, canonical: "PROCESSANDO" },
  { re: /(retorno|liberad[oa] parcial)/i, canonical: "RETORNO_RECEBIDO" },
  { re: /(liberad[oa] (clínic|clinic|final)|conclu[íi]d)/i, canonical: "FINALIZADO" },
  { re: /(erro|falha|recus|rejeit|cancelad)/i, canonical: "FALHA" },
];
export function mapDBSyncStatusServer(raw: string | null | undefined): CanonicalStatus {
  const safe = String(raw ?? "").trim();
  if (!safe) return "AGUARDANDO_ENVIO";
  for (const r of STATUS_RULES) if (r.re.test(safe)) return r.canonical;
  return "PROCESSANDO";
}

export interface ConsultaStatusResultServer {
  protocoloApoio: string | null;
  statusGeralCanonical: CanonicalStatus;
  statusGeralBruto: string | null;
  exames: Array<{
    codigoExame: string;
    statusBruto: string;
    statusCanonical: CanonicalStatus;
    dataAtualizacao: string | null;
  }>;
}

export function parseConsultaStatus(xml: string): ParseResult<ConsultaStatusResultServer> {
  const fault = pickFault(xml);
  if (fault) return { ok: false, data: null, faultString: fault };
  const exames = pickAll(xml, "Exame").map((b) => {
    const sb = pick(b, "Status") ?? "";
    return {
      codigoExame: pick(b, "Codigo") ?? "",
      statusBruto: sb,
      statusCanonical: mapDBSyncStatusServer(sb),
      dataAtualizacao: pick(b, "DataAtualizacao") ?? pick(b, "Data") ?? null,
    };
  });
  const sg = pick(xml, "StatusGeral") ?? pick(xml, "Status");
  return {
    ok: true,
    data: {
      protocoloApoio: pick(xml, "ProtocoloApoio"),
      statusGeralBruto: sg,
      statusGeralCanonical: mapDBSyncStatusServer(sg),
      exames,
    },
    faultString: null,
  };
}

export function parseConsultaLaudoPdf(xml: string): ParseResult<{ base64: string; mimeType: string }> {
  const fault = pickFault(xml);
  if (fault) return { ok: false, data: null, faultString: fault };
  const b64 = (pick(xml, "PDF") ?? pick(xml, "Laudo") ?? pick(xml, "Conteudo") ?? "").replace(/\s+/g, "");
  if (!b64) return { ok: false, data: null, faultString: "pdf_vazio" };
  return { ok: true, data: { base64: b64, mimeType: pick(xml, "MimeType") ?? "application/pdf" }, faultString: null };
}

export interface DBSyncPendenciaServer {
  codigoExame: string;
  motivoBruto: string;
  descricao: string | null;
  exigeRecoleta: boolean;
}

export function parseListaPendentes(xml: string): ParseResult<{ pendencias: DBSyncPendenciaServer[] }> {
  const fault = pickFault(xml);
  if (fault) return { ok: false, data: null, faultString: fault };
  const pendencias = pickAll(xml, "Pendencia").map((b) => {
    const motivo = pick(b, "Motivo") ?? pick(b, "Tipo") ?? "";
    const desc = pick(b, "Descricao") ?? pick(b, "Mensagem") ?? null;
    return {
      codigoExame: pick(b, "Codigo") ?? pick(b, "CodigoExame") ?? "",
      motivoBruto: motivo,
      descricao: desc,
      exigeRecoleta: /recolet|nova amostra|insufic/i.test(`${motivo} ${desc ?? ""}`),
    };
  });
  return { ok: true, data: { pendencias }, faultString: null };
}

export interface DBSyncEventoServer {
  data: string | null;
  evento: string;
  local: string | null;
  observacao: string | null;
}

export function parseConsultaRastreabilidade(xml: string): ParseResult<{ eventos: DBSyncEventoServer[] }> {
  const fault = pickFault(xml);
  if (fault) return { ok: false, data: null, faultString: fault };
  const eventos = pickAll(xml, "Evento").map((b) => ({
    data: pick(b, "Data") ?? pick(b, "DataEvento") ?? null,
    evento: pick(b, "Descricao") ?? pick(b, "Tipo") ?? "",
    local: pick(b, "Local") ?? null,
    observacao: pick(b, "Observacao") ?? null,
  }));
  return { ok: true, data: { eventos }, faultString: null };
}

export interface DBSyncEtiquetaServer {
  barcode: string;
  material: string | null;
  volume: string | null;
  transport: string | null;
  rawEpl: string | null;
}

export function parseConsultaEtiqueta(xml: string): ParseResult<DBSyncEtiquetaServer> {
  const fault = pickFault(xml);
  if (fault) return { ok: false, data: null, faultString: fault };
  const barcode = pick(xml, "CodigoBarras") ?? pick(xml, "Barcode") ?? "";
  if (!barcode) return { ok: false, data: null, faultString: "etiqueta_sem_barcode" };
  return {
    ok: true,
    data: {
      barcode,
      material: pick(xml, "Material"),
      volume: pick(xml, "Volume"),
      transport: pick(xml, "Transporte") ?? pick(xml, "Conservacao"),
      rawEpl: pick(xml, "EPL") ?? pick(xml, "ZPL") ?? null,
    },
    faultString: null,
  };
}

// ---------- Transport ----------

export type DBSyncMode = "MOCK" | "HOMOLOG" | "PROD";

export interface DBSyncTransportConfig {
  mode: DBSyncMode;
  endpoint: string;
  endpointFallback?: string;
  timeoutMs?: number;
  soapActionPrefix?: string;
}

export interface DBSyncResponse {
  status: number;
  body: string;
  headers: Record<string, string>;
  durationMs: number;
}

function mockResponse(payload: string): DBSyncResponse {
  const op = payload.match(/<dbs:([A-Za-z]+)\b/)?.[1] ?? "Unknown";
  let body: string;
  switch (op) {
    case "RecebeAtendimento":
      body = `<?xml version="1.0"?><soapenv:Envelope xmlns:soapenv="x" xmlns:dbs="d"><soapenv:Body><dbs:RecebeAtendimentoResponse><dbs:Resultado>OK</dbs:Resultado><dbs:ProtocoloApoio>MOCK-DB-${Date.now().toString(36).toUpperCase()}</dbs:ProtocoloApoio><dbs:Mensagem>Atendimento aceito (mock)</dbs:Mensagem></dbs:RecebeAtendimentoResponse></soapenv:Body></soapenv:Envelope>`;
      break;
    case "ConsultaStatusAtendimento":
      body = `<?xml version="1.0"?><soapenv:Envelope xmlns:soapenv="x" xmlns:dbs="d"><soapenv:Body><dbs:ConsultaStatusAtendimentoResponse><dbs:ProtocoloApoio>MOCK-DB</dbs:ProtocoloApoio><dbs:StatusGeral>Liberado Clínico</dbs:StatusGeral><dbs:Exame><dbs:Codigo>HMG</dbs:Codigo><dbs:Status>Liberado Clínico</dbs:Status><dbs:DataAtualizacao>${new Date().toISOString()}</dbs:DataAtualizacao></dbs:Exame></dbs:ConsultaStatusAtendimentoResponse></soapenv:Body></soapenv:Envelope>`;
      break;
    case "ConsultaLaudoPDF":
      body = `<?xml version="1.0"?><soapenv:Envelope xmlns:soapenv="x" xmlns:dbs="d"><soapenv:Body><dbs:ConsultaLaudoPDFResponse><dbs:MimeType>application/pdf</dbs:MimeType><dbs:PDF>JVBERi0xLjQKJ2RibW9jaykK</dbs:PDF></dbs:ConsultaLaudoPDFResponse></soapenv:Body></soapenv:Envelope>`;
      break;
    case "ListaProcedimentosPendentes":
      body = `<?xml version="1.0"?><soapenv:Envelope xmlns:soapenv="x" xmlns:dbs="d"><soapenv:Body><dbs:ListaProcedimentosPendentesResponse></dbs:ListaProcedimentosPendentesResponse></soapenv:Body></soapenv:Envelope>`;
      break;
    case "ConsultaRastreabilidade":
      body = `<?xml version="1.0"?><soapenv:Envelope xmlns:soapenv="x" xmlns:dbs="d"><soapenv:Body><dbs:ConsultaRastreabilidadeResponse><dbs:Evento><dbs:Data>${new Date().toISOString()}</dbs:Data><dbs:Descricao>Coletado</dbs:Descricao><dbs:Local>Unidade Sede</dbs:Local></dbs:Evento></dbs:ConsultaRastreabilidadeResponse></soapenv:Body></soapenv:Envelope>`;
      break;
    case "ConsultaEtiqueta":
      body = `<?xml version="1.0"?><soapenv:Envelope xmlns:soapenv="x" xmlns:dbs="d"><soapenv:Body><dbs:ConsultaEtiquetaResponse><dbs:CodigoBarras>DBMOCK0001</dbs:CodigoBarras><dbs:Material>Sangue total</dbs:Material><dbs:Volume>4 mL</dbs:Volume><dbs:Transporte>Refrigerado</dbs:Transporte></dbs:ConsultaEtiquetaResponse></soapenv:Body></soapenv:Envelope>`;
      break;
    default:
      body = `<?xml version="1.0"?><soapenv:Envelope xmlns:soapenv="x"><soapenv:Body><soapenv:Fault><faultstring>operation_not_implemented_in_mock</faultstring></soapenv:Fault></soapenv:Body></soapenv:Envelope>`;
  }
  return { status: 200, body, headers: {}, durationMs: 1 };
}

export interface DBSyncTransport {
  request(payload: string): Promise<DBSyncResponse>;
}

class HttpDBSyncTransport implements DBSyncTransport {
  constructor(private cfg: DBSyncTransportConfig) {}
  async request(payload: string): Promise<DBSyncResponse> {
    return await this.attempt(this.cfg.endpoint, payload).catch(async (err) => {
      if (this.cfg.endpointFallback && this.cfg.endpointFallback !== this.cfg.endpoint) {
        return await this.attempt(this.cfg.endpointFallback, payload);
      }
      throw err;
    });
  }
  private async attempt(url: string, payload: string): Promise<DBSyncResponse> {
    const t0 = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.cfg.timeoutMs ?? 30_000);
    try {
      const op = payload.match(/<dbs:([A-Za-z]+)\b/)?.[1] ?? "";
      const action = op ? `${this.cfg.soapActionPrefix ?? ""}${op}` : "";
      const res = await fetch(url, {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: action ? `"${action}"` : '""',
          Accept: "text/xml, application/xml",
        },
        body: payload,
      });
      const body = await res.text();
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => (headers[k] = v));
      return { status: res.status, body, headers, durationMs: Date.now() - t0 };
    } finally {
      clearTimeout(timer);
    }
  }
}

class MockDBSyncTransport implements DBSyncTransport {
  async request(payload: string): Promise<DBSyncResponse> {
    return mockResponse(payload);
  }
}

export function createDBSyncTransport(cfg: DBSyncTransportConfig): DBSyncTransport {
  if (cfg.mode === "MOCK") return new MockDBSyncTransport();
  return new HttpDBSyncTransport(cfg);
}