import type { SoapTransport } from "../../../contracts/transport";
import type {
  ParsedResponse,
  VerificarRecebimentoInput,
  VerificarRecebimentoOutput,
} from "../dto";
import { envelopeVerificarRecebimentoPedido, SOAP_ACTIONS } from "../xml/envelopes";
import { parseVerificarRecebimento } from "../parsers";

export async function verificarRecebimentoPedido(
  transport: SoapTransport,
  input: VerificarRecebimentoInput,
): Promise<{
  envelope: string;
  rawResponse: string;
  durationMs: number;
  statusCode: number;
  parsed: ParsedResponse<VerificarRecebimentoOutput>;
}> {
  const envelope = envelopeVerificarRecebimentoPedido(input);
  const resp = await transport.request(envelope, {
    soapAction: SOAP_ACTIONS.verificarRecebimentoPedido,
  });
  const parsed = parseVerificarRecebimento(resp.body);
  return {
    envelope,
    rawResponse: resp.body,
    durationMs: resp.durationMs,
    statusCode: resp.status,
    parsed,
  };
}