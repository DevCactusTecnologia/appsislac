// Edge: integration-test-connection
// Faz uma chamada de verificarRecebimentoPedido contra o transport
// (MOCK/HOMOLOG/PROD) para validar credenciais/endpoint sem persistir job.
// Aceita override opcional de username/password para testar antes de salvar.

import { createClient } from "../_shared/runtime/createClient.ts";
import {
  createTransport,
  envelopeVerificarRecebimento,
  parseVerificarRecebimento,
} from "../_shared/protocols/hermes-pardini.ts";
import { decryptSecret } from "../_shared/crypto.ts";

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
    const overrideUser = body?.username ? String(body.username) : null;
    const overridePass = body?.password ? String(body.password) : null;
    const externalProtocol = String(body?.external_protocol ?? "TEST-0001");
    if (!integration_id) return j(400, { error: "integration_id obrigatório" });

    // RLS check
    const { data: intg, error: intgErr } = await userClient
      .from("integrations")
      .select("id, tenant_id, mode, endpoint_url, client_code, soap_action_prefix, timeout_seconds")
      .eq("id", integration_id)
      .maybeSingle();
    if (intgErr || !intg) return j(403, { error: "forbidden" });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const mode = (intg.mode as "MOCK" | "HOMOLOG" | "PROD") ?? "MOCK";
    let username: string | undefined = overrideUser ?? undefined;
    let password: string | undefined = overridePass ?? undefined;
    if (mode !== "MOCK" && (!username || !password)) {
      const { data: cred } = await admin
        .from("integration_credentials")
        .select("username, password_encrypted")
        .eq("integration_id", integration_id)
        .maybeSingle();
      username = username ?? cred?.username ?? undefined;
      if (!password && cred?.password_encrypted) {
        try { password = await decryptSecret(cred.password_encrypted as string); }
        catch (e) { return j(500, { error: "credential_decrypt_failed", detail: String(e) }); }
      }
    }

    const transport = createTransport(mode, {
      endpoint: intg.endpoint_url ?? "",
      // Auth nova vai inline no envelope (login/passwd).
      username: undefined, password: undefined,
      timeoutMs: ((intg.timeout_seconds as number) ?? 60) * 1000,
      soapActionPrefix: (intg.soap_action_prefix as string | null) ?? undefined,
    });
    const t0 = Date.now();
    try {
      const env = envelopeVerificarRecebimento({
        clientCode: String(intg.client_code ?? ""),
        externalProtocol,
        login: username,
        passwd: password,
      });
      const r = await transport.request(env);
      const p = parseVerificarRecebimento(r.body);
      return j(200, {
        ok: p.ok && !p.faultString,
        mode, durationMs: Date.now() - t0,
        statusCode: r.status,
        parsed: p.data ?? null,
        fault: p.ok ? null : { code: p.faultCode, message: p.faultString },
      });
    } catch (e) {
      return j(200, { ok: false, mode, error: String((e as Error).message ?? e) });
    }
  } catch (e) {
    console.error("[integration-test-connection] fatal", e);
    return j(500, { error: "internal_error" });
  }
});

function j(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}