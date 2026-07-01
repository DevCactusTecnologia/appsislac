import { createClient } from "../_shared/runtime/createClient.ts";
import { jsonResponse, errorResponse, preflight, newRequestId, createLogger } from "../_shared/hardening.ts";

interface ConsentimentoRequest {
  paciente_id: number;
  tipo: "coleta_dados" | "processamento" | "compartilhamento";
  consentido: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const requestId = newRequestId(req);
  const log = createLogger("lgpd-consentimento", requestId);

  if (req.method !== "POST") return errorResponse(405, "Method not allowed", requestId, log);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    return errorResponse(500, "Server misconfiguration", requestId, log);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return errorResponse(401, "Não autenticado", requestId, log);

  let body: ConsentimentoRequest;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "JSON inválido", requestId, log);
  }

  const { paciente_id, tipo, consentido } = body;
  if (!paciente_id || !tipo) {
    return errorResponse(400, "paciente_id e tipo obrigatórios", requestId, log);
  }

  if (!["coleta_dados", "processamento", "compartilhamento"].includes(tipo)) {
    return errorResponse(400, "tipo inválido", requestId, log);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: userProfile } = await admin
    .from("user_profiles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .single();

  if (!userProfile?.tenant_id) {
    return errorResponse(403, "Sem acesso", requestId, log);
  }

  const { data, error } = await admin
    .from("consentimento_paciente")
    .upsert({
      paciente_id,
      tenant_id: userProfile.tenant_id,
      tipo,
      consentido,
      ip_address: req.headers.get("x-forwarded-for") || "unknown",
      device_id: req.headers.get("user-agent") || "unknown",
    });

  if (error) {
    log.error("erro ao registrar consentimento", { err: error.message });
    return errorResponse(500, `Erro: ${error.message}`, requestId, log);
  }

  log.info("consentimento registrado", { pacienteId: paciente_id, tipo, consentido });
  return jsonResponse(200, {
    ok: true,
    message: `Consentimento de "${tipo}" registrado (LGPD)`,
    data,
  }, requestId);
});