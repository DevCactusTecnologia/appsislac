// ai-manifest — entrega o Capability Manifest filtrado por permissão/tenant.
// SSOT: deriva automaticamente de supabase/functions/ai-chat/registry.ts.
// Nunca expõe internals (tools, SQL, services).
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { CAPABILITIES, buildManifest, MANIFEST_VERSION } from "../_shared/registry.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "invalid_token" }), {
      status: 401, headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
  const userId = userData.user.id;
  const { data: tenantRpc } = await userClient.rpc("current_tenant_id");
  const tenantId = (tenantRpc as string | null) ?? null;
  if (!tenantId) {
    return new Response(JSON.stringify({ error: "tenant_unresolved" }), {
      status: 403, headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  // Resolver permissões — única fonte: has_permission RPC.
  const allowed = new Set<string>();
  for (const cap of CAPABILITIES) {
    if (!cap.permission) { allowed.add(cap.id); continue; }
    const { data } = await admin.rpc("has_permission", {
      _user_id: userId, _permission: cap.permission,
    });
    if (data) allowed.add(cap.id);
  }

  const manifest = buildManifest(allowed);
  return new Response(JSON.stringify(manifest), {
    headers: {
      ...corsHeaders,
      "content-type": "application/json",
      "cache-control": "private, max-age=60",
      "x-manifest-version": MANIFEST_VERSION,
      "x-tenant-id": tenantId,
    },
  });
});
