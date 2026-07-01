// SISLAC Database Migration Core — Server helpers.
//
// Fachada mínima para edge functions. Três padrões canônicos:
//
//   getPlatformClient()          → service-role (control plane / admin)
//   getUserClient(authHeader)    → anon + Authorization (JWT do usuário)
//   getTenantClient(tenant_id)   → resolve shared OU dedicated (service-role)
//   getUserTenantClient(auth, t) → dedicated user-scoped (JWT preservado)
//
// Dedicated: usa secret `SB_SERVICE_ROLE_<project_ref>` cadastrado por tenant.
// Nunca cai silenciosamente para shared quando o tenant está dedicated: lança
// MigrationBlockedError.

import { createClient, type SupabaseClient } from "./createClient.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

function assertPlatformEnv() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("runtime/db: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes");
  }
}

/** Erro estruturado para bloqueios do runtime dedicado. */
export class MigrationBlockedError extends Error {
  constructor(
    public readonly tenant_id: string,
    public readonly reason: string,
    public readonly code:
      | "DEDICATED_URL_MISSING"
      | "DEDICATED_SERVICE_KEY_MISSING"
      | "DEDICATED_CLIENT_FAILED"
      | "TENANT_SUSPENDED",
  ) {
    super(`runtime/db: tenant ${tenant_id} bloqueado — ${reason} (${code})`);
    this.name = "MigrationBlockedError";
  }
}

/** Client service-role — control-plane e edge functions admin. */
export function getPlatformClient(): SupabaseClient {
  assertPlatformEnv();
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Client anon com Authorization do usuário (para `auth.getUser()`). */
export function getUserClient(authHeader: string | null): SupabaseClient {
  if (!SUPABASE_URL || !ANON_KEY) {
    throw new Error("runtime/db: SUPABASE_URL / SUPABASE_ANON_KEY ausentes");
  }
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader ?? "" } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Resolve tenant_id do usuário autenticado via `profiles` (bypassa RLS). */
export async function resolveUserTenantId(userId: string): Promise<string | null> {
  const { data, error } = await getPlatformClient()
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return null;
  return (data as { tenant_id?: string } | null)?.tenant_id ?? null;
}

// ── Resolução de tenant (leitura direta do registry) ────────────────
interface TenantResolution {
  strategy: "shared" | "dedicated";
  db_project_url: string | null;
  db_secret_ref: string | null;
  db_anon_key_ref: string | null;
}

async function resolveTenant(tenant_id: string): Promise<TenantResolution> {
  const { data, error } = await getPlatformClient()
    .from("tenant_registry")
    .select("database_strategy, runtime_mode, runtime_status, db_project_url, db_secret_ref, db_anon_key_ref")
    .eq("tenant_id", tenant_id)
    .maybeSingle();
  if (error) throw new Error(`resolveTenant: ${error.message}`);
  if (data?.runtime_status === "suspended") {
    throw new MigrationBlockedError(tenant_id, "tenant suspenso", "TENANT_SUSPENDED");
  }
  const isolated = data?.runtime_mode === "isolated_db" || data?.database_strategy === "dedicated";
  return {
    strategy: isolated ? "dedicated" : "shared",
    db_project_url: (data as { db_project_url?: string } | null)?.db_project_url ?? null,
    db_secret_ref: (data as { db_secret_ref?: string } | null)?.db_secret_ref ?? null,
    db_anon_key_ref: (data as { db_anon_key_ref?: string } | null)?.db_anon_key_ref ?? null,
  };
}

// ── Dedicated cache ─────────────────────────────────────────────────
interface DedicatedEntry {
  client: SupabaseClient;
  last_used_at: number;
}
const DEDICATED_CACHE = new Map<string, DedicatedEntry>();
const DEDICATED_IDLE_MS = 5 * 60 * 1000;

function pruneCache() {
  const now = Date.now();
  for (const [k, v] of DEDICATED_CACHE) {
    if (now - v.last_used_at > DEDICATED_IDLE_MS) DEDICATED_CACHE.delete(k);
  }
}

/** Client resolvido para o tenant — shared (service-role) OU dedicated real. */
export async function getTenantClient(tenant_id: string): Promise<SupabaseClient> {
  const ctx = await resolveTenant(tenant_id);
  if (ctx.strategy !== "dedicated") return getPlatformClient();

  pruneCache();
  const cached = DEDICATED_CACHE.get(tenant_id);
  if (cached) { cached.last_used_at = Date.now(); return cached.client; }

  if (!ctx.db_project_url) throw new MigrationBlockedError(tenant_id, "db_project_url ausente", "DEDICATED_URL_MISSING");
  if (!ctx.db_secret_ref) throw new MigrationBlockedError(tenant_id, "db_secret_ref ausente", "DEDICATED_SERVICE_KEY_MISSING");
  const serviceKey = Deno.env.get(ctx.db_secret_ref);
  if (!serviceKey) {
    throw new MigrationBlockedError(tenant_id, `secret ${ctx.db_secret_ref} não cadastrado`, "DEDICATED_SERVICE_KEY_MISSING");
  }
  let client: SupabaseClient;
  try {
    client = createClient(ctx.db_project_url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "x-runtime-strategy": "dedicated" } },
    });
  } catch (e) {
    throw new MigrationBlockedError(tenant_id, e instanceof Error ? e.message : String(e), "DEDICATED_CLIENT_FAILED");
  }
  DEDICATED_CACHE.set(tenant_id, { client, last_used_at: Date.now() });
  return client;
}

/** Client user-scoped tenant-aware: preserva JWT e roteia para dedicated se aplicável. */
export async function getUserTenantClient(
  authHeader: string | null,
  tenant_id: string,
): Promise<SupabaseClient> {
  const ctx = await resolveTenant(tenant_id);
  if (ctx.strategy !== "dedicated") return getUserClient(authHeader);

  if (!ctx.db_project_url) throw new MigrationBlockedError(tenant_id, "db_project_url ausente", "DEDICATED_URL_MISSING");
  if (!ctx.db_anon_key_ref) throw new MigrationBlockedError(tenant_id, "db_anon_key_ref ausente", "DEDICATED_SERVICE_KEY_MISSING");
  const anonKey = Deno.env.get(ctx.db_anon_key_ref);
  if (!anonKey) {
    throw new MigrationBlockedError(tenant_id, `secret ${ctx.db_anon_key_ref} não cadastrado`, "DEDICATED_SERVICE_KEY_MISSING");
  }
  return createClient(ctx.db_project_url, anonKey, {
    global: { headers: { Authorization: authHeader ?? "", "x-runtime-strategy": "dedicated" } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type { SupabaseClient };
