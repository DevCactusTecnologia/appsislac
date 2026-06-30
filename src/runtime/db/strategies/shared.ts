/**
 * Runtime 2.0 — SharedStrategy.
 *
 * Estratégia Shared Database: todos os tenants compartilham o mesmo
 * projeto Supabase do `.env`. Reusa o singleton gerado em
 * `src/integrations/supabase/client.ts` como transport — este é o
 * ÚNICO arquivo do projeto autorizado a importá-lo.
 */

import { __getSharedTransport } from "../resolver";
import type { RuntimeClient, RuntimeStrategyAdapter, TenantRuntimeContext } from "../types";

export const sharedStrategy: RuntimeStrategyAdapter = {
  kind: "shared",
  createClient(_ctx: TenantRuntimeContext): RuntimeClient {
    return __getSharedTransport();
  },
  dispose() {
    // Shared transport é global e gerenciado pelo lib do Supabase.
    // Não há recursos próprios para liberar por tenant.
  },
};
