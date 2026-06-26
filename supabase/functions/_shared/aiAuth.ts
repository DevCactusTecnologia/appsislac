// SSOT do bootstrap das Edge Functions do Assistente.
// Consolida: CORS, validação de JWT, tenant resolver, filtro de permissões.
// Consumido por ai-chat e ai-manifest. PROIBIDO duplicar essa lógica.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { CAPABILITIES, type CapabilityMeta } from "./registry.ts";

export const aiCorsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function jsonResponse(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...aiCorsHeaders, "content-type": "application/json", ...extra },
  });
}

export interface AiAuthOk {
  ok: true;
  userId: string;
  tenantId: string;
  admin: SupabaseClient;
  userClient: SupabaseClient;
  token: string;
}
export interface AiAuthFail { ok: false; response: Response }
export type AiAuthResult = AiAuthOk | AiAuthFail;

/**
 * Bootstrap padrão: valida JWT, resolve tenant via current_tenant_id() e devolve
 * os clientes prontos. Falhas viram Response HTTP coerente (401/403/500).
 */
export async function authenticate(req: Request): Promise<AiAuthResult> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    return { ok: false, response: jsonResponse({ error: "missing_env" }, 500) };
  }
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : "";
  if (!token) return { ok: false, response: jsonResponse({ error: "unauthorized" }, 401) };

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return { ok: false, response: jsonResponse({ error: "invalid_token" }, 401) };

  const { data: tenantRpc } = await userClient.rpc("current_tenant_id");
  const tenantId = (tenantRpc as string | null) ?? null;
  if (!tenantId) return { ok: false, response: jsonResponse({ error: "tenant_unresolved" }, 403) };

  return { ok: true, userId: userData.user.id, tenantId, admin, userClient, token };
}

/** Filtra CAPABILITIES pelas permissões do usuário. Única implementação no Core. */
export async function resolveAllowedCapabilities(
  admin: SupabaseClient,
  userId: string,
): Promise<CapabilityMeta[]> {
  const out: CapabilityMeta[] = [];
  for (const cap of CAPABILITIES) {
    if (!cap.permission) { out.push(cap); continue; }
    const { data } = await admin.rpc("has_permission", { _user_id: userId, _permission: cap.permission });
    if (data) out.push(cap);
  }
  return out;
}
