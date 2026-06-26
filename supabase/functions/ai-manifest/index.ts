// ai-manifest — entrega o Capability Manifest filtrado por permissão/tenant.
// SSOT: deriva de supabase/functions/_shared/registry.ts via buildManifest().
// Nunca expõe internals (tools, SQL, services).
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { buildManifest, MANIFEST_VERSION } from "../_shared/registry.ts";
import { aiCorsHeaders, authenticate, jsonResponse, resolveAllowedCapabilities } from "../_shared/aiAuth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: aiCorsHeaders });

  const auth = await authenticate(req);
  if (!auth.ok) return auth.response;

  const allowed = await resolveAllowedCapabilities(auth.admin, auth.userId);
  const manifest = buildManifest(new Set(allowed.map((c) => c.id)));

  return jsonResponse(manifest, 200, {
    "cache-control": "private, max-age=60",
    "x-manifest-version": MANIFEST_VERSION,
    "x-tenant-id": auth.tenantId,
  });
});
