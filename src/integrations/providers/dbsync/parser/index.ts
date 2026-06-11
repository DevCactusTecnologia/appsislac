/**
 * Parsers leves dos retornos DBSync.
 * Sem dependências externas (XML é extraído por regex tolerante,
 * mesmo padrão do Hermes).
 */

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

// ---------- RecebeAtendimento ----------

export interface RecebeAtendimentoResult {
  /** Indica se o apoio aceitou o atendimento. */
  aceito: boolean;
  /** Protocolo retornado pelo apoio (correlation server-side). */
  protocoloApoio: string | null;
  /** Mensagem livre opcional. */
  mensagem: string | null;
}

export interface ParseResult<T> {
  ok: boolean;
  data: T | null;
  faultString: string | null;
}

export function parseRecebeAtendimento(xml: string): ParseResult<RecebeAtendimentoResult> {
  const fault = pickFault(xml);
  if (fault) return { ok: false, data: null, faultString: fault };
  const protocolo = pick(xml, "ProtocoloApoio") ?? pick(xml, "Protocolo");
  const status = (pick(xml, "Resultado") ?? pick(xml, "Status") ?? "").toLowerCase();
  const aceito = /ok|sucesso|aceit/i.test(status) || !!protocolo;
  return {
    ok: true,
    data: {
      aceito,
      protocoloApoio: protocolo,
      mensagem: pick(xml, "Mensagem"),
    },
    faultString: null,
  };
}

// ---------- ConsultaStatusAtendimento ----------

export interface ConsultaStatusExame {
  codigoExame: string;
  /** Status bruto do DBSync — NUNCA chega ao frontend; passa pelo adapter. */
  statusBruto: string;
  /** Data informada pelo apoio (quando houver). */
  dataAtualizacao: string | null;
}

export interface ConsultaStatusResult {
  protocoloApoio: string | null;
  /** Status global do atendimento (bruto). */
  statusGeralBruto: string | null;
  exames: ConsultaStatusExame[];
}

export function parseConsultaStatus(xml: string): ParseResult<ConsultaStatusResult> {
  const fault = pickFault(xml);
  if (fault) return { ok: false, data: null, faultString: fault };

  const exames: ConsultaStatusExame[] = pickAll(xml, "Exame").map((bloco) => ({
    codigoExame: pick(bloco, "Codigo") ?? "",
    statusBruto: pick(bloco, "Status") ?? "",
    dataAtualizacao: pick(bloco, "DataAtualizacao") ?? pick(bloco, "Data") ?? null,
  }));

  return {
    ok: true,
    data: {
      protocoloApoio: pick(xml, "ProtocoloApoio"),
      statusGeralBruto: pick(xml, "StatusGeral") ?? pick(xml, "Status"),
      exames,
    },
    faultString: null,
  };
}

// ---------- EnviaAmostras ----------

export interface EnviaAmostrasResult {
  aceito: boolean;
  amostrasAceitas: number;
  mensagem: string | null;
}

export function parseEnviaAmostras(xml: string): ParseResult<EnviaAmostrasResult> {
  const fault = pickFault(xml);
  if (fault) return { ok: false, data: null, faultString: fault };
  const status = (pick(xml, "Resultado") ?? pick(xml, "Status") ?? "").toLowerCase();
  const aceitas = Number(pick(xml, "AmostrasAceitas") ?? pickAll(xml, "Amostra").length ?? 0);
  return {
    ok: true,
    data: {
      aceito: /ok|sucesso|aceit/i.test(status),
      amostrasAceitas: Number.isFinite(aceitas) ? aceitas : 0,
      mensagem: pick(xml, "Mensagem"),
    },
    faultString: null,
  };
}

// ---------- ListaProcedimentosPendentes ----------

export interface DBSyncPendencia {
  codigoExame: string;
  motivoBruto: string;
  descricao: string | null;
  exigeRecoleta: boolean;
}

export interface ListaPendentesResult {
  pendencias: DBSyncPendencia[];
}

export function parseListaPendentes(xml: string): ParseResult<ListaPendentesResult> {
  const fault = pickFault(xml);
  if (fault) return { ok: false, data: null, faultString: fault };
  const pendencias: DBSyncPendencia[] = pickAll(xml, "Pendencia").map((bloco) => {
    const motivo = pick(bloco, "Motivo") ?? pick(bloco, "Tipo") ?? "";
    return {
      codigoExame: pick(bloco, "Codigo") ?? pick(bloco, "CodigoExame") ?? "",
      motivoBruto: motivo,
      descricao: pick(bloco, "Descricao") ?? pick(bloco, "Mensagem") ?? null,
      exigeRecoleta: /recolet|nova amostra|insufic/i.test(motivo + (pick(bloco, "Descricao") ?? "")),
    };
  });
  return { ok: true, data: { pendencias }, faultString: null };
}

// ---------- ConsultaLaudoPDF ----------

export interface ConsultaLaudoPdfResult {
  base64: string;
  mimeType: string;
}

export function parseConsultaLaudoPdf(xml: string): ParseResult<ConsultaLaudoPdfResult> {
  const fault = pickFault(xml);
  if (fault) return { ok: false, data: null, faultString: fault };
  const b64 = (pick(xml, "PDF") ?? pick(xml, "Laudo") ?? pick(xml, "Conteudo") ?? "").replace(/\s+/g, "");
  if (!b64) return { ok: false, data: null, faultString: "pdf_vazio" };
  return {
    ok: true,
    data: { base64: b64, mimeType: pick(xml, "MimeType") ?? "application/pdf" },
    faultString: null,
  };
}

// ---------- ConsultaRastreabilidade ----------

export interface DBSyncEventoLogistico {
  data: string | null;
  evento: string;
  local: string | null;
  observacao: string | null;
}

export interface ConsultaRastreabilidadeResult {
  eventos: DBSyncEventoLogistico[];
}

export function parseConsultaRastreabilidade(
  xml: string,
): ParseResult<ConsultaRastreabilidadeResult> {
  const fault = pickFault(xml);
  if (fault) return { ok: false, data: null, faultString: fault };
  const eventos: DBSyncEventoLogistico[] = pickAll(xml, "Evento").map((b) => ({
    data: pick(b, "Data") ?? pick(b, "DataEvento") ?? null,
    evento: pick(b, "Descricao") ?? pick(b, "Tipo") ?? "",
    local: pick(b, "Local") ?? null,
    observacao: pick(b, "Observacao") ?? null,
  }));
  return { ok: true, data: { eventos }, faultString: null };
}

// ---------- ConsultaEtiqueta ----------

export interface ConsultaEtiquetaResult {
  barcode: string;
  material: string | null;
  volume: string | null;
  transport: string | null;
  rawEpl: string | null;
}

export function parseConsultaEtiqueta(xml: string): ParseResult<ConsultaEtiquetaResult> {
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