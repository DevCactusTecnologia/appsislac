/**
 * Barrel do provider DBSync (DB Diagnósticos).
 *
 * IMPORTANTE: importar este arquivo registra as capabilities
 * do DBSync no registry global. Isso é seguro mesmo se o provider
 * estiver desativado por feature flag — registrar capacidades
 * NÃO ativa polling, jobs, dispatch ou qualquer I/O.
 */

import { registerCapabilities } from "../../contracts/capabilities";
import { DBSYNC_CAPABILITIES } from "./capabilities";

registerCapabilities("DB_DIAGNOSTICOS", DBSYNC_CAPABILITIES);

export { DBSYNC_CAPABILITIES } from "./capabilities";
export { DBSYNC_METHODS } from "./wsdl/methods";
export type {
  DBSyncMethod,
  DBSyncEnvironment,
  DBSyncProviderConfig,
  DBSyncCredentials,
} from "./wsdl/methods";
export {
  envelopeRecebeAtendimento,
  envelopeConsultaStatus,
  envelopeEnviaAmostras,
  envelopeListaPendentes,
  envelopeConsultaLaudoPdf,
  envelopeConsultaRastreabilidade,
  envelopeConsultaEtiqueta,
} from "./xml/envelopes";
export type {
  RecebeAtendimentoInput,
  RecebeAtendimentoExame,
  ConsultaStatusInput,
  EnviaAmostrasInput,
  ListaPendentesInput,
  ConsultaLaudoPdfInput,
  ConsultaRastreabilidadeInput,
  ConsultaEtiquetaInput,
  DBSyncAuth,
} from "./xml/envelopes";
export {
  parseRecebeAtendimento,
  parseConsultaStatus,
  parseEnviaAmostras,
  parseListaPendentes,
  parseConsultaLaudoPdf,
  parseConsultaRastreabilidade,
  parseConsultaEtiqueta,
} from "./parser";
export type {
  RecebeAtendimentoResult,
  ConsultaStatusResult,
  ConsultaStatusExame,
  EnviaAmostrasResult,
  ListaPendentesResult,
  DBSyncPendencia,
  ConsultaLaudoPdfResult,
  ConsultaRastreabilidadeResult,
  DBSyncEventoLogistico,
  ConsultaEtiquetaResult,
  ParseResult,
} from "./parser";
export { mapDBSyncStatus } from "./status/adapter";
export type { DBSyncMappedStatus } from "./status/adapter";
export type { ExternalLabelData } from "./labels/types";
export { renderExternalLabelEpl } from "./labels/render";
export { createDBSyncTransport } from "./transport";