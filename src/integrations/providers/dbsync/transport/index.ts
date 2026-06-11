import type {
  SoapTransport,
  TransportFactoryInput,
} from "../../../contracts/transport";
import { MockDBSyncTransport } from "./mock.transport";
import { HttpDBSyncTransport } from "./http.transport";

/**
 * Factory de transporte DBSync.
 *
 * Hoje só `MOCK` é executável. Para HOMOLOG/PROD, criar
 * `HttpDBSyncTransport` em rodada futura — sem alterar parsers,
 * envelopes, status adapter ou capabilities.
 */
export function createDBSyncTransport(input: TransportFactoryInput): SoapTransport {
  switch (input.mode) {
    case "MOCK":
      return new MockDBSyncTransport();
    case "HOMOLOG":
    case "PROD":
      return new HttpDBSyncTransport({
        endpoint: input.endpoint ?? "",
        timeoutMs: input.timeoutMs,
      });
    default:
      return new MockDBSyncTransport();
  }
}