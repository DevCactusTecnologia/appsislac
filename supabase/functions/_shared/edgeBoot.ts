// _shared/edgeBoot.ts
// Bootstrap OFICIAL para novas edge functions do SISLAC.
//
// Centraliza:
//  - CORS uniforme
//  - JWT validation (opcional via require_auth)
//  - tenant resolver (via profiles)
//  - correlation_id (header `x-correlation-id` ou uuid novo)
//  - logger compatível com integration_logs
//  - error translator (catch-all → 500 JSON com correlation_id)
//
// USO (edge function nova):
//   import { boot } from "../_shared/edgeBoot.ts";
//   Deno.serve((req) => boot(req, async (ctx) => {
//     // ctx.admin / ctx.tenantId / ctx.userId / ctx.correlationId / ctx.json(...)
//     return ctx.json({ ok: true });
//   }, { require_auth: true }));
//
// Edge functions LEGADAS continuam funcionando — esta migração é OPT-IN.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logIntegration, type AdminClient } from "./integrationLog.ts";

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-correlation-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export interface EdgeBootContext {
  req: Request;
  admin: AdminClient;
  /** uuid v4 propagado em logs e respostas (header x-correlation-id). */
  correlationId: string;
  /** uid do usuário autenticado quando `require_auth=true`. */
  userId: string | null;
  /** tenant_id resolvido server-side a partir do profile do usuário. */
  tenantId: string | null;
  /** Helper para retornar JSON com CORS + correlation header. */
  json: (body: unknown, init?: ResponseInit) => Response;
  /** Helper para registrar log estruturado em integration_logs. */
  log: (
    level: "DEBUG" | "INFO" | "WARN" | "ERROR" | "CRITICAL",
    message: string,
    context?: Record<string, unknown>,
  ) => Promise<void>;
}

export interface BootOptions {
  /** Quando true, exige Authorization Bearer e resolve userId/tenantId. */
  require_auth?: boolean;
  /** Quando true, exige tenantId presente (implica require_auth). */
  require_tenant?: boolean;
  /** Nome lógico da função (default: derivado do URL). */
  name?: string;
}

function newCorrelationId(req: Request): string {
  const incoming = req.headers.get("x-correlation-id");
  if (incoming && /^[0-9a-f-]{16,}$/i.test(incoming)) return incoming;
  return crypto.randomUUID();
}

function getAdmin(): AdminClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export async function boot(
  req: Request,
  handler: (ctx: EdgeBootContext) => Promise<Response> | Response,
  opts: BootOptions = {},
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = newCorrelationId(req);
  const admin = getAdmin();

  const json = (body: unknown, init: ResponseInit = {}) =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), {
      ...init,
      headers: {
        ...corsHeaders,
        "content-type": "application/json",
        "x-correlation-id": correlationId,
        ...(init.headers ?? {}),
      },
    });

  let userId: string | null = null;
  let tenantId: string | null = null;

  try {
    const requireAuth = opts.require_auth || opts.require_tenant;
    if (requireAuth) {
      const auth = req.headers.get("authorization") ?? "";
      const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
      if (!token) return json({ error: "missing_token", correlation_id: correlationId }, { status: 401 });
      const { data, error } = await admin.auth.getUser(token);
      if (error || !data?.user) {
        return json({ error: "invalid_token", correlation_id: correlationId }, { status: 401 });
      }
      userId = data.user.id;
      const { data: prof } = await admin
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", userId)
        .maybeSingle();
      tenantId = (prof as { tenant_id?: string } | null)?.tenant_id ?? null;
      if (opts.require_tenant && !tenantId) {
        return json({ error: "tenant_unresolved", correlation_id: correlationId }, { status: 403 });
      }
    }

    const ctx: EdgeBootContext = {
      req,
      admin,
      correlationId,
      userId,
      tenantId,
      json,
      log: async (level, message, context) => {
        if (!tenantId) return; // logIntegration exige tenant
        await logIntegration(admin, {
          tenant_id: tenantId,
          level,
          message,
          context: { ...(context ?? {}), correlation_id: correlationId, fn: opts.name ?? null },
        });
      },
    };
    return await handler(ctx);
  } catch (e) {
    const msg = (e as Error)?.message ?? String(e);
    console.error(`[edgeBoot:${opts.name ?? "fn"}] uncaught`, correlationId, msg);
    return json(
      { error: "internal_error", message: msg, correlation_id: correlationId },
      { status: 500 },
    );
  }
}
