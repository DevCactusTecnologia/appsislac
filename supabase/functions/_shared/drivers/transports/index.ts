// Camada de transports server-side.
// SOAP/REST atuais ficam nos providers (cada driver instancia o seu).
// HL7/FHIR: stubs tipados para preparação. NÃO executam I/O.

export interface SoapResponse {
  status: number;
  body: string;
  headers: Record<string, string>;
  durationMs: number;
}
export interface SoapTransport {
  request(payload: string, opts?: { soapAction?: string; endpoint?: string; timeoutMs?: number }): Promise<SoapResponse>;
}

export interface RestTransport {
  request(input: RequestInfo, init?: RequestInit): Promise<Response>;
}
export const FetchRestTransport: RestTransport = {
  request: (input, init) => fetch(input, init),
};

export interface Hl7Transport {
  send(message: string): Promise<{ ack: string; status: number }>;
}
export const Hl7TransportStub: Hl7Transport = {
  send: () => { throw new Error("hl7_transport_not_implemented"); },
};

export interface FhirTransport {
  read(resource: string, id: string): Promise<unknown>;
  create(resource: string, body: unknown): Promise<unknown>;
}
export const FhirTransportStub: FhirTransport = {
  read: () => { throw new Error("fhir_transport_not_implemented"); },
  create: () => { throw new Error("fhir_transport_not_implemented"); },
};
