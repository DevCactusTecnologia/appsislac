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

  let body: { tenantId?: string; reset?: boolean } = {};
  try { body = await req.json(); } catch { return errorResponse(400, "JSON inválido", requestId, log); }
  const tenantId = body.tenantId;
  const resetSchema = body.reset !== false; // default true — provisionamento é destrutivo por natureza
  if (!tenantId) return errorResponse(400, "tenantId obrigatório", requestId, log);

  let reg;
  try { reg = await loadRegistry(admin, tenantId); }
  catch (e) { return errorResponse(400, e instanceof Error ? e.message : "loadRegistry", requestId, log); }

  const runId = await beginRun(admin, tenantId, "schema", guard.user.id);
  const t0 = Date.now();

  // 1) Puxa o DDL do shared — RPC exige auth.uid() (SECURITY DEFINER + is_super_admin),
  // então usamos client com o JWT do usuário, não o service-role.
  const userClient = createUserClientFromRequest(req);
  const { data: dump, error: dumpErr } = await userClient.rpc("super_admin_dump_ddl");
  if (dumpErr || !dump) {
    const msg = dumpErr?.message ?? "dump vazio";
    await finishRun(admin, runId, "failed", { stage: "dump" }, msg);
    return errorResponse(500, `Falha ao gerar DDL: ${msg}`, requestId, log);
  }
  const ddl = dump as unknown as DdlDump;

  // 2) Conecta ao dedicado
  let client;
  try { client = await connectDedicated(reg); }
  catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finishRun(admin, runId, "failed", { stage: "connect" }, msg);
    return errorResponse(400, msg, requestId, log);
  }

  const stats = {
    extensions: 0, enums: 0, sequences: 0, tables: 0,
    indexes: 0, fks: 0, functions: 0, triggers: 0, views: 0, sentinel: false,
  };
  const failures: Array<{ stage: string; name?: string; error: string }> = [];

  // Reset limpo do schema public no dedicado — garante idempotência real.
  // Sem isso, tabelas parcialmente criadas em runs anteriores são puladas
  // por CREATE TABLE IF NOT EXISTS e ficam permanentemente sem colunas.
  if (resetSchema) {
    try {
      await client.queryArray(`DROP SCHEMA IF EXISTS public CASCADE`);
      await client.queryArray(`CREATE SCHEMA public`);
      await client.queryArray(`GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role`);
      await client.queryArray(`GRANT ALL ON SCHEMA public TO postgres, service_role`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      try { await client.end(); } catch { /* noop */ }
      await finishRun(admin, runId, "failed", { stage: "reset" }, msg);
      return errorResponse(500, `Falha ao resetar schema public: ${msg}`, requestId, log);
    }
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
    await runBlock("extensions", ddl.extensions ?? []);
    await runBlock("enums", ddl.enums ?? []);
    await runBlock("sequences", ddl.sequences ?? []);
    // PASS 1 (tolerante): cria funções que não dependem de tabelas — em especial
    // current_tenant_id(), is_super_admin(), has_role() — usadas em DEFAULTs e RLS.
    const fnPending = await runBlock("functions", ddl.functions ?? [], { silent: true });
    // reset contador para não contar duas vezes na pass2
    stats.functions = 0;
    await runBlock("tables", ddl.tables ?? []);
    // PASS 2 (real): agora que tabelas existem, refaz funções.
    // Legados do shared que referenciam colunas removidas viram warning.
    await runBlock("functions", fnPending, { silent: true });
    await runBlock("indexes", ddl.indexes ?? [], { silent: true });
    await runBlock("fks", ddl.fks ?? [], { silent: true });
    await runBlock("triggers", ddl.triggers ?? [], { silent: true });
    await runBlock("views", ddl.views ?? [], { silent: true });

    // Sentinela em public.tenants (Opção B — mantém tenant_id fixo)
    try {
      await client.queryArray(
        `INSERT INTO public.tenants (id, nome, slug)
         VALUES ($1, 'Tenant Dedicado', 'dedicated-' || left($1::text,8))
         ON CONFLICT (id) DO NOTHING`,
        [tenantId],
      );
      stats.sentinel = true;
    } catch (e) {
      failures.push({ stage: "sentinel", error: e instanceof Error ? e.message : String(e) });
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
    const nowIso = new Date().toISOString();
    await admin.from("tenant_registry").update({
      schema_provisioned_at: nowIso,
      schema_version: "v3-full",
      migration_state: "schema_ready",
    }).eq("tenant_id", tenantId);
  } else {
    await admin.from("tenant_registry").update({ migration_state: "schema_failed" }).eq("tenant_id", tenantId);
  }

  log.info("provision full done", { tenantId, stats, failures: failures.length, warnings: warnings.length, ms: Date.now() - t0 });
  return jsonResponse(status === "ok" ? 200 : 422, {
    ok: status === "ok",
    runId,
    stats,
    failures,
    warnings,
    latencyMs: Date.now() - t0,
  });
});
