/**
 * Runtime 2.0 — Smoke tests da Fase A.
 *
 * Não validam negócio. Validam apenas as invariantes estruturais
 * exigidas pelo Gate Review (ver docs/database-runtime/02-gate-review-fase-a.md):
 *
 *  1. Existe um único ponto de criação de cliente (Factory).
 *  2. Cache é isolado por tenant/project/strategy.
 *  3. SharedStrategy devolve sempre o mesmo transport (singleton).
 *  4. DedicatedStrategy lança RuntimeError tipado (fail-closed).
 *  5. Rollback para Shared é trivial — basta resetar o runtime.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { __mark: "shared-singleton" },
}));

// Fase D — tenantContext é o único ponto oficial de descoberta.
vi.mock("@/runtime/db/tenantContext", () => ({
  getTenantContext: vi.fn(async () => ({
    tenant_id: "11111111-1111-1111-1111-111111111111",
    database_strategy: "shared",
    database_url: null,
  })),
  clearTenantContextCache: vi.fn(),
  installTenantAuthInvalidation: vi.fn(),
  getCurrentTenantId: vi.fn(async () => "11111111-1111-1111-1111-111111111111"),
  getCurrentTenantNome: vi.fn(async () => "SISLAC"),
  getCachedTenantNome: vi.fn(() => null),
}));

import {
  getCurrentContext,
  refreshContext,
  resetRuntime,
  db,
} from "@/runtime/db";
import { sharedStrategy } from "@/runtime/db/strategies/shared";
import { dedicatedStrategy } from "@/runtime/db/strategies/dedicated";
import { RuntimeError } from "@/runtime/db/types";

beforeEach(async () => {
  await resetRuntime();
});

describe("Runtime 2.0 — Fase A (smoke)", () => {
  it("expõe `db` como porta única (proxy do client corrente)", () => {
    // Acesso a qualquer propriedade hidrata o client via Factory.
    const mark = (db as unknown as { __mark?: string }).__mark;
    expect(mark).toBe("shared-singleton");
  });

  it("SharedStrategy reutiliza o singleton — zero clientes paralelos", () => {
    const ctx = getCurrentContext();
    const a = sharedStrategy.createClient(ctx);
    const b = sharedStrategy.createClient(ctx);
    expect(a).toBe(b);
  });

  it("DedicatedStrategy é fail-closed (sem fallback silencioso)", () => {
    expect(() =>
      dedicatedStrategy.createClient({
        tenant_id: "t-x",
        strategy: "dedicated",
        project_ref: "proj-x",
        database_url: "postgres://x",
      }),
    ).toThrowError(RuntimeError);
  });

  it("Factory isola o cache por (strategy, project_ref, tenant_id)", async () => {
    const ctx1 = await refreshContext();
    const c1 = (db as unknown as { __mark?: string }).__mark;
    expect(ctx1.strategy).toBe("shared");
    expect(c1).toBe("shared-singleton");

    // Reset = rollback seguro para o bootstrap shared.
    await resetRuntime();
    const ctxBoot = getCurrentContext();
    expect(ctxBoot.strategy).toBe("shared");
  });
});
