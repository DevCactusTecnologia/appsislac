/**
 * Catálogo dos provedores de integração suportados pelo SISLAC.
 *
 * Cada entrada aqui descreve metadados de UI (label, sigla, status visual).
 * Drivers SOAP/REST/HL7 reais são plugados em fases seguintes.
 */

export type IntegrationProvider =
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

export type ProviderStatus = "disponivel" | "em_breve";

export interface ProviderMeta {
  id: IntegrationProvider;
  label: string;
  short: string;
  description: string;
  status: ProviderStatus;
}

export const INTEGRATION_PROVIDERS: ReadonlyArray<ProviderMeta> = [
  {
    id: "HERMES_PARDINI",
    label: "Hermes Pardini",
    short: "HP",
    description: "SOAP/XML — envio, resultados, PDF, rastreabilidade",
    status: "disponivel",
  },
  {
    id: "DB_DIAGNOSTICOS",
    label: "DB Diagnósticos",
    short: "DB",
    description: "Driver futuro — contrato compartilhado",
    status: "em_breve",
  },
  {
    id: "ALVARO",
    label: "Álvaro Apoio",
    short: "AL",
    description: "Driver futuro — contrato compartilhado",
    status: "em_breve",
  },
  {
    id: "SABIN",
    label: "Sabin",
    short: "SB",
    description: "Driver futuro — contrato compartilhado",
    status: "em_breve",
  },
  {
    id: "DASA",
    label: "DASA",
    short: "DS",
    description: "Driver futuro — contrato compartilhado",
    status: "em_breve",
  },
  {
    id: "FLEURY",
    label: "Fleury",
    short: "FL",
    description: "Driver futuro — contrato compartilhado",
    status: "em_breve",
  },
  {
    id: "PIXEON",
    label: "Pixeon",
    short: "PX",
    description: "Driver futuro — contrato compartilhado",
    status: "em_breve",
  },
  {
    id: "HL7",
    label: "HL7 v2",
    short: "H7",
    description: "Padrão clínico — preparação para LIS distribuído",
    status: "em_breve",
  },
  {
    id: "FHIR",
    label: "FHIR R4",
    short: "FH",
    description: "REST clínico — preparação para interoperabilidade",
    status: "em_breve",
  },
  {
    id: "CUSTOM",
    label: "Custom",
    short: "CT",
    description: "Provedor genérico configurável",
    status: "em_breve",
  },
];