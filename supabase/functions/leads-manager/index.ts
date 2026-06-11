import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  jsonResponse,
  errorResponse,
  preflight,
  newRequestId,
  createLogger,
} from "../_shared/hardening.ts";

interface Body {
  action: "submit" | "verify" | "resend";
  // For submit
  nome_responsavel?: string;
  whatsapp?: string;
  nome_laboratorio?: string;
  cidade?: string;
  estado?: string;
  quantidade_unidades?: string;
  // For verify/resend
  lead_id?: string;
  code?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const requestId = newRequestId(req);
  const log = createLogger("leads-manager", requestId);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const body = (await req.json()) as Body;
    const { action } = body;

    if (action === "submit") {
      const { nome_responsavel, whatsapp, nome_laboratorio, cidade, estado, quantidade_unidades } = body;
      
      if (!nome_responsavel || !whatsapp || !nome_laboratorio) {
        return errorResponse(400, "Campos obrigatórios ausentes", requestId, log);
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10);

      const { data: lead, error: insertError } = await admin
        .from("inscricoes")
        .insert({
          nome_responsavel,
          whatsapp,
          nome_laboratorio,
          cidade,
          estado,
          quantidade_unidades,
          status: "Nova",
          codigo_validacao: code,
          codigo_expira_em: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        return errorResponse(500, "Erro ao registrar interesse", requestId, log, insertError);
      }

      // Enviar WhatsApp (Mock por enquanto ou usar config global se existir)
      log.info(`Enviando código ${code} para ${whatsapp}`);
      
      // Tenta buscar config global do WhatsApp
      const { data: globalWpp } = await admin.from("app_settings").select("value").eq("key", "whatsapp_config").maybeSingle();
      if (globalWpp?.value) {
        const cfg = globalWpp.value;
        if (cfg.provider === "meta" && cfg.phoneNumberId && cfg.accessToken) {
          try {
            await fetch(`https://graph.facebook.com/v21.0/${cfg.phoneNumberId}/messages`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${cfg.accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                to: whatsapp.replace(/\D/g, ""),
                type: "text",
                text: { body: `Seu código de confirmação SISLAC é: ${code}` },
              }),
            });
          } catch (e) {
            log.error("Falha ao enviar WhatsApp real", e);
          }
        }
      }

      return jsonResponse(200, { ok: true, lead_id: lead.id }, requestId);
    }

    if (action === "verify") {
      const { lead_id, code } = body;
      if (!lead_id || !code) return errorResponse(400, "ID ou código ausente", requestId, log);

      const { data: lead, error: fetchError } = await admin
        .from("inscricoes")
        .select("*")
        .eq("id", lead_id)
        .maybeSingle();

      if (fetchError || !lead) return errorResponse(404, "Inscrição não encontrada", requestId, log);

      if (lead.codigo_validacao !== code) {
        return errorResponse(400, "Código inválido", requestId, log);
      }

      const expiresAt = new Date(lead.codigo_expira_em);
      if (expiresAt < new Date()) {
        return errorResponse(400, "Código expirado", requestId, log);
      }

      const { error: updateError } = await admin
        .from("inscricoes")
        .update({
          whatsapp_confirmado: true,
          status: "Confirmada",
          codigo_validacao: null,
          codigo_expira_em: null,
        })
        .eq("id", lead_id);

      if (updateError) return errorResponse(500, "Erro ao confirmar", requestId, log, updateError);

      return jsonResponse(200, { ok: true }, requestId);
    }

    if (action === "resend") {
      const { lead_id } = body;
      if (!lead_id) return errorResponse(400, "ID ausente", requestId, log);

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10);

      const { data: lead, error: updateError } = await admin
        .from("inscricoes")
        .update({
          codigo_validacao: code,
          codigo_expira_em: expiresAt.toISOString(),
        })
        .eq("id", lead_id)
        .select()
        .single();

      if (updateError || !lead) return errorResponse(500, "Erro ao reenviar", requestId, log, updateError);

      // Re-enviar WhatsApp logic (same as submit)
      log.info(`Re-enviando código ${code} para ${lead.whatsapp}`);
      // ... (WhatsApp send logic)

      return jsonResponse(200, { ok: true }, requestId);
    }

    return errorResponse(400, "Ação inválida", requestId, log);
  } catch (err) {
    return errorResponse(500, "Erro interno", requestId, log, err);
  }
});
