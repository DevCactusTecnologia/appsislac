import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { jsonResponse, errorResponse, preflight, newRequestId, createLogger } from "../_shared/hardening.ts";

interface DeletarRequest {
  paciente_id: number;
  motivo: string;
  confirmar: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const requestId = newRequestId(req);
  const log = createLogger("lgpd-deletar-paciente", requestId);

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

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: isSuper, error: rErr } = await admin.rpc("is_super_admin", { _user_id: user.id });
  if (rErr || !isSuper) return errorResponse(403, "Apenas super admin", requestId, log);

  let body: DeletarRequest;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "JSON inválido", requestId, log);
  }

  const { paciente_id, motivo, confirmar } = body;
  if (!paciente_id || !motivo || !confirmar) {
    return errorResponse(400, "Todos os campos obrigatórios + confirmar = true", requestId, log);
  }

  const { data: paciente } = await admin
    .from("pacientes")
    .select("tenant_id, id")
    .eq("id", paciente_id)
    .single();

  if (!paciente) return errorResponse(404, "Paciente não encontrado", requestId, log);

  const { error: logErr } = await admin
    .from("deletacao_paciente_log")
    .insert({
      paciente_id,
      tenant_id: paciente.tenant_id,
      motivo,
      deletado_por: user.id,
      status: "em_progresso",
    });

  if (logErr) return errorResponse(500, `Erro ao registrar: ${logErr.message}`, requestId, log);

  try {
    const tabelas_deletadas: string[] = [];
    let total_registros = 0;

    const { count: attCount } = await admin
      .from("atendimentos")
      .select("*", { count: "exact", head: true })
      .eq("paciente_id", paciente_id);

    if (attCount) {
      tabelas_deletadas.push("atendimentos");
      total_registros += attCount;
      await admin.from("atendimentos").delete().eq("paciente_id", paciente_id);
    }

    const { count: consentCount } = await admin
      .from("consentimento_paciente")
      .select("*", { count: "exact", head: true })
      .eq("paciente_id", paciente_id);

    if (consentCount) {
      tabelas_deletadas.push("consentimento_paciente");
      total_registros += consentCount;
      await admin.from("consentimento_paciente").delete().eq("paciente_id", paciente_id);
    }

    await admin.from("pacientes").delete().eq("id", paciente_id);
    tabelas_deletadas.push("pacientes");
    total_registros += 1;

    await admin
      .from("deletacao_paciente_log")
      .update({
        status: "completo",
        tabelas_afetadas: tabelas_deletadas,
        registros_deletados: total_registros,
      })
      .eq("paciente_id", paciente_id);

    log.info("paciente deletado", { pacienteId: paciente_id, registrosDeletados: total_registros });
    return jsonResponse(200, {
      ok: true,
      message: "Paciente deletado com sucesso (LGPD - Direito ao esquecimento)",
      registros_deletados: total_registros,
      tabelas_afetadas: tabelas_deletadas,
    }, requestId);
  } catch (err) {
    log.error("erro ao deletar", { err: String(err) });
    return errorResponse(500, `Erro ao deletar: ${String(err)}`, requestId, log);
  }
});