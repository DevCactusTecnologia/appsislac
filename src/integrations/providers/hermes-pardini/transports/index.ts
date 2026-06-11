import type { SoapTransport, TransportFactoryInput } from "../../../contracts/transport";
import { MockSoapTransport } from "./mock.transport";

/**
 * Factory de transporte. Hoje só `MOCK` está habilitado.
 * Para Fase 3 (homologação real), basta adicionar `HttpSoapTransport`
 * sem alterar services/parsers/edge functions.
 */
export function createHermesTransport(input: TransportFactoryInput): SoapTransport {
  switch (input.mode) {
    case "MOCK":
      return new MockSoapTransport();
    case "HOMOLOG":
    case "PROD":
      // Reservado para Fase 3.
      return new MockSoapTransport();
    default:
      return new MockSoapTransport();
  }
}