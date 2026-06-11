/**
 * Envelopes SOAP DBSync.
 *
 * Apenas os dois métodos da Rodada 1 estão aqui:
 *  - RecebeAtendimento
 *  - ConsultaStatusAtendimento
 *
 * Namespace é placeholder até homologação real (será ajustado por config).
 */

const DEFAULT_NS = "http://dbsync.dbdiagnosticos.com.br/ws";

function escapeXml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function envelope(op: string, inner: string, ns = DEFAULT_NS): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:dbs="${ns}">
  <soapenv:Header/>
  <soapenv:Body>
    <dbs:${op}>
${inner}
    </dbs:${op}>
  </soapenv:Body>
</soapenv:Envelope>`;
}

export interface DBSyncAuth {
  usuario: string;
  chave: string;
}

function authBlock(a: DBSyncAuth): string {
  return `      <dbs:Usuario>${escapeXml(a.usuario)}</dbs:Usuario>
      <dbs:Chave>${escapeXml(a.chave)}</dbs:Chave>`;
}

// ---------- RecebeAtendimento ----------

export interface RecebeAtendimentoExame {
  /** Código do procedimento no apoio. */
  codigoExame: string;
  /** Material/amostra (opcional). */
  material?: string;
}

export interface RecebeAtendimentoInput extends DBSyncAuth {
  /** Protocolo gerado no SISLAC para correlação. */
  externalProtocol: string;
  /** Código do paciente no apoio (quando aplicável). */
  codigoPaciente?: string;
  /** Lista de exames a enviar. */
  exames: RecebeAtendimentoExame[];
  /** Metadados livres (opcional, vai como JSON em campo neutro). */
  meta?: Record<string, unknown>;
}

export function envelopeRecebeAtendimento(input: RecebeAtendimentoInput): string {
  const exames = input.exames
    .map(
      (e) => `        <dbs:Exame>
          <dbs:Codigo>${escapeXml(e.codigoExame)}</dbs:Codigo>${
            e.material ? `\n          <dbs:Material>${escapeXml(e.material)}</dbs:Material>` : ""
          }
        </dbs:Exame>`,
    )
    .join("\n");

  const inner = `${authBlock(input)}
      <dbs:Protocolo>${escapeXml(input.externalProtocol)}</dbs:Protocolo>${
        input.codigoPaciente
          ? `\n      <dbs:CodigoPaciente>${escapeXml(input.codigoPaciente)}</dbs:CodigoPaciente>`
          : ""
      }
      <dbs:Exames>
${exames}
      </dbs:Exames>`;

  return envelope("RecebeAtendimento", inner);
}

// ---------- ConsultaStatusAtendimento ----------

export interface ConsultaStatusInput extends DBSyncAuth {
  externalProtocol: string;
  /** Código do exame específico (se quiser filtrar). */
  codigoExame?: string;
}

export function envelopeConsultaStatus(input: ConsultaStatusInput): string {
  const inner = `${authBlock(input)}
      <dbs:Protocolo>${escapeXml(input.externalProtocol)}</dbs:Protocolo>${
        input.codigoExame
          ? `\n      <dbs:CodigoExame>${escapeXml(input.codigoExame)}</dbs:CodigoExame>`
          : ""
      }`;

  return envelope("ConsultaStatusAtendimento", inner);
}

// ---------- EnviaAmostras ----------

export interface EnviaAmostrasInput extends DBSyncAuth {
  externalProtocol: string;
  /** Códigos de barras das amostras já coletadas. */
  amostras: Array<{ barcode: string; codigoExame?: string; material?: string }>;
}

export function envelopeEnviaAmostras(input: EnviaAmostrasInput): string {
  const items = input.amostras
    .map(
      (a) => `        <dbs:Amostra>
          <dbs:CodigoBarras>${escapeXml(a.barcode)}</dbs:CodigoBarras>${
            a.codigoExame ? `\n          <dbs:Codigo>${escapeXml(a.codigoExame)}</dbs:Codigo>` : ""
          }${a.material ? `\n          <dbs:Material>${escapeXml(a.material)}</dbs:Material>` : ""}
        </dbs:Amostra>`,
    )
    .join("\n");
  const inner = `${authBlock(input)}
      <dbs:Protocolo>${escapeXml(input.externalProtocol)}</dbs:Protocolo>
      <dbs:Amostras>
${items}
      </dbs:Amostras>`;
  return envelope("EnviaAmostras", inner);
}

// ---------- ListaProcedimentosPendentes ----------

export interface ListaPendentesInput extends DBSyncAuth {
  externalProtocol: string;
}

export function envelopeListaPendentes(input: ListaPendentesInput): string {
  const inner = `${authBlock(input)}
      <dbs:Protocolo>${escapeXml(input.externalProtocol)}</dbs:Protocolo>`;
  return envelope("ListaProcedimentosPendentes", inner);
}

// ---------- ConsultaLaudoPDF ----------

export interface ConsultaLaudoPdfInput extends DBSyncAuth {
  externalProtocol: string;
  /** Quando ausente, retorna o laudo consolidado. */
  codigoExame?: string;
}

export function envelopeConsultaLaudoPdf(input: ConsultaLaudoPdfInput): string {
  const inner = `${authBlock(input)}
      <dbs:Protocolo>${escapeXml(input.externalProtocol)}</dbs:Protocolo>${
        input.codigoExame
          ? `\n      <dbs:CodigoExame>${escapeXml(input.codigoExame)}</dbs:CodigoExame>`
          : ""
      }`;
  return envelope("ConsultaLaudoPDF", inner);
}

// ---------- ConsultaRastreabilidade ----------

export interface ConsultaRastreabilidadeInput extends DBSyncAuth {
  externalProtocol: string;
}

export function envelopeConsultaRastreabilidade(input: ConsultaRastreabilidadeInput): string {
  const inner = `${authBlock(input)}
      <dbs:Protocolo>${escapeXml(input.externalProtocol)}</dbs:Protocolo>`;
  return envelope("ConsultaRastreabilidade", inner);
}

// ---------- ConsultaEtiqueta ----------

export interface ConsultaEtiquetaInput extends DBSyncAuth {
  externalProtocol: string;
}

export function envelopeConsultaEtiqueta(input: ConsultaEtiquetaInput): string {
  const inner = `${authBlock(input)}
      <dbs:Protocolo>${escapeXml(input.externalProtocol)}</dbs:Protocolo>`;
  return envelope("ConsultaEtiqueta", inner);
}