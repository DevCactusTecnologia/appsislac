// Runtime 2.0 — Server helpers (Fase C + Dedicated Runtime v1.0 / Slice 1).
//
// Fachada de alto nível para edge functions. Encapsula os três padrões
// canônicos de criação de client:
//
//   getPlatformClient()          → service-role (control plane / admin)
//   getUserClient(authHeader)    → anon + Authorization (autenticação do usuário)
//   getTenantClient(tenant_id)   → roteamento tenant-aware (shared OU dedicated)
//
// Dedicated: usa service-role do projeto dedicado (secret
// `SB_SERVICE_ROLE_<project_ref>`, cadastrado manualmente por tenant no
// provisionamento — D2). Cache por tenant. Nunca faz fallback silencioso
// para shared quando o tenant está marcado como dedicated: lança
// MigrationBlockedError (Fase 8).

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

/** Erro estruturado para bloqueios do runtime dedicado (Fase 8). */
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

// ── Dedicated cache ─────────────────────────────────────────────────
interface DedicatedEntry {
  client: SupabaseClient;
  created_at: number;
  last_used_at: number;
}
const DEDICATED_CACHE = new Map<string, DedicatedEntry>();
const DEDICATED_IDLE_MS = 5 * 60 * 1000; // 5min

function pruneDedicatedCache() {
  const now = Date.now();
  for (const [k, v] of DEDICATED_CACHE) {
    if (now - v.last_used_at > DEDICATED_IDLE_MS) DEDICATED_CACHE.delete(k);
  }
}

function buildDedicatedClient(url: string, serviceKey: string): SupabaseClient {
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-runtime-strategy": "dedicated" } },
  });
}

/**
 * Client resolvido para o tenant — shared OU dedicated real.
 * Fase 8: sem fallback silencioso. Se dedicated não está configurado, lança.
 */
export async function getTenantClient(tenant_id: string): Promise<SupabaseClient> {
  const provider = getTenantContextProvider();
  const ctx = await provider.resolve(tenant_id);

  if (ctx.strategy !== "dedicated") {
    return getPlatformClient();
  }

  pruneDedicatedCache();
  const cached = DEDICATED_CACHE.get(tenant_id);
  if (cached) {
    cached.last_used_at = Date.now();
    return cached.client;
  }

  // Descobre URL + secret ref via registry (control-plane).
  const platform = getPlatformClient();
  const { data: reg, error } = await platform
    .from("tenant_registry")
    .select("db_project_url, db_secret_ref")
    .eq("tenant_id", tenant_id)
    .maybeSingle();
  if (error) {
    throw new MigrationBlockedError(tenant_id, `registry lookup: ${error.message}`, "DEDICATED_CLIENT_FAILED");
  }
  const url = (reg as { db_project_url?: string } | null)?.db_project_url;
  const secretRef = (reg as { db_secret_ref?: string } | null)?.db_secret_ref;
  if (!url) throw new MigrationBlockedError(tenant_id, "db_project_url ausente", "DEDICATED_URL_MISSING");
  if (!secretRef) throw new MigrationBlockedError(tenant_id, "db_secret_ref ausente", "DEDICATED_SERVICE_KEY_MISSING");
  const serviceKey = Deno.env.get(secretRef);
  if (!serviceKey) {
    throw new MigrationBlockedError(
      tenant_id,
      `secret ${secretRef} não cadastrado no ambiente`,
      "DEDICATED_SERVICE_KEY_MISSING",
    );
  }

  let client: SupabaseClient;
  try {
    client = buildDedicatedClient(url, serviceKey);
  } catch (e) {
    throw new MigrationBlockedError(
      tenant_id,
      e instanceof Error ? e.message : String(e),
      "DEDICATED_CLIENT_FAILED",
    );
  }

  const entry: DedicatedEntry = { client, created_at: Date.now(), last_used_at: Date.now() };
  DEDICATED_CACHE.set(tenant_id, entry);
  return client;
}

/** Health probe do dedicated (usado por smoke-test e monitor). */
export async function dedicatedHealth(tenant_id: string): Promise<{ ok: boolean; latency_ms: number; error?: string }> {
  const t0 = Date.now();
  try {
    const c = await getTenantClient(tenant_id);
    const { error } = await c.from("_sislac_schema_health").select("*").limit(1);
    if (error && !/does not exist/i.test(error.message)) {
      return { ok: false, latency_ms: Date.now() - t0, error: error.message };
    }
    return { ok: true, latency_ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, latency_ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Invalida cache dedicated (usado após flip/rollback). */
export function invalidateDedicatedCache(tenant_id?: string): void {
  if (tenant_id) DEDICATED_CACHE.delete(tenant_id);
  else DEDICATED_CACHE.clear();
}

export type { SupabaseClient };
