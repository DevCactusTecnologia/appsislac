// Runtime 2.0 — Server helpers (Fase C).
//
// Fachada de alto nível para edge functions. Encapsula os três padrões
// canônicos de criação de client:
//
//   getPlatformClient()          → service-role (control plane / admin)
//   getUserClient(authHeader)    → anon + Authorization (autenticação do usuário)
//   getTenantClient(tenant_id)   → roteamento tenant-aware via TenantContextProvider
//
// Legado: `_shared/tenantConnection.ts` permanece funcional e agora delega
// aqui internamente. Nenhuma edge function existente precisa mudar para se
// beneficiar do chokepoint — a governança é garantida pelo alias
// `_shared/runtime/createClient.ts`.

import { createClient, type SupabaseClient } from "./createClient.ts";
import { getTenantContextProvider } from "./tenantContext.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

function assertPlatformEnv() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("runtime/db: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes");
  }
}

/** Client service-role — usado pelo control-plane e por edge functions admin. */
export function getPlatformClient(): SupabaseClient {
  assertPlatformEnv();
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Client anon com header Authorization do usuário (para `auth.getUser()`). */
export function getUserClient(authHeader: string | null): SupabaseClient {
  if (!SUPABASE_URL || !ANON_KEY) {
    throw new Error("runtime/db: SUPABASE_URL / SUPABASE_ANON_KEY ausentes");
  }
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader ?? "" } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Client resolvido para o tenant informado — hoje sempre `shared`.
 * Encaminha a decisão de estratégia ao TenantContextProvider (default
 * = SupabaseRegistryProvider), preparando o terreno para `dedicated`
 * sem exigir mudança nas edge functions.
 */
export async function getTenantClient(tenant_id: string): Promise<SupabaseClient> {
  const provider = getTenantContextProvider();
  const ctx = await provider.resolve(tenant_id);
  if (ctx.strategy === "dedicated") {
    // Runtime dedicated server-side entra em Onda 2.5/3. Por ora, fail-closed.
    throw new Error(
      `runtime/db: tenant ${tenant_id} marcado como dedicated — runtime não disponível ainda`,
    );
  }
  return getPlatformClient();
}

export type { SupabaseClient };
