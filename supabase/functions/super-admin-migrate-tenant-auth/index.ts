// Edge function: super-admin-migrate-tenant-auth
//
// Fase 3 — Copia auth.users + user_roles do tenant para o BANCO DEDICADO,
// preservando id, email, encrypted_password e metadados (login mantido).
//
// Fonte: RPC public.super_admin_dump_auth_users(tenant) no shared.
// Destino: INSERT direto em auth.users via postgres.js no dedicado.
// Idempotente: usa ON CONFLICT(id) DO NOTHING.

import { createClient } from "../_shared/runtime/createClient.ts";
import { connectDedicated, loadRegistry, requireSuperAdmin, beginRun, finishRun } from "../_shared/migration/connect.ts";
import { jsonResponse, errorResponse, preflight, newRequestId, createLogger } from "../_shared/hardening.ts";

interface AuthUser {
  id: string; email: string | null;
  encrypted_password: string | null;
  email_confirmed_at: string | null;
  raw_user_meta_data: unknown; raw_app_meta_data: unknown;
  created_at: string | null; updated_at: string | null;
}
interface UserRole { user_id: string; role: string; tenant_id: string }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const requestId = newRequestId(req);
  const log = createLogger("super-admin-migrate-tenant-auth", requestId);
  if (req.method !== "POST") return errorResponse(405, "Method not allowed", requestId, log);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const guard = await requireSuperAdmin(req, admin);
  if (!guard.ok) return errorResponse(guard.status, guard.msg, requestId, log);

  let body: { tenantId?: string } = {};
  try { body = await req.json(); } catch { return errorResponse(400, "JSON inválido", requestId, log); }
  const tenantId = body.tenantId;
  if (!tenantId) return errorResponse(400, "tenantId obrigatório", requestId, log);

  const reg = await loadRegistry(admin, tenantId).catch((e) => { throw e; });
  const runId = await beginRun(admin, tenantId, "auth", guard.user.id);
  const t0 = Date.now();

  const { data: dump, error: dumpErr } = await admin.rpc("super_admin_dump_auth_users", { _tenant_id: tenantId });
  if (dumpErr) {
    await finishRun(admin, runId, "failed", {}, dumpErr.message);
    return errorResponse(500, `Falha ao dumpar auth: ${dumpErr.message}`, requestId, log);
  }
  const { users = [], roles = [] } = (dump as { users: AuthUser[]; roles: UserRole[] }) ?? { users: [], roles: [] };

  let client;
  try { client = await connectDedicated(reg); }
  catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finishRun(admin, runId, "failed", { stage: "connect" }, msg);
    return errorResponse(400, msg, requestId, log);
  }

  let insertedUsers = 0;
  let insertedRoles = 0;
  const errors: string[] = [];

  try {
    await client.queryArray("BEGIN");

    for (const u of users) {
      try {
        await client.queryArray(
          `INSERT INTO auth.users
            (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
             raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
           VALUES
            ('00000000-0000-0000-0000-000000000000'::uuid, $1, 'authenticated', 'authenticated',
             $2, $3, $4, $5::jsonb, $6::jsonb, coalesce($7,now()), coalesce($8,now()))
           ON CONFLICT (id) DO NOTHING`,
          [
            u.id, u.email, u.encrypted_password, u.email_confirmed_at,
            JSON.stringify(u.raw_user_meta_data ?? {}),
            JSON.stringify(u.raw_app_meta_data ?? {}),
            u.created_at, u.updated_at,
          ],
        );
        insertedUsers++;
      } catch (e) {
        errors.push(`user ${u.id.slice(0, 8)}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    for (const r of roles) {
      try {
        await client.queryArray(
          `INSERT INTO public.user_roles (user_id, role, tenant_id)
           VALUES ($1, $2::app_role, $3)
           ON CONFLICT DO NOTHING`,
          [r.user_id, r.role, r.tenant_id],
        );
        insertedRoles++;
      } catch (e) {
        errors.push(`role ${r.user_id.slice(0, 8)}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (errors.length > 0) {
      await client.queryArray("ROLLBACK");
    } else {
      await client.queryArray("COMMIT");
    }
  } finally {
    try { await client.end(); } catch { /* noop */ }
  }

  const status = errors.length === 0 ? "ok" : "failed";
  const stats = { users_source: users.length, users_inserted: insertedUsers, roles_source: roles.length, roles_inserted: insertedRoles, ms: Date.now() - t0 };
  await finishRun(admin, runId, status, stats, errors.length > 0 ? errors.slice(0, 10).join(" | ") : undefined);

  log.info("auth migration done", { tenantId, stats, errors: errors.length });
  return jsonResponse(200, { ok: status === "ok", runId, stats, errors });
});
