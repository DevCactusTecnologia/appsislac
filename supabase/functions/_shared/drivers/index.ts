// Boot do registry de drivers. Importar este arquivo registra
// TODOS os drivers disponíveis no servidor.

import { ProviderDriverRegistry } from "./registry.ts";
import { HermesDriver } from "./hermes-pardini/driver.ts";
import { DBSyncDriver } from "./dbsync/driver.ts";

ProviderDriverRegistry.register(HermesDriver);
ProviderDriverRegistry.register(DBSyncDriver);

export { ProviderDriverRegistry } from "./registry.ts";
export type {
  ProviderDriver,
  DriverContext,
  DriverOutcome,
  DeathReason,
  ServerCapabilities,
  IntegrationProviderId,
  JobKind,
} from "./types.ts";
export { supportsKind } from "./types.ts";
export { runPipeline, failJob, rescheduleJob } from "./pipeline.ts";
export { loadIntegrationCredentials, invalidateCredentialsCache } from "./credentials.ts";
export { sendToDlq } from "./dlq.ts";
export { circuitEnabled, circuitShouldAllow, circuitRecordSuccess, circuitRecordFailure } from "./circuit.ts";
export { healthRecord } from "./health.ts";
