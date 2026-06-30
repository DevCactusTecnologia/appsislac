/**
 * Runtime 2.0 — DedicatedStrategy (stub controlado).
 *
 * Placeholder para o futuro cenário Database-per-Tenant. Não cria
 * conexões — lança `RuntimeError` tipado para que o chamador
 * receba um erro explícito (sem fallback silencioso ao shared).
 *
 * Quando o pool real existir, este arquivo é o ÚNICO ponto que muda.
 */

import { RuntimeError, type RuntimeClient, type RuntimeStrategyAdapter, type TenantRuntimeContext } from "../types";

export const dedicatedStrategy: RuntimeStrategyAdapter = {
  kind: "dedicated",
  createClient(ctx: TenantRuntimeContext): RuntimeClient {
    throw new RuntimeError(
      `Dedicated runtime ainda não implementado (tenant=${ctx.tenant_id}).`,
      "RUNTIME_DEDICATED_NOT_IMPLEMENTED",
    );
  },
  dispose() {
    /* noop */
  },
};
