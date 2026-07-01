import {
  getPlatformClient,
  getTenantClient,
  getUserClient,
  MigrationBlockedError,
} from "../_shared/runtime/db.ts";
import { jsonResponse, errorResponse, preflight, newRequestId, createLogger } from "../_shared/hardening.ts";

interface SignRequest {
  resultado_id: number;
  aprovado_por?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const requestId = newRequestId(req);
  const log = createLogger("sign-resultado", requestId);

  if (req.method !== "POST") return errorResponse(405, "Method not allowed", requestId, log);

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = getUserClient(authHeader);
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return errorResponse(401, "Não autenticado", requestId, log);

  let body: SignRequest;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "JSON inválido", requestId, log);
  }

  const { resultado_id, aprovado_por } = body;
  if (!resultado_id) return errorResponse(400, "resultado_id obrigatório", requestId, log);

  // Control-plane: perfil do usuário resolve o tenant.
  const platform = getPlatformClient();
  const { data: userProfile } = await platform
    .from("user_profiles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .single();

  if (!userProfile?.tenant_id) {
    return errorResponse(403, "Sem acesso", requestId, log);
  }

  // Data-plane tenant-aware: roteia shared/dedicated (Fase 8 — sem fallback).
  let tenantDb;
  try {
    tenantDb = await getTenantClient(userProfile.tenant_id as string);
  } catch (e) {
    if (e instanceof MigrationBlockedError) {
      return errorResponse(503, `Runtime dedicado indisponível (${e.code})`, requestId, log);
    }
    throw e;
  }

  const { data: resultado } = await tenantDb
    .from("resultados")
    .select("id, data")
    .eq("id", resultado_id)
    .eq("tenant_id", userProfile.tenant_id)
    .single();

  if (!resultado) return errorResponse(404, "Resultado não encontrado", requestId, log);

  try {
    const jsonString = JSON.stringify(resultado);
    const encoder = new TextEncoder();
    const data = encoder.encode(jsonString);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    const { error: signErr } = await tenantDb
      .from("resultado_assinado")
      .insert({
        resultado_id,
        tenant_id: userProfile.tenant_id,
        assinado_por: user.id,
        hash_resultado: hashHex,
        bloqueado: true,
        aprovado_por: aprovado_por || null,
        data_aprovacao: aprovado_por ? new Date().toISOString() : null,
      });

    if (signErr) {
      log.error("Erro ao assinar", { err: signErr.message });
      return errorResponse(500, `Erro ao assinar: ${signErr.message}`, requestId, log);
    }

    await tenantDb.from("resultado_acesso_log").insert({
      resultado_id,
      tenant_id: userProfile.tenant_id,
      acessado_por: user.id,
      operacao: "ASSINADO",
      ip_address: req.headers.get("x-forwarded-for") || "unknown",
      razao: "RDC: Assinatura eletrônica",
    });

    log.info("resultado assinado", { resultadoId: resultado_id });
    return jsonResponse(200, {
      ok: true,
      message: "Resultado assinado com sucesso (RDC)",
      hash: hashHex,
      signed_at: new Date().toISOString(),
    }, requestId);
  } catch (err) {
    log.error("erro ao assinar", { err: String(err) });
    return errorResponse(500, "Erro ao assinar", requestId, log);
  }
});
