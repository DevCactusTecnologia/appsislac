// ════════════════════════════════════════════════════════════════════════
// Onda 1 — Control Plane: connection orchestration server-side.
//
// Resolve `{strategy, client}` por tenant a partir do `tenant_registry`.
// Hoje TODO tenant é 'shared' e devolvemos o client compartilhado padrão
// (URL/keys do projeto Supabase). Quando habilitarmos 'dedicated' na
// Onda 4, este é o ÚNICO ponto que precisa rotear para um pool diferente.
//
// Regras invioláveis:
//   - Nunca hardcodar URL/credentials em edge functions: usar este helper.
//   - 'dedicated' ainda lança erro até que o pool real exista (Onda 4).
//   - super_admin não tem tenant_id operacional — usa client global.
// ════════════════════════════════════════════════════════════════════════

import { createClient, type SupabaseClient } from "../_shared/runtime/createClient.ts";

export type TenantStrategy = "shared" | "dedicated";

export interface TenantConnection {
  tenant_id: string;
  strategy: TenantStrategy;
  client: SupabaseClient;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

/** Client de plataforma (service-role) — usado pelo control-plane. */
export function getPlatformClient(): SupabaseClient {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("tenantConnection: SUPABASE_URL / SERVICE_ROLE_KEY ausentes");
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Resolve a conexão tenant-aware. Hoje sempre devolve o client compartilhado
 * (service-role). Quando `dedicated` for ativado, roteia para o pool do banco
 * dedicado do tenant via `db_secret_ref`.
 */
export async function resolveTenantConnection(tenant_id: string): Promise<TenantConnection> {
  const platform = getPlatformClient();
  const { data, error } = await platform
    .from("tenant_registry")
    .select("database_strategy, runtime_mode, db_provider, db_secret_ref, runtime_status")
    .eq("tenant_id", tenant_id)
    .maybeSingle();

  if (error) throw new Error(`tenantConnection: lookup falhou — ${error.message}`);

  // Onda 2: `runtime_mode` é a fonte de verdade. `database_strategy`
  // permanece como fallback legado.
  const isIsolated = data?.runtime_mode === 'isolated_db' || data?.database_strategy === 'dedicated';
  const strategy: TenantStrategy = isIsolated ? 'dedicated' : 'shared';

  if (data?.runtime_status === "suspended") {
    throw new Error(`tenantConnection: tenant ${tenant_id} suspenso`);
  }

  if (strategy === "shared") {
    return { tenant_id, strategy, client: platform };
  }

  // 'dedicated' (isolated_db) — runtime real virá na Onda 2.5/3.
  const secretRef = data?.db_secret_ref ?? null;
  if (!secretRef) {
    throw new Error(
      `tenantConnection: tenant ${tenant_id} isolated_db sem db_secret_ref — provision incompleto`,
    );
  }
  throw new Error(
    `tenantConnection: runtime 'isolated_db' (provider=${data?.db_provider ?? '?'}) ainda em dry-run. tenant=${tenant_id}`,
  );
}

/** Açúcar para edge functions já autenticadas com JWT do tenant. */
export async function resolveTenantConnectionFromJWT(authHeader: string | null): Promise<TenantConnection> {
  if (!authHeader) throw new Error("tenantConnection: Authorization ausente");
  const platform = getPlatformClient();
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: userData, error: userErr } = await platform.auth.getUser(token);
  if (userErr || !userData.user) throw new Error("tenantConnection: JWT inválido");

  const { data: profile } = await platform
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  const tid = profile?.tenant_id as string | undefined;
  if (!tid) throw new Error("tenantConnection: usuário sem tenant_id");

  return await resolveTenantConnection(tid);
}