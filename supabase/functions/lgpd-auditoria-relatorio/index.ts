import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { jsonResponse, errorResponse, preflight, newRequestId, createLogger } from "../_shared/hardening.ts";

interface RelatorioRequest {
  paciente_id?: number;
  data_inicio?: string;
  data_fim?: string;
  tipo?: "LGPD" | "RDC" | "COMPLETO";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const requestId = newRequestId(req);
  const log = createLogger("lgpd-auditoria-relatorio", requestId);

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
  const { data: userProfile } = await admin
    .from("user_profiles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .single();

  if (!userProfile?.tenant_id) {
    return errorResponse(403, "Sem acesso", requestId, log);
  }

  let body: RelatorioRequest;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "JSON inválido", requestId, log);
  }

  const {
    paciente_id,
    data_inicio = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    data_fim = new Date().toISOString(),
    tipo = "COMPLETO",
  } = body;

  const relatorio: any = {
    gerado_em: new Date().toISOString(),
    tenant_id: userProfile.tenant_id,
    periodo: { data_inicio, data_fim },
    secoes: {},
  };

  try {
    if (tipo === "LGPD" || tipo === "COMPLETO") {
      const { data: acessos } = await admin
        .from("resultado_acesso_log")
        .select("*")
        .eq("tenant_id", userProfile.tenant_id)
        .gte("data_acesso", data_inicio)
        .lte("data_acesso", data_fim)
        .limit(500);

      relatorio.secoes.LGPD_acessos = acessos || [];

      const { data: consentimentos } = await admin
        .from("consentimento_paciente")
        .select("*")
        .eq("tenant_id", userProfile.tenant_id);

      relatorio.secoes.LGPD_consentimentos = consentimentos || [];
    }

    if (tipo === "RDC" || tipo === "COMPLETO") {
      const { data: assinados } = await admin
        .from("resultado_assinado")
        .select("*")
        .eq("tenant_id", userProfile.tenant_id)
        .gte("data_assinatura", data_inicio)
        .lte("data_assinatura", data_fim)
        .limit(500);

      relatorio.secoes.RDC_resultados_assinados = assinados || [];
    }

    const { data: auditoria } = await admin
      .from("audit_log")
      .select("*")
      .eq("tenant_id", userProfile.tenant_id)
      .gte("created_at", data_inicio)
      .lte("created_at", data_fim)
      .limit(500);

    relatorio.secoes.auditoria_geral = {
      total_operacoes: auditoria?.length || 0,
      operacoes: auditoria || [],
    };

    log.info("relatorio gerado", { tipo, operacoes: auditoria?.length || 0 });
    return jsonResponse(200, { ok: true, relatorio }, requestId);
  } catch (err) {
    log.error("erro ao gerar relatorio", { err: String(err) });
    return errorResponse(500, "Erro ao gerar relatório", requestId, log);
  }
});