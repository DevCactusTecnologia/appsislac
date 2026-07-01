// Edge function: super-admin-migrate-tenant-data
//
// Fase 3 — Copia dados de domínio do tenant do SHARED para o DEDICADO,
// na ordem topológica das FKs, com session_replication_role=replica
// no destino (desliga triggers durante a carga).
//
// Suporta modo `dryRun: true` (só conta linhas por tabela, não copia).
// Auditoria (tabelas *_audit) é TRUNCADA no destino por decisão da Etapa 2.
//
// Chunking: 500 linhas por página, INSERT ... ON CONFLICT (id) DO NOTHING.

import { createClient } from "../_shared/runtime/createClient.ts";
import { connectDedicated, loadRegistry, requireSuperAdmin, beginRun, finishRun, createUserClientFromRequest, assertSchemaProvisioned } from "../_shared/migration/connect.ts";
import { jsonResponse, errorResponse, preflight, newRequestId, createLogger } from "../_shared/hardening.ts";

const PAGE_SIZE = 500;
const AUDIT_SUFFIX = /_audit$/;

interface TableInfo { table_name: string; level: number; has_tenant_id: boolean; rowcount: number }

function quoteIdent(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) throw new Error(`Identificador inválido: ${name}`);
  return `"${name.replaceAll('"', '""')}"`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const requestId = newRequestId(req);
  const log = createLogger("super-admin-migrate-tenant-data", requestId);
  if (req.method !== "POST") return errorResponse(405, "Method not allowed", requestId, log);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const guard = await requireSuperAdmin(req, admin);
  if (!guard.ok) return errorResponse(guard.status, guard.msg, requestId, log);

  let body: { tenantId?: string; dryRun?: boolean } = {};
  try { body = await req.json(); } catch { return errorResponse(400, "JSON inválido", requestId, log); }
  const tenantId = body.tenantId;
  const dryRun = !!body.dryRun;
  if (!tenantId) return errorResponse(400, "tenantId obrigatório", requestId, log);

  const reg = await loadRegistry(admin, tenantId);
  const runId = await beginRun(admin, tenantId, dryRun ? "dryrun" : "data", guard.user.id);
  const t0 = Date.now();

  try { assertSchemaProvisioned(reg); } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finishRun(admin, runId, "failed", { stage: "precheck" }, msg);
    return errorResponse(400, msg, requestId, log);
  }

  const userClient = createUserClientFromRequest(req);
  const { data: rawList, error: listErr } = await userClient.rpc("super_admin_list_migration_tables", { _tenant_id: tenantId });
  if (listErr || !rawList) {
    await finishRun(admin, runId, "failed", {}, listErr?.message ?? "empty list");
    return errorResponse(500, `Falha ao listar tabelas: ${listErr?.message}`, requestId, log);
  }
  const tables = (rawList as TableInfo[])
    .filter((t) => t.has_tenant_id)
    .filter((t) => !AUDIT_SUFFIX.test(t.table_name))
    .sort((a, b) => a.level - b.level);

  const summary: Record<string, { source: number; copied: number; error?: string }> = {};
  for (const t of tables) summary[t.table_name] = { source: t.rowcount, copied: 0 };

  if (dryRun) {
    await finishRun(admin, runId, "ok", { dryRun: true, tables: summary, ms: Date.now() - t0 });
    return jsonResponse(200, { ok: true, dryRun: true, runId, tables: summary });
  }

  let client;
  try { client = await connectDedicated(reg); }
  catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finishRun(admin, runId, "failed", { stage: "connect" }, msg);
    return errorResponse(400, msg, requestId, log);
  }

  try {
    await client.queryArray("SET session_replication_role = replica");

    for (const t of tables) {
      if (t.rowcount === 0) continue;
      let offset = 0;
      while (offset < t.rowcount) {
        const { data: page, error: pageErr } = await userClient.rpc("super_admin_dump_table_page", {
          _table: t.table_name, _tenant_id: tenantId, _limit: PAGE_SIZE, _offset: offset,
        });
        if (pageErr) { summary[t.table_name].error = pageErr.message; break; }
        const rows = ((page as { rows: Array<Record<string, unknown>> })?.rows) ?? [];
        if (rows.length === 0) break;

        const { rows: colRows } = await client.queryObject<{ column_name: string }>(
          `SELECT column_name
             FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = $1
              AND coalesce(is_generated, 'NEVER') = 'NEVER'
            ORDER BY ordinal_position`,
          [t.table_name],
        );
        const allowed = new Set(colRows.map((c) => c.column_name));
        const cols = Object.keys(rows[0]).filter((c) => allowed.has(c));
        if (cols.length === 0) { summary[t.table_name].error = "Tabela sem colunas inseríveis"; break; }
        const tableIdent = `public.${quoteIdent(t.table_name)}`;
        const colList = cols.map(quoteIdent).join(",");
        const selectList = cols.map(quoteIdent).join(",");
        try {
          await client.queryArray(
            `WITH payload AS (
               SELECT * FROM jsonb_populate_recordset(NULL::${tableIdent}, $1::jsonb)
             )
             INSERT INTO ${tableIdent} (${colList})
             SELECT ${selectList} FROM payload
             ON CONFLICT DO NOTHING`,
            [JSON.stringify(rows)],
          );
          summary[t.table_name].copied += rows.length;
        } catch (e) {
          summary[t.table_name].error = e instanceof Error ? e.message : String(e);
          break;
        }
        offset += rows.length;
      }
    }
  } finally {
    try { await client.queryArray("SET session_replication_role = DEFAULT"); } catch { /* noop */ }
    try { await client.end(); } catch { /* noop */ }
  }

  const failed = Object.values(summary).some((s) => s.error);
  const status = failed ? "failed" : "ok";
  await finishRun(admin, runId, status, { tables: summary, ms: Date.now() - t0 });
  await admin.from("tenant_registry").update({ migration_state: status === "ok" ? "data_ready" : "data_failed" }).eq("tenant_id", tenantId);

  log.info("data migration done", { tenantId, status, ms: Date.now() - t0 });
  return jsonResponse(status === "ok" ? 200 : 422, { ok: status === "ok", runId, tables: summary, latencyMs: Date.now() - t0 });
});
