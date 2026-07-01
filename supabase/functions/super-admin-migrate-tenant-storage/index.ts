// Edge function: super-admin-migrate-tenant-storage
// Copia buckets + objects do Storage do SHARED para o DEDICADO.
// Escopo: apenas objetos cujo path começa com `${tenantId}/` (convenção do projeto).

import { createClient } from "../_shared/runtime/createClient.ts";
import { loadRegistry, requireSuperAdmin, beginRun, finishRun } from "../_shared/migration/connect.ts";
import { jsonResponse, errorResponse, preflight, newRequestId, createLogger } from "../_shared/hardening.ts";

const BUCKETS = ["assinaturas", "tenant-assets", "integration-assets", "lab-apoio-upload-pdf"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const requestId = newRequestId(req);
  const log = createLogger("super-admin-migrate-tenant-storage", requestId);
  if (req.method !== "POST") return errorResponse(405, "Method not allowed", requestId, log);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const guard = await requireSuperAdmin(req, admin);
  if (!guard.ok) return errorResponse(guard.status, guard.msg, requestId, log);

  let body: { tenantId?: string } = {};
  try { body = await req.json(); } catch { return errorResponse(400, "JSON inválido", requestId, log); }
  const tenantId = body.tenantId;
  if (!tenantId) return errorResponse(400, "tenantId obrigatório", requestId, log);

  const reg = await loadRegistry(admin, tenantId);
  const runId = await beginRun(admin, tenantId, "storage", guard.user.id);
  const t0 = Date.now();

  // Cliente destino via URL + service role dedicada (nome do secret vem do registry em db_secret_ref).
  const regTyped = reg as unknown as { db_project_url?: string; db_secret_ref?: string };
  const destUrl = regTyped.db_project_url;
  const destServiceSecretRef = regTyped.db_secret_ref?.trim();

  if (!destUrl) {
    await finishRun(admin, runId, "failed", { stage: "config" }, "db_project_url ausente");
    return errorResponse(400, "URL do projeto dedicado não configurada no registry.", requestId, log);
  }
  if (!destServiceSecretRef) {
    await finishRun(admin, runId, "failed", { stage: "config" }, "db_secret_ref ausente no registry");
    return errorResponse(400, "Cadastre o nome do secret da service role (db_secret_ref) na aba Banco de dados do laboratório.", requestId, log);
  }
  const destServiceKey = Deno.env.get(destServiceSecretRef);
  if (!destServiceKey) {
    await finishRun(admin, runId, "failed", { stage: "config" }, `Secret ${destServiceSecretRef} ausente`);
    return errorResponse(400, `Cadastre o secret ${destServiceSecretRef} (service role do projeto dedicado) nos Secrets do Lovable Cloud para migrar Storage.`, requestId, log);
  }
  const dest = createClient(destUrl, destServiceKey);

  const summary: Record<string, { copied: number; skipped: number; error?: string }> = {};
  for (const bucket of BUCKETS) {
    summary[bucket] = { copied: 0, skipped: 0 };
    try {
      // Garante bucket no destino
      await dest.storage.createBucket(bucket, { public: bucket === "tenant-assets" }).catch(() => {});
      // Lista recursivamente prefixo tenantId/
      const stack: string[] = [`${tenantId}`];
      while (stack.length) {
        const prefix = stack.pop()!;
        const { data: entries, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
        if (error) { summary[bucket].error = error.message; break; }
        for (const e of entries ?? []) {
          const full = `${prefix}/${e.name}`;
          if ((e as { id?: string }).id === null || !e.metadata) { stack.push(full); continue; }
          const { data: blob, error: dErr } = await admin.storage.from(bucket).download(full);
          if (dErr || !blob) { summary[bucket].skipped++; continue; }
          const { error: uErr } = await dest.storage.from(bucket).upload(full, blob, {
            contentType: (e.metadata as { mimetype?: string }).mimetype ?? "application/octet-stream",
            upsert: true,
          });
          if (uErr) summary[bucket].skipped++; else summary[bucket].copied++;
        }
      }
    } catch (e) {
      summary[bucket].error = e instanceof Error ? e.message : String(e);
    }
  }

  const failed = Object.values(summary).some((s) => s.error);
  await finishRun(admin, runId, failed ? "failed" : "ok", { buckets: summary, ms: Date.now() - t0 });
  log.info("storage done", { tenantId, summary });
  return jsonResponse(200, { ok: !failed, runId, buckets: summary, latencyMs: Date.now() - t0 });
});
