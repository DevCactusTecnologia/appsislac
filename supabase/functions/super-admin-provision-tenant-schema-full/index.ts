// Edge function: super-admin-provision-tenant-schema-full
//
// Fase 3 — Aplica no BANCO DEDICADO do tenant o schema COMPLETO do shared
// (extensões, enums, sequences, tabelas, FKs, índices, funções, triggers, views).
//
// Fonte da verdade: RPC public.super_admin_dump_ddl() no banco compartilhado
// (SECURITY DEFINER, restrita a service_role). O edge é apenas o executor:
// lê o DDL como JSON, conecta ao dedicado via postgres.js e aplica em ordem
// segura, ignorando statements que já existem (idempotente).
//
// NÃO copia dados nem auth.users — essas fases têm edges próprias.

import { createClient } from "../_shared/runtime/createClient.ts";
import {
  connectDedicated,
  loadRegistry,
  requireSuperAdmin,
  beginRun,
  finishRun,
  createUserClientFromRequest,
} from "../_shared/migration/connect.ts";
import { jsonResponse, errorResponse, preflight, newRequestId, createLogger } from "../_shared/hardening.ts";

type DdlItem = { name?: string; table?: string; ddl: string };
type DdlDump = {
  extensions: string[];
  enums: DdlItem[];
  sequences: DdlItem[];
  tables: DdlItem[];
  fks: DdlItem[];
  indexes: DdlItem[];
  functions: DdlItem[];
  triggers: DdlItem[];
  views: DdlItem[];
  generated_at: string;
};

const SCHEMA_VERSION = "v3-full";

async function getDedicatedSchemaVersion(client: { queryObject: <T>(query: string, args?: unknown[]) => Promise<{ rows: T[] }> }) {
  try {
    const res = await client.queryObject<{ schema_version: string }>(`
      SELECT schema_version
        FROM public._sislac_schema_health
       WHERE id = 1
       LIMIT 1
    `);
    return res.rows[0]?.schema_version ?? null;
  } catch {
    return null;
  }
}

async function markRegistrySchemaReady(admin: ReturnType<typeof createClient>, tenantId: string, log: { warn: (msg: string, data?: unknown) => void }) {
  const { error } = await admin.from("tenant_registry").update({
    schema_provisioned_at: new Date().toISOString(),
    schema_version: SCHEMA_VERSION,
    migration_state: "migrating",
  }).eq("tenant_id", tenantId);
  if (error) {
    log.warn("registry update failed after schema provision", { tenantId, error: error.message });
  }
}

async function markRunProgress(admin: ReturnType<typeof createClient>, runId: string, stage: string, extra: Record<string, unknown> = {}) {
  await admin
    .from("tenant_migration_runs")
    .update({ stats: { stage, updatedAt: new Date().toISOString(), ...extra } })
    .eq("id", runId);
}

async function prepareDedicatedPublicSchema(client: { queryArray: (query: string, args?: unknown[]) => Promise<unknown> }) {
  // Evita que uma tentativa fique presa esperando lock no banco dedicado e acabe
  // como "Edge Function returned a non-2xx status code" no wizard.
  await client.queryArray(`SET lock_timeout TO '3s'`);
  await client.queryArray(`SET statement_timeout TO '12s'`);
  await client.queryArray(`SET idle_in_transaction_session_timeout TO '30s'`);
  await client.queryArray(`CREATE SCHEMA IF NOT EXISTS public`);
  await client.queryArray(`GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role`);
  await client.queryArray(`GRANT ALL ON SCHEMA public TO postgres, service_role`);
}

