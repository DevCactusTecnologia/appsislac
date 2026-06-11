// Contratos formais da engine de drivers de integração laboratorial.
// Toda integração nova DEVE implementar `ProviderDriver`.

import type { AdminClient } from "../integrationLog.ts";

export type IntegrationProviderId =
  | "HERMES_PARDINI"
  | "DB_DIAGNOSTICOS"
  | "ALVARO"
  | "SABIN"
  | "DASA"
  | "FLEURY"
  | "PIXEON"
  | "HL7"
  | "FHIR"
  | "CUSTOM";

export type JobKind =
  | "SEND_ORDER"
  | "POLL_RESULT"
  | "FETCH_PDF"
  | "FETCH_PENDING"
  | "FETCH_TRACE"
  | "FETCH_LABEL"
  | "CANCEL_EXAM"
  | "CANCEL_SAMPLE"
  | "SYNC_EXAM_MAP";

export interface ServerCapabilities {
  send_order: boolean;
  polling: boolean;
  fetch_pdf: boolean;
  fetch_pending: boolean;
  fetch_trace: boolean;
  fetch_label: boolean;
  cancel_exam: boolean;
  cancel_sample: boolean;
  webhook: boolean;
}

export function supportsKind(caps: ServerCapabilities, kind: JobKind): boolean {
  switch (kind) {
    case "SEND_ORDER": return caps.send_order;
    case "POLL_RESULT": return caps.polling;
    case "FETCH_PDF": return caps.fetch_pdf;
    case "FETCH_PENDING": return caps.fetch_pending;
    case "FETCH_TRACE": return caps.fetch_trace;
    case "FETCH_LABEL": return caps.fetch_label;
    case "CANCEL_EXAM": return caps.cancel_exam;
    case "CANCEL_SAMPLE": return caps.cancel_sample;
    case "SYNC_EXAM_MAP": return true;
  }
}

export interface DriverContext {
  admin: AdminClient;
  job: Record<string, any>;
  integration: Record<string, any>;
  tenant_id: string;
  integration_id: string;
  payload: Record<string, unknown>;
  externalProtocol: string;
  /** correlation_id (uuid) propagado em logs/requests do mesmo job */
  correlationId: string;
  /** Credenciais já decifradas (vazias se MOCK ou sem cred). */
  credentials: { username: string; password: string; keyVersion: number };
}

export type DriverOutcome =
  | { kind: "completed"; result: Record<string, unknown>; httpStatus?: number }
  | { kind: "reschedule"; reason: string }
  | { kind: "fail"; reason: string }
  | { kind: "dead"; reason: DeathReason; message: string };

/** Motivos catalogados para descarte permanente (DLQ). */
export type DeathReason =
  | "SCHEMA_VIOLATION"
  | "PARSE_ERROR"
  | "CONTRACT_MISMATCH"
  | "AUTH_IRRECOVERABLE"
  | "CAPABILITY_NOT_SUPPORTED"
  | "ENVELOPE_INCONSISTENT"
  | "MALFORMED_RESPONSE"
  | "PROVIDER_NOT_SUPPORTED";

export interface ProviderDriver {
  readonly provider: IntegrationProviderId;
  readonly capabilities: ServerCapabilities;
  /** Orquestra o passo do job (SEND_ORDER, POLL_RESULT, ...). */
  dispatch(ctx: DriverContext): Promise<DriverOutcome>;
}
