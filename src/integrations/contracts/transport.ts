/**
 * Contrato genérico de transporte (SOAP/HTTP) compartilhado por todos os
 * providers de integração laboratorial.
 *
 * Trocar para a camada real de homologação Hermes Pardini deve exigir
 * APENAS uma nova implementação de SoapTransport — nunca alterar parsers,
 * DTOs, services ou edge functions.
 */

export interface SoapTransport {
  /**
   * Envia um envelope SOAP serializado (já assinado/montado pelo service)
   * e devolve o XML cru de resposta.
   */
  request(payload: string, opts?: SoapRequestOptions): Promise<SoapResponse>;
}

export interface SoapRequestOptions {
  soapAction?: string;
  endpoint?: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export interface SoapResponse {
  status: number;
  body: string;
  headers: Record<string, string>;
  durationMs: number;
}

export type TransportMode = "MOCK" | "HOMOLOG" | "PROD";

export interface TransportFactoryInput {
  mode: TransportMode;
  endpoint?: string;
  timeoutMs?: number;
}