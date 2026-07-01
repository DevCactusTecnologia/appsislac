// Runtime 2.0 — TenantContextProvider (Fase C).
//
// Abstração recomendada durante a Gate Review da Fase B: desacopla o
// Runtime da ORIGEM dos metadados de tenant. Hoje a única implementação
// é `SupabaseRegistryProvider` (lê `tenant_registry` no projeto shared),
// mas o contrato permite futuras origens sem alterar edge functions:
//
//   - Cache Redis / KV (leitura sub-ms)
//   - Config estática injetada por CI/CD (multi-região)
//   - Serviço externo de service discovery
//
// A abstração é intencionalmente pequena: apenas `resolve(tenant_id)`.
// A criação real do client permanece no `runtime/db.ts` (fábrica).

import { createClient } from "./createClient.ts";

export type TenantStrategy = "shared" | "dedicated";

export interface ResolvedTenantContext {
  tenant_id: string;
  strategy: TenantStrategy;
  runtime_status: "active" | "suspended" | "provisioning" | string | null;
  db_provider: string | null;
  db_secret_ref: string | null;
}

export interface TenantContextProvider {
  readonly name: string;
  resolve(tenant_id: string): Promise<ResolvedTenantContext>;
  /** Hook opcional para invalidação de cache futuro. */
  invalidate?(tenant_id: string): Promise<void> | void;
}

// ── Default: SupabaseRegistryProvider ────────────────────────────────
class SupabaseRegistryProvider implements TenantContextProvider {
  readonly name = "supabase-registry";
  private client = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  async resolve(tenant_id: string): Promise<ResolvedTenantContext> {
    const { data, error } = await this.client
      .from("tenant_registry")
      .select("database_strategy, runtime_mode, runtime_status, db_provider, db_secret_ref")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    if (error) {
      throw new Error(`TenantContextProvider(${this.name}): lookup falhou — ${error.message}`);
    }
    if (data?.runtime_status === "suspended") {
      throw new Error(`TenantContextProvider(${this.name}): tenant ${tenant_id} suspenso`);
    }

    const isolated = data?.runtime_mode === "isolated_db" || data?.database_strategy === "dedicated";
    return {
      tenant_id,
      strategy: isolated ? "dedicated" : "shared",
      runtime_status: (data?.runtime_status as string | null) ?? "active",
      db_provider: (data?.db_provider as string | null) ?? null,
      db_secret_ref: (data?.db_secret_ref as string | null) ?? null,
    };
  }
}

let _provider: TenantContextProvider | null = null;

export function getTenantContextProvider(): TenantContextProvider {
  if (!_provider) _provider = new SupabaseRegistryProvider();
  return _provider;
}

/** Injeta um provider alternativo (testes, futura evolução multi-fonte). */
export function setTenantContextProvider(p: TenantContextProvider): void {
  _provider = p;
}
