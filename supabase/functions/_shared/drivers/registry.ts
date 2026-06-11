// ProviderDriverRegistry — resolução central de drivers.
// Drivers se auto-registram importando este módulo via _shared/drivers/index.ts.

import type { IntegrationProviderId, ProviderDriver } from "./types.ts";

const _drivers = new Map<IntegrationProviderId, ProviderDriver>();

export const ProviderDriverRegistry = {
  register(driver: ProviderDriver): void {
    _drivers.set(driver.provider, driver);
  },
  resolve(provider: string): ProviderDriver | null {
    return _drivers.get(provider as IntegrationProviderId) ?? null;
  },
  list(): ReadonlyArray<IntegrationProviderId> {
    return Array.from(_drivers.keys());
  },
  has(provider: string): boolean {
    return _drivers.has(provider as IntegrationProviderId);
  },
};
