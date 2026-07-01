// Edge: dbsync-test-connection
// ---------------------------------------------
// Teste de conexão DBSync (DB Diagnósticos).
// Hoje só MOCK é executável — HOMOLOG/PROD retornam mensagem clara
// orientando o operador (transporte HTTP/SOAP real ainda não disponível).
// Não persiste job, não envia ordem real, não toca em outros providers.

import { createClient } from "../_shared/runtime/createClient.ts";
import {
  createDBSyncTransport,
  envelopeRecebeAtendimento,
  parseRecebeAtendimento,
} from "../_shared/protocols/dbsync.ts";
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
    if (!integration_id) return j(400, { error: "integration_id obrigatório" });

    // RLS check: só lê se o tenant do usuário casa.
    const { data: intg, error: intgErr } = await userClient
      .from("integrations")
      .select("id, provider, mode, endpoint_url, client_code")
      .eq("id", integration_id)
      .maybeSingle();
    if (intgErr || !intg) return j(403, { error: "forbidden" });

    if (intg.provider !== "DB_DIAGNOSTICOS") {
      return j(400, { error: "provider_mismatch", detail: "Endpoint dedicado ao DBSync." });
    }

    const mode = (intg.mode as "MOCK" | "HOMOLOG" | "PROD") ?? "MOCK";
    const t0 = Date.now();

    if (mode === "MOCK") {
      const transport = createDBSyncTransport({ mode, endpoint: intg.endpoint_url ?? "" });
      const env = envelopeRecebeAtendimento({
        externalProtocol: "TEST-DB-0001",
        usuario: "mock", chave: "mock",
        exames: [{ codigoExame: "HMG" }],
      });
      const r = await transport.request(env);
      const p = parseRecebeAtendimento(r.body);
      return j(200, {
        ok: p.ok && !!p.data?.aceito,
        mode,
        durationMs: Date.now() - t0,
        parsed: p.data,
        fault: p.ok ? null : { code: "PARSE_ERROR", message: p.faultString },
      });
    }

    // HOMOLOG/PROD: chama RecebeAtendimento real com credenciais do tenant.
    if (!intg.endpoint_url) {
      return j(200, {
        ok: false, mode, durationMs: Date.now() - t0,
        fault: { code: "MISSING_ENDPOINT", message: "Endpoint SOAP não configurado." },
      });
    }
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const overrideUser = body?.username ? String(body.username) : null;
    const overridePass = body?.password ? String(body.password) : null;
    let usuario = overrideUser ?? "";
    let chave = overridePass ?? "";
    if (!usuario || !chave) {
      const { data: cred } = await admin
        .from("integration_credentials")
        .select("username, password_encrypted")
        .eq("integration_id", integration_id)
        .maybeSingle();
      usuario = usuario || (cred?.username ?? "");
      if (!chave && cred?.password_encrypted) {
        try { chave = await decryptSecret(cred.password_encrypted as string); }
        catch (e) {
          return j(500, { error: "credential_decrypt_failed", detail: String(e) });
        }
      }
    }
    if (!usuario || !chave) {
      return j(200, {
        ok: false, mode, durationMs: Date.now() - t0,
        fault: { code: "MISSING_CREDENTIALS", message: "Usuário/chave não configurados." },
      });
    }
    const transport = createDBSyncTransport({
      mode, endpoint: intg.endpoint_url ?? "",
      timeoutMs: 30_000,
    });
    try {
      const env = envelopeRecebeAtendimento({
        externalProtocol: `TEST-${Date.now()}`,
        usuario, chave,
        exames: [{ codigoExame: "TESTE" }],
      });
      const r = await transport.request(env);
      const p = parseRecebeAtendimento(r.body);
      return j(200, {
        ok: p.ok && !!p.data?.aceito,
        mode, durationMs: Date.now() - t0,
        statusCode: r.status, parsed: p.data,
        fault: p.ok ? null : { code: "FAULT", message: p.faultString ?? "Resposta inválida" },
      });
    } catch (e) {
      return j(200, {
        ok: false, mode, durationMs: Date.now() - t0,
        fault: { code: "NETWORK_ERROR", message: String((e as Error).message ?? e) },
      });
    }
  } catch (e) {
    console.error("[dbsync-test-connection] fatal", e);
    return j(500, { error: "internal_error" });
  }
});

function j(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}