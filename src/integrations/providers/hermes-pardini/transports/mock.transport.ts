import type { SoapTransport, SoapRequestOptions, SoapResponse } from "../../../contracts/transport";
import {
  mockGetResultadoPedidoXml,
  mockVerificarRecebimentoXml,
} from "../mocks/responses";

/**
 * Transport MOCK — não faz I/O. Inspeciona o envelope para decidir qual
 * resposta XML devolver. Substituível por um HttpSoapTransport real sem
 * tocar em services/parsers/DTOs.
 */
export class MockSoapTransport implements SoapTransport {
  async request(payload: string, _opts?: SoapRequestOptions): Promise<SoapResponse> {
    const start = performance.now();
    const numeroPedido =
      extractTag(payload, "CodPedApoio") ??
      extractTag(payload, "numeroPedido") ??
      "MOCK-0000";
    let body: string;
    if (/verificarRecebimentoPedido/i.test(payload)) {
      body = mockVerificarRecebimentoXml(numeroPedido);
    } else if (/getResultadoPedido/i.test(payload)) {
      body = mockGetResultadoPedidoXml(numeroPedido);
    } else {
      body = soapFault("UnknownOperation", "Operação não suportada pelo mock");
    }
    // Latência realista (50-150ms)
    await new Promise((r) => setTimeout(r, 50 + Math.random() * 100));
    return {
      status: 200,
      body,
      headers: { "content-type": "text/xml; charset=utf-8" },
      durationMs: Math.round(performance.now() - start),
    };
  }
}

function extractTag(xml: string, tag: string): string | undefined {
  // Casamento estrito do nome (evita pegar `anoCodPedApoio` quando se busca `CodPedApoio`).
  const re = new RegExp(
    `<(?:[A-Za-z0-9_]+:)?${tag}(?=[\\s/>])[^>]*>([\\s\\S]*?)</(?:[A-Za-z0-9_]+:)?${tag}>`,
    "i",
  );
  const m = xml.match(re);
  return m ? m[1].trim() : undefined;
}

function soapFault(code: string, msg: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <soapenv:Fault>
      <faultcode>${code}</faultcode>
      <faultstring>${msg}</faultstring>
    </soapenv:Fault>
  </soapenv:Body>
</soapenv:Envelope>`;
}