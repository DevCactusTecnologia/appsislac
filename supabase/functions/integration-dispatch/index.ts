// Edge Function: integration-dispatch (orquestrador genérico)
// -----------------------------------------------------------
// Recebe { job_id }, resolve o ProviderDriver pelo provider da integração
// e delega o passo via runPipeline. NÃO conhece SOAP/XML/REST/Hermes/DBSync.
//
// Auth: cron secret OU JWT autenticado (mantido idêntico ao legado).

import { createClient } from "../_shared/runtime/createClient.ts";
import {
  getAdminClient,
  logIntegration,
  safeEq,
} from "../_shared/integrationLog.ts";
import {
  ProviderDriverRegistry,
  runPipeline,
  failJob,
  loadIntegrationCredentials,
  supportsKind,
  type DriverContext,
  type JobKind,
} from "../_shared/drivers/index.ts";
import { sendToDlq } from "../_shared/drivers/index.ts";

import { corsHeaders } from "../_shared/cors.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
    const provided = req.headers.get("x-cron-secret") ?? "";
    const isCron = !!cronSecret && safeEq(provided, cronSecret);

    if (!isCron) {
      const auth = req.headers.get("authorization") ?? "";
      if (!auth.toLowerCase().startsWith("bearer ")) {
        return json(401, { error: "unauthorized" });
      }
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: auth } } },
      );
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return json(401, { error: "unauthorized" });
    }

    const body = await req.json().catch(() => ({}));
    const jobId: string | undefined = body?.job_id;
    if (!jobId || typeof jobId !== "string") {
      return json(400, { error: "job_id obrigatório" });
    }

    const admin = getAdminClient();
    return await runDispatch(admin, jobId);
  } catch (e) {
    console.error("[integration-dispatch] fatal", e);
    return json(500, { error: "internal_error" });
  }
});

async function runDispatch(admin: ReturnType<typeof getAdminClient>, jobId: string): Promise<Response> {
  const { data: job, error: jobErr } = await admin
    .from("integration_jobs").select("*").eq("id", jobId).maybeSingle();
  if (jobErr || !job) return json(404, { error: "job não encontrado" });
  if (job.status === "COMPLETED" || job.status === "CANCELLED") {
    return json(200, { ok: true, skipped: true, status: job.status });
  }

  // Se já veio PROCESSING (claim atômico do runner via RPC SKIP LOCKED), seguimos.
  // Caso contrário, tentamos lock otimista PENDING/FAILED -> PROCESSING.
  if (job.status !== "PROCESSING") {
    const locked = await claimSingle(admin, jobId);
    if (!locked) return json(200, { ok: true, skipped: true, reason: "already_processing" });
  }

  const { data: integration, error: intErr } = await admin
    .from("integrations").select("*").eq("id", job.integration_id).maybeSingle();
  if (intErr || !integration) {
    const r = await failJob(admin, job, "integration_not_found");
    return json(r.status, r.body);
  }
  if (!integration.ativo) {
    const r = await failJob(admin, job, "integration_inactive");
    return json(r.status, r.body);
  }

  const driver = ProviderDriverRegistry.resolve(integration.provider as string);
  if (!driver) {
    await sendToDlq(admin, {
      tenantId: job.tenant_id as string,
      integrationId: job.integration_id as string,
      provider: String(integration.provider),
      job: job as { id: string; kind: string; payload?: unknown; correlation_id?: string | null; retry_count?: number | null; last_error?: string | null },
      reason: "PROVIDER_NOT_SUPPORTED",
      message: `provider_not_supported: ${integration.provider}`,
    });
    const r = await failJob(admin, job, `DEAD: PROVIDER_NOT_SUPPORTED`);
    return json(r.status, r.body);
  }
  if (!supportsKind(driver.capabilities, job.kind as JobKind)) {
    await sendToDlq(admin, {
      tenantId: job.tenant_id as string,
      integrationId: job.integration_id as string,
      provider: String(integration.provider),
      job: job as { id: string; kind: string; payload?: unknown; correlation_id?: string | null; retry_count?: number | null; last_error?: string | null },
      reason: "CAPABILITY_NOT_SUPPORTED",
      message: `capability_not_supported: ${job.kind}`,
    });
    const r = await failJob(admin, job, `DEAD: CAPABILITY_NOT_SUPPORTED`);
    return json(r.status, r.body);
  }

  const payload = (job.payload ?? {}) as Record<string, unknown>;
  const externalProtocol = String(payload.external_protocol ?? "");
  if (!externalProtocol && job.kind !== "SEND_ORDER") {
    const r = await failJob(admin, job, "missing_external_protocol");
    return json(r.status, r.body);
  }

  // Credenciais centralizadas (cache + key_version + dual-key fallback)
  const mode = (integration.mode as "MOCK" | "HOMOLOG" | "PROD") ?? "MOCK";
  let credentials = { username: "", password: "", keyVersion: 1 };
  if (mode !== "MOCK") {
    try {
      credentials = await loadIntegrationCredentials(admin, job.integration_id);
    } catch (e) {
      await logIntegration(admin, {
        tenant_id: job.tenant_id, integration_id: job.integration_id, job_id: job.id,
        level: "ERROR", message: "Falha ao decifrar credencial",
        context: { err: String(e) },
      });
      const r = await failJob(admin, job, "credential_decrypt_failed");
      return json(r.status, r.body);
    }
  }

  // Garante correlation_id (persistido)
  let correlationId = (job.correlation_id as string | null) ?? "";
  if (!correlationId) {
    correlationId = crypto.randomUUID();
    await admin.from("integration_jobs").update({ correlation_id: correlationId }).eq("id", job.id);
  }

  const ctx: DriverContext = {
    admin, job, integration,
    tenant_id: job.tenant_id as string,
    integration_id: job.integration_id as string,
    payload, externalProtocol, correlationId, credentials,
  };

  const out = await runPipeline(driver, ctx);
  return json(out.status, out.body);
}

async function claimSingle(admin: ReturnType<typeof getAdminClient>, jobId: string): Promise<boolean> {
  // Tenta lock otimista direto no job-alvo (mais simples e compatível com chamadas single-job).
  const { data: locked } = await admin
    .from("integration_jobs")
    .update({ status: "PROCESSING", started_at: new Date().toISOString() })
    .eq("id", jobId)
    .in("status", ["PENDING", "FAILED"])
    .select("id").maybeSingle();
  return !!locked;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}