async function finalizeDedicatedSchema(client: { queryArray: (query: string, args?: unknown[]) => Promise<unknown> }, tenantId: string) {
  // Health-check neutro para o wizard: não depende de profiles, RLS ou dados migrados.
  await client.queryArray(`
    CREATE TABLE IF NOT EXISTS public._sislac_schema_health (
      id integer PRIMARY KEY DEFAULT 1,
      schema_version text NOT NULL,
      provisioned_at timestamptz NOT NULL DEFAULT now(),
      tenant_id uuid,
      CHECK (id = 1)
    )
  `);
  await client.queryArray(`
    INSERT INTO public._sislac_schema_health (id, schema_version, tenant_id, provisioned_at)
    VALUES (1, $1::text, $2::uuid, now())
    ON CONFLICT (id) DO UPDATE SET
      schema_version = EXCLUDED.schema_version,
      tenant_id = EXCLUDED.tenant_id,
      provisioned_at = EXCLUDED.provisioned_at
  `, [SCHEMA_VERSION, tenantId]);

  // Banco é dedicado por tenant. O cliente de dados usa a publishable/anon key
  // do projeto dedicado; portanto precisa de permissões explícitas via Data API.
  await client.queryArray(`GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role`);
  await client.queryArray(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated`);
  await client.queryArray(`GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role`);
  await client.queryArray(`GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated`);
  await client.queryArray(`GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role`);
  await client.queryArray(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role`);
  await client.queryArray(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated`);
  await client.queryArray(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role`);
  await client.queryArray(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO anon, authenticated`);
  await client.queryArray(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role`);
  await client.queryArray(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role`);

  // Pede recarga de cache do PostgREST; se não houver listener, não bloqueia.
  try { await client.queryArray(`NOTIFY pgrst, 'reload schema'`); } catch { /* noop */ }
}

async function seedTenantSentinel(client: {
  queryArray: (query: string, args?: unknown[]) => Promise<unknown>;
  queryObject: <T>(query: string, args?: unknown[]) => Promise<{ rows: T[] }>;
}, tenantId: string) {
  const meta = await client.queryObject<{ column_name: string; is_nullable: string; column_default: string | null }>(`
    SELECT column_name, is_nullable, column_default
      FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'tenants'
     ORDER BY ordinal_position
  `);
  if (!meta.rows.length) throw new Error("public.tenants não existe no schema dedicado");

  const short = tenantId.slice(0, 8);
  const numericCode = tenantId.replace(/\D/g, "").padEnd(4, "0").slice(0, 6);
  const valuesByColumn: Record<string, unknown> = {
    id: tenantId,
    nome: "Tenant Dedicado",
    name: "Tenant Dedicado",
    slug: `dedicated-${short}`,
    cnpj: tenantId.replace(/\D/g, "").padEnd(14, "0").slice(0, 14),
    email_contato: "dedicated@sislac.local",
    email: "dedicated@sislac.local",
    telefone: "",
    status: "ativo",
    plano: "dedicated",
    database_strategy: "dedicated",
    lab_code: numericCode,
  };

  const requiredMissing = meta.rows
    .filter((c) => c.is_nullable === "NO" && c.column_default === null && !(c.column_name in valuesByColumn))
    .map((c) => c.column_name);
  if (requiredMissing.length) {
    throw new Error(`public.tenants tem colunas obrigatórias sem default não mapeadas: ${requiredMissing.join(", ")}`);
  }

  const cols = meta.rows.map((c) => c.column_name).filter((c) => c in valuesByColumn);
  if (!cols.includes("id")) throw new Error("public.tenants não possui coluna id para sentinela");
  const params = cols.map((_, i) => `$${i + 1}`).join(", ");
  const quoted = cols.map((c) => `"${c.replace(/"/g, '""')}"`).join(", ");
  const values = cols.map((c) => valuesByColumn[c]);
  await client.queryArray(
    `INSERT INTO public.tenants (${quoted}) VALUES (${params}) ON CONFLICT (id) DO NOTHING`,
    values,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return errorResponse(405, "Method not allowed", newRequestId(req), createLogger("provision-full", newRequestId(req)));

  const requestId = newRequestId(req);
  const log = createLogger("super-admin-provision-tenant-schema-full", requestId);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!SUPABASE_URL || !SERVICE_KEY) return errorResponse(500, "Server misconfiguration", requestId, log);
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const guard = await requireSuperAdmin(req, admin);
  if (!guard.ok) return errorResponse(guard.status, guard.msg, requestId, log);

  let body: { tenantId?: string; reset?: boolean; async?: boolean; sync?: boolean } = {};
  try { body = await req.json(); } catch { return errorResponse(400, "JSON inválido", requestId, log); }
  const tenantId = body.tenantId;
  const requestedReset = body.reset === true;
  if (!tenantId) return errorResponse(400, "tenantId obrigatório", requestId, log);

  let reg;
  try { reg = await loadRegistry(admin, tenantId); }
  catch (e) { return errorResponse(400, e instanceof Error ? e.message : "loadRegistry", requestId, log); }

  const syncExecution = body.sync === true || body.async === false;
  if (!syncExecution) {
    // O gateway/cliente do Supabase pode cancelar requests longas e matar a Edge
    // Function no meio do DROP/CREATE, deixando o schema sem a sentinela health.
    // O clique padrão apenas agenda uma segunda execução interna e responde 200;
    // o wizard acompanha tenant_migration_runs até finalizar.
    await admin
      .from("tenant_migration_runs")
      .update({
        status: "aborted",
        error: "Execução anterior interrompida antes de finalizar. Reexecute a etapa.",
        finished_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("phase", "schema")
      .eq("status", "running");

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    const functionUrl = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/super-admin-provision-tenant-schema-full`;
    const backgroundBody = JSON.stringify({ ...body, tenantId, async: false, sync: true });
    const backgroundTask = fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(anonKey ? { apikey: anonKey } : {}),
        ...(authHeader ? { Authorization: authHeader } : {}),
        "x-sislac-background": "schema-provision",
      },
      body: backgroundBody,
    }).then(async (res) => {
      if (!res.ok) {
        log.warn("background provision returned non-2xx", { tenantId, status: res.status, body: (await res.text()).slice(0, 500) });
      }
    }).catch((e) => {
      log.warn("background provision failed to start", { tenantId, error: e instanceof Error ? e.message : String(e) });
    });

    const edgeRuntime = (globalThis as unknown as { EdgeRuntime?: { waitUntil: (promise: Promise<unknown>) => void } }).EdgeRuntime;
    if (edgeRuntime?.waitUntil) edgeRuntime.waitUntil(backgroundTask);
    else backgroundTask.catch(() => null);

    return jsonResponse(200, {
      ok: true,
      async: true,
      status: "running",
      phase: "schema",
      startedAt: new Date().toISOString(),
      hint: "Provisionamento iniciado em segundo plano. Acompanhe o run até finalizar.",
    });
  }

  // Runs podem ficar presos como "running" se o cliente abortar a request antes
  // da resposta. Isso não deve bloquear novas tentativas nem esconder o erro real.
  await admin
    .from("tenant_migration_runs")
    .update({
      status: "aborted",
      error: "Execução anterior interrompida antes de finalizar. Reexecute a etapa.",
      finished_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("phase", "schema")
    .eq("status", "running");

  const runId = await beginRun(admin, tenantId, "schema", guard.user.id);
  const t0 = Date.now();

  // 1) Conecta ao dedicado e permite caminho curto antes do dump DDL.
  let client;
  try {
    await markRunProgress(admin, runId, "connect");
    client = await connectDedicated(reg);
  }
  catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finishRun(admin, runId, "failed", { stage: "connect" }, msg);
    return jsonResponse(200, { ok: false, runId, stage: "connect", error: msg });
  }

  await markRunProgress(admin, runId, "schema_health_probe");
  const currentSchemaVersion = await getDedicatedSchemaVersion(client);
  if (!requestedReset && currentSchemaVersion === SCHEMA_VERSION) {
    try { await client.end(); } catch { /* noop */ }
    await markRegistrySchemaReady(admin, tenantId, log);
    const stats = { schemaAlreadyReady: true, schemaVersion: SCHEMA_VERSION, ms: Date.now() - t0 };
    await finishRun(admin, runId, "ok", stats);
    return jsonResponse(200, { ok: true, runId, stats, failures: [], warnings: [], latencyMs: Date.now() - t0 });
  }

  const resetSchema = requestedReset;

  // 2) Puxa o DDL do shared — RPC exige auth.uid() (SECURITY DEFINER + is_super_admin),
  // então usamos client com o JWT do usuário, não o service-role. Só fazemos isso
  // quando o dedicado ainda não está na versão atual.
  const userClient = createUserClientFromRequest(req);
  await markRunProgress(admin, runId, "dump_ddl");
  const { data: dump, error: dumpErr } = await userClient.rpc("super_admin_dump_ddl");
  if (dumpErr || !dump) {
    const msg = dumpErr?.message ?? "dump vazio";
    try { await client.end(); } catch { /* noop */ }
    await finishRun(admin, runId, "failed", { stage: "dump" }, msg);
    return jsonResponse(200, { ok: false, runId, stage: "dump", error: `Falha ao gerar DDL: ${msg}` });
  }
  const ddl = dump as unknown as DdlDump;

  const stats = {
    extensions: 0, enums: 0, sequences: 0, tables: 0,
    indexes: 0, fks: 0, functions: 0, triggers: 0, views: 0, sentinel: false,
  };
  const failures: Array<{ stage: string; name?: string; error: string }> = [];

  // Reset limpo do schema public no dedicado somente quando explicitamente
  // solicitado. O clique padrão em "Provisionar" deve ser seguro/idempotente:
  // se o cliente abortar a request, não podemos deixar o banco sem schema health.
  if (resetSchema) {
    try {
      await markRunProgress(admin, runId, "reset_public_schema");
      await client.queryArray(`SET lock_timeout TO '3s'`);
      await client.queryArray(`SET statement_timeout TO '12s'`);
      await client.queryArray(`DROP SCHEMA IF EXISTS public CASCADE`);
      await client.queryArray(`CREATE SCHEMA public`);
      await client.queryArray(`GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role`);
      await client.queryArray(`GRANT ALL ON SCHEMA public TO postgres, service_role`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      try { await client.end(); } catch { /* noop */ }
      await finishRun(admin, runId, "failed", { stage: "reset" }, msg);
      return jsonResponse(200, { ok: false, runId, stage: "reset", error: `Falha ao resetar schema public: ${msg}` });
    }
  }

  try {
    await markRunProgress(admin, runId, "prepare_public_schema");
    await prepareDedicatedPublicSchema(client);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    try { await client.end(); } catch { /* noop */ }
    await finishRun(admin, runId, "failed", { stage: "prepare_public_schema" }, msg);
    return jsonResponse(200, { ok: false, runId, stage: "prepare_public_schema", error: `Falha ao preparar schema public: ${msg}` });
  }

  const warnings: Array<{ stage: string; name?: string; error: string }> = [];

  // silent = registra warning em vez de falha (usado em pré-passes e em blocos
  // onde herdamos bugs legados do schema shared).
  const runBlock = async (
    stage: keyof typeof stats,
    items: Array<string | DdlItem>,
    opts: { silent?: boolean } = {},
  ) => {
    const remaining: Array<string | DdlItem> = [];
    for (const it of items) {
      const stmt = typeof it === "string" ? it : it.ddl;
      const label = typeof it === "string" ? undefined : (it.name ?? it.table);
      try {
        await client.queryArray(stmt);
        // @ts-ignore incremental counter
        if (typeof stats[stage] === "number") (stats[stage] as number)++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/already exists|duplicate/i.test(msg)) continue;
        if (opts.silent) {
          warnings.push({ stage: String(stage), name: label, error: msg });
          remaining.push(it);
        } else {
          failures.push({ stage: String(stage), name: label, error: msg });
        }
      }
    }
    return remaining;
  };

  try {
    await markRunProgress(admin, runId, "extensions");
    await runBlock("extensions", ddl.extensions ?? []);
    await markRunProgress(admin, runId, "enums", { extensions: stats.extensions });
    await runBlock("enums", ddl.enums ?? []);
    await markRunProgress(admin, runId, "sequences", { extensions: stats.extensions, enums: stats.enums });
    await runBlock("sequences", ddl.sequences ?? []);
    // PASS 1 (tolerante): cria funções que não dependem de tabelas — em especial
    // current_tenant_id(), is_super_admin(), has_role() — usadas em DEFAULTs e RLS.
    await markRunProgress(admin, runId, "functions_pass1", { sequences: stats.sequences });
    const fnPending = await runBlock("functions", ddl.functions ?? [], { silent: true });
    // reset contador para não contar duas vezes na pass2
    stats.functions = 0;
    await markRunProgress(admin, runId, "tables", { fnPending: fnPending.length });
    await runBlock("tables", ddl.tables ?? []);
    // PASS 2 (real): agora que tabelas existem, refaz funções.
    // Legados do shared que referenciam colunas removidas viram warning.
    await markRunProgress(admin, runId, "functions_pass2", { tables: stats.tables });
    await runBlock("functions", fnPending, { silent: true });
    await markRunProgress(admin, runId, "indexes", { functions: stats.functions });
    await runBlock("indexes", ddl.indexes ?? [], { silent: true });
    await markRunProgress(admin, runId, "fks", { indexes: stats.indexes });
    await runBlock("fks", ddl.fks ?? [], { silent: true });
    await markRunProgress(admin, runId, "triggers", { fks: stats.fks });
    await runBlock("triggers", ddl.triggers ?? [], { silent: true });
    await markRunProgress(admin, runId, "views", { triggers: stats.triggers });
    await runBlock("views", ddl.views ?? [], { silent: true });

    // Sentinela em public.tenants (Opção B — mantém tenant_id fixo).
    try {
      await markRunProgress(admin, runId, "sentinel", { views: stats.views });
      await seedTenantSentinel(client, tenantId);
      stats.sentinel = true;
    } catch (e) {
      failures.push({ stage: "sentinel", error: e instanceof Error ? e.message : String(e) });
    }

    if (failures.length === 0) {
      try {
        await markRunProgress(admin, runId, "finalize", { sentinel: stats.sentinel });
        await finalizeDedicatedSchema(client, tenantId);
      } catch (e) {
        failures.push({ stage: "finalize", error: e instanceof Error ? e.message : String(e) });
      }
    }
  } finally {
    try { await client.end(); } catch { /* noop */ }
  }

  const status = failures.length === 0 ? "ok" : "failed";
  await finishRun(admin, runId, status, {
    ...stats,
    ms: Date.now() - t0,
    failures: failures.slice(0, 20),
    warnings: warnings.slice(0, 40),
  });

  if (status === "ok") {
    await markRegistrySchemaReady(admin, tenantId, log);
  } else {
    const { error: regUpdateErr } = await admin
      .from("tenant_registry")
      .update({ migration_state: "idle" })
      .eq("tenant_id", tenantId);
    if (regUpdateErr) {
      log.warn("registry update failed after schema failure", { tenantId, error: regUpdateErr.message });
    }
  }

  log.info("provision full done", { tenantId, stats, failures: failures.length, warnings: warnings.length, ms: Date.now() - t0 });
  // Retorna HTTP 200 mesmo em falha operacional para o wizard conseguir exibir
  // `failures`/`warnings`. Erros de contrato/autenticação continuam usando 4xx/5xx acima.
  return jsonResponse(200, {
    ok: status === "ok",
    runId,
    stats,
    failures,
    warnings,
    latencyMs: Date.now() - t0,
  });
});
