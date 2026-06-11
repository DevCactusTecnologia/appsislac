// Canonical Domain Models — provider-agnostic, fortemente tipados.
// Drivers normalizam payloads (SOAP/REST/HL7/FHIR) para estes contratos.
// Versionados via CANONICAL_SCHEMA_VERSION.

export const CANONICAL_SCHEMA_VERSION = "1.0.0";

export type CanonicalKind =
  | "ExamOrder"
  | "ExamResult"
  | "PdfResult"
  | "PendingResult"
  | "TraceResult"
  | "LabelResult"
  | "ProviderError";

export interface CanonicalEnvelope<T> {
  schemaVersion: string;
  kind: CanonicalKind;
  provider: string;
  generatedAt: string;
  data: T;
}

// ---------- Order ----------
export interface CanonicalPatientRef {
  externalId?: string;
  documentMasked?: string; // ex.: [CPF] após redaction
}
export interface CanonicalExamItem {
  providerExamCode: string;
  internalExamId?: string | number;
  material?: string;
  observations?: string;
}
export interface CanonicalExamOrder {
  externalProtocol: string;
  patient: CanonicalPatientRef;
  items: CanonicalExamItem[];
  urgent: boolean;
  notes?: string;
}

// ---------- Result ----------
export type CanonicalResultStatus =
  | "PENDING" | "PARTIAL" | "FINALIZED" | "CANCELED" | "ERROR";

export type CanonicalAbnormalFlag = "N" | "L" | "H" | "LL" | "HH" | "A";

export interface CanonicalAnalyte {
  code: string;
  name: string;
  value?: string | number | null;
  unit?: string;
  referenceRange?: string;
  flag?: CanonicalAbnormalFlag;
  method?: string;
  notes?: string;
}
export interface CanonicalExamResultItem {
  providerExamCode: string;
  examName?: string;
  status: CanonicalResultStatus;
  collectedAt?: string;
  releasedAt?: string;
  analytes: CanonicalAnalyte[];
}
export interface CanonicalExamResult {
  externalProtocol: string;
  status: CanonicalResultStatus;
  releasedAt?: string;
  exams: CanonicalExamResultItem[];
}

// ---------- PDF ----------
export interface CanonicalPdfResult {
  externalProtocol: string;
  filename: string;
  mime: string;
  sizeBytes: number;
  storagePath?: string;
  url?: string;
  sha256?: string;
}

// ---------- Pending ----------
export type CanonicalPendingSeverity = "INFO" | "WARN" | "ERROR";
export interface CanonicalPendingItem {
  providerExamCode?: string;
  reason: string;
  severity: CanonicalPendingSeverity;
  expectedAction?: string;
  raisedAt?: string;
}
export interface CanonicalPendingResult {
  externalProtocol: string;
  pendings: CanonicalPendingItem[];
}

// ---------- Trace ----------
export interface CanonicalTraceEvent {
  step: string;
  timestamp: string;
  actor?: string;
  notes?: string;
}
export interface CanonicalTraceResult {
  externalProtocol: string;
  events: CanonicalTraceEvent[];
}

// ---------- Label ----------
export interface CanonicalLabelResult {
  externalProtocol: string;
  format: "ZPL" | "PNG" | "PDF" | "RAW";
  payload: string; // base64 ou texto ZPL
  widthMm?: number;
  heightMm?: number;
}

// ---------- Error ----------
export type CanonicalErrorCategory =
  | "TRANSPORT" | "AUTH" | "VALIDATION" | "CONTRACT" | "BUSINESS";
export interface CanonicalProviderError {
  code: string;
  category: CanonicalErrorCategory;
  message: string;
  retriable: boolean;
  raw?: string;
}

export function wrapCanonical<T>(
  kind: CanonicalKind,
  provider: string,
  data: T,
): CanonicalEnvelope<T> {
  return {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind,
    provider,
    generatedAt: new Date().toISOString(),
    data,
  };
}