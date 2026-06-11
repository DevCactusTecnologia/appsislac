import type {
  SoapRequestOptions,
  SoapResponse,
  SoapTransport,
} from "../../../contracts/transport";

/**
 * Mock transport DBSync — não faz I/O real.
 * Usado em testes e em ambiente local antes da homologação.
 */
export class MockDBSyncTransport implements SoapTransport {
  async request(payload: string, _opts?: SoapRequestOptions): Promise<SoapResponse> {
    const op = payload.match(/<dbs:([A-Za-z]+)\b/)?.[1] ?? "Unknown";
    let body = "";
    if (op === "RecebeAtendimento") {
      body = `<?xml version="1.0"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:dbs="http://dbsync.dbdiagnosticos.com.br/ws"><soapenv:Body><dbs:RecebeAtendimentoResponse><dbs:Resultado>OK</dbs:Resultado><dbs:ProtocoloApoio>MOCK-DB-0001</dbs:ProtocoloApoio><dbs:Mensagem>Atendimento aceito (mock)</dbs:Mensagem></dbs:RecebeAtendimentoResponse></soapenv:Body></soapenv:Envelope>`;
    } else if (op === "ConsultaStatusAtendimento") {
      body = `<?xml version="1.0"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:dbs="http://dbsync.dbdiagnosticos.com.br/ws"><soapenv:Body><dbs:ConsultaStatusAtendimentoResponse><dbs:ProtocoloApoio>MOCK-DB-0001</dbs:ProtocoloApoio><dbs:StatusGeral>Em análise</dbs:StatusGeral><dbs:Exame><dbs:Codigo>HMG</dbs:Codigo><dbs:Status>Recebido Área Técnica</dbs:Status><dbs:DataAtualizacao>2026-05-08T10:00:00Z</dbs:DataAtualizacao></dbs:Exame></dbs:ConsultaStatusAtendimentoResponse></soapenv:Body></soapenv:Envelope>`;
    } else if (op === "EnviaAmostras") {
      body = `<?xml version="1.0"?><soapenv:Envelope xmlns:soapenv="x" xmlns:dbs="d"><soapenv:Body><dbs:EnviaAmostrasResponse><dbs:Resultado>OK</dbs:Resultado><dbs:AmostrasAceitas>1</dbs:AmostrasAceitas></dbs:EnviaAmostrasResponse></soapenv:Body></soapenv:Envelope>`;
    } else if (op === "ListaProcedimentosPendentes") {
      body = `<?xml version="1.0"?><soapenv:Envelope xmlns:soapenv="x" xmlns:dbs="d"><soapenv:Body><dbs:ListaProcedimentosPendentesResponse><dbs:Pendencia><dbs:Codigo>HMG</dbs:Codigo><dbs:Motivo>Recoleta</dbs:Motivo><dbs:Descricao>Amostra insuficiente</dbs:Descricao></dbs:Pendencia></dbs:ListaProcedimentosPendentesResponse></soapenv:Body></soapenv:Envelope>`;
    } else if (op === "ConsultaLaudoPDF") {
      body = `<?xml version="1.0"?><soapenv:Envelope xmlns:soapenv="x" xmlns:dbs="d"><soapenv:Body><dbs:ConsultaLaudoPDFResponse><dbs:MimeType>application/pdf</dbs:MimeType><dbs:PDF>JVBERi0xLjQKJ2RibW9jaykK</dbs:PDF></dbs:ConsultaLaudoPDFResponse></soapenv:Body></soapenv:Envelope>`;
    } else if (op === "ConsultaRastreabilidade") {
      body = `<?xml version="1.0"?><soapenv:Envelope xmlns:soapenv="x" xmlns:dbs="d"><soapenv:Body><dbs:ConsultaRastreabilidadeResponse><dbs:Evento><dbs:Data>2026-05-08T08:00:00Z</dbs:Data><dbs:Descricao>Coletado</dbs:Descricao><dbs:Local>Unidade Sede</dbs:Local></dbs:Evento><dbs:Evento><dbs:Data>2026-05-08T12:00:00Z</dbs:Data><dbs:Descricao>Em transporte</dbs:Descricao><dbs:Local>Frota</dbs:Local></dbs:Evento></dbs:ConsultaRastreabilidadeResponse></soapenv:Body></soapenv:Envelope>`;
    } else if (op === "ConsultaEtiqueta") {
      body = `<?xml version="1.0"?><soapenv:Envelope xmlns:soapenv="x" xmlns:dbs="d"><soapenv:Body><dbs:ConsultaEtiquetaResponse><dbs:CodigoBarras>DBMOCK0001</dbs:CodigoBarras><dbs:Material>Sangue total</dbs:Material><dbs:Volume>4 mL</dbs:Volume><dbs:Transporte>Refrigerado</dbs:Transporte></dbs:ConsultaEtiquetaResponse></soapenv:Body></soapenv:Envelope>`;
    } else {
      body = `<?xml version="1.0"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body><soapenv:Fault><faultstring>operation_not_implemented_in_mock</faultstring></soapenv:Fault></soapenv:Body></soapenv:Envelope>`;
    }
    return { status: 200, body, headers: {}, durationMs: 1 };
  }
}