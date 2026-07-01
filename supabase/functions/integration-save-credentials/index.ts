// Edge: integration-save-credentials
// Recebe { integration_id, username, password } do admin do tenant,
// cifra a senha com AES-GCM (INTEGRATION_CRYPTO_KEY) e grava em
// integration_credentials. Valida JWT + RLS via cliente do usuário antes
// de usar service-role para o insert/update.

import { createClient } from "../_shared/runtime/createClient.ts";
import { encryptSecret } from "../_shared/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("authorization") ?? "";
    if (!auth.toLowerCase().startsWith("bearer ")) return j(401, { error: "unauthorized" });
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return j(401, { error: "unauthorized" });

    const body = await req.json().catch(() => ({}));
    const integration_id = String(body?.integration_id ?? "");
    const username = body?.username == null ? null : String(body.username);
    const password = body?.password == null ? null : String(body.password);
    if (!integration_id) return j(400, { error: "integration_id obrigatório" });

    // valida acesso: precisa enxergar a integration via RLS
    const { data: intg, error: intgErr } = await userClient
      .from("integrations")
      .select("id, tenant_id")
      .eq("id", integration_id)
      .maybeSingle();
    if (intgErr || !intg) return j(403, { error: "forbidden" });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const password_encrypted = password ? await encryptSecret(password) : null;

    const { data: existing } = await admin
      .from("integration_credentials")
      .select("id")
      .eq("integration_id", integration_id)
      .maybeSingle();

    if (existing) {
      const patch: Record<string, unknown> = { rotated_at: new Date().toISOString() };
      if (username !== null) patch.username = username;
      if (password !== null) patch.password_encrypted = password_encrypted;
      const { error } = await admin
        .from("integration_credentials")
        .update(patch)
        .eq("id", existing.id);
      if (error) return j(500, { error: "Erro ao salvar credenciais" });
    } else {
      const { error } = await admin.from("integration_credentials").insert({
        tenant_id: intg.tenant_id,
        integration_id,
        username,
        password_encrypted,
      });
      if (error) return j(500, { error: "Erro ao criar credenciais" });
    }
    return j(200, { ok: true });
  } catch (e) {
    console.error("[integration-save-credentials] fatal", e);
    return j(500, { error: "internal_error" });
  }
});

function j(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}