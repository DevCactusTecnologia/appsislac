// Shared helpers para migração shared → dedicated.
// - Conecta ao banco DEDICADO de um tenant a partir de tenant_registry.
// - Registra fases em tenant_migration_runs.
// - Nunca loga senhas/hashes.

import { Client } from "https://deno.land/x/postgres@v0.19.3/mod.ts";
import { createClient } from "../runtime/createClient.ts";

const SECRET_REF_RE = /^[A-Z][A-Z0-9_]{2,63}$/;

export type AdminClient = ReturnType<typeof createClient>;

export interface TenantRegistryRow {
  tenant_id: string;
  db_host: string | null;
  db_port: number | null;
  db_name: string | null;
  db_user: string | null;
  db_secret_ref: string | null;
  db_project_url: string | null;
  db_anon_key_secret_ref: string | null;
  schema_provisioned_at: string | null;
  runtime_mode: string | null;
  database_strategy: string | null;
  migration_state: string | null;
}

export function createUserClientFromRequest(req: Request): AdminClient {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
}

export async function requireSuperAdmin(req: Request, admin: AdminClient) {
  const userClient = createUserClientFromRequest(req);
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401, msg: "Não autenticado" };
  const { data: isSuper } = await admin.rpc("is_super_admin", { _user_id: user.id });
  if (!isSuper) return { ok: false as const, status: 403, msg: "Apenas super admins" };
  return { ok: true as const, user };
}

export async function loadRegistry(admin: AdminClient, tenantId: string): Promise<TenantRegistryRow> {
  const { data, error } = await admin
    .from("tenant_registry")
    .select("tenant_id, db_host, db_port, db_name, db_user, db_secret_ref, db_project_url, db_anon_key_secret_ref, schema_provisioned_at, runtime_mode, database_strategy, migration_state")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(`tenant_registry: ${error.message}`);
  if (!data) throw new Error("tenant_registry: registro não encontrado");
  return data as TenantRegistryRow;
}

export function isDedicatedRegistry(reg: TenantRegistryRow): boolean {
  return reg.runtime_mode === "isolated_db" || reg.database_strategy === "dedicated";
}

export function assertDedicatedRegistry(reg: TenantRegistryRow) {
  if (!isDedicatedRegistry(reg)) {
    throw new Error("Tenant ainda está em modo Compartilhado. Configure como banco dedicado antes de migrar.");
  }
}

export function assertSchemaProvisioned(reg: TenantRegistryRow) {
  if (!reg.schema_provisioned_at) {
    throw new Error("Schema dedicado ainda não foi provisionado com sucesso. Execute a etapa Provisionar schema antes desta fase.");
  }
}

/** Conecta ao banco DEDICADO do tenant a partir do tenant_registry + secret. */
export async function connectDedicated(reg: TenantRegistryRow): Promise<Client> {
  assertDedicatedRegistry(reg);
  const { db_host, db_port, db_name, db_user, db_secret_ref } = reg;
  const missing: string[] = [];
  if (!db_host) missing.push("db_host");
  if (!db_port) missing.push("db_port");
  if (!db_name) missing.push("db_name");
  if (!db_user) missing.push("db_user");
  if (!db_secret_ref) missing.push("db_secret_ref (senha)");
  if (missing.length) {
    throw new Error(
      `Banco dedicado do tenant não configurado. Faltando: ${missing.join(", ")}. ` +
      `Preencha em Super Admin → Laboratório → aba "Banco de Dados" antes de migrar.`,
    );
  }
  if (!SECRET_REF_RE.test(db_secret_ref)) throw new Error("db_secret_ref inválido");
  const password = Deno.env.get(db_secret_ref);
  if (!password) throw new Error(`Secret "${db_secret_ref}" não está cadastrado no Lovable Cloud`);
  const client = new Client({
    hostname: db_host,
    port: db_port,
    database: db_name,
    user: db_user,
    password,
    tls: { enabled: true, enforce: false } as unknown as Record<string, unknown>,
    connection: { attempts: 1 },
  });
  await client.connect();
  return client;
}

/** Conecta ao banco SHARED (o próprio banco do control plane). */
export async function connectShared(): Promise<Client> {
  // Em Lovable Cloud o Postgres do projeto shared é acessível via
  // as variáveis padrão do Supabase — usamos service role sobre o pooler.
  const host = Deno.env.get("SHARED_DB_HOST");
  const port = Number(Deno.env.get("SHARED_DB_PORT") ?? 5432);
  const database = Deno.env.get("SHARED_DB_NAME") ?? "postgres";
  const user = Deno.env.get("SHARED_DB_USER");
  const password = Deno.env.get("SHARED_DB_PASSWORD");
  if (!host || !user || !password) {
    throw new Error("Secrets SHARED_DB_HOST/USER/PASSWORD não configurados");
  }
  const client = new Client({
    hostname: host,
    port,
    database,
    user,
    password,
    tls: { enabled: true, enforce: false } as unknown as Record<string, unknown>,
    connection: { attempts: 1 },
  });
  await client.connect();
  return client;
}

export async function beginRun(
  admin: AdminClient,
  tenantId: string,
  phase: string,
  userId: string,
): Promise<string> {
  const { data, error } = await admin
    .from("tenant_migration_runs")
    .insert({ tenant_id: tenantId, phase, status: "running", initiated_by: userId })
    .select("id")
    .single();
  if (error) throw new Error(`begin_run: ${error.message}`);
  return (data as { id: string }).id;
}

export async function finishRun(
  admin: AdminClient,
  runId: string,
  status: "ok" | "failed" | "aborted",
  stats: Record<string, unknown>,
  error?: string,
) {
  await admin
    .from("tenant_migration_runs")
    .update({ status, stats, error: error ?? null, finished_at: new Date().toISOString() })
    .eq("id", runId);
}
