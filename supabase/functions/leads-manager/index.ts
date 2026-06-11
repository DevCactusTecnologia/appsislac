import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  jsonResponse,
  errorResponse,
  preflight,
  newRequestId,
  createLogger,
} from "../_shared/hardening.ts";
import { checkRateLimit, extractIp } from "../_shared/rateLimit.ts";

interface Body {
  action: "submit" | "verify" | "resend";
  nome_responsavel?: string;
  whatsapp?: string;
  nome_laboratorio?: string;
  cidade?: string;
  estado?: string;
  quantidade_unidades?: string;
  lead_id?: string;
  code?: string;
}

const OTP_TTL_MIN = 5;
const OTP_MAX_TENTATIVAS = 5;

/** OTP criptograficamente seguro (6 dígitos, zero-padded). */
function generateSecureOtp(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const code = (buf[0] % 1_000_000).toString().padStart(6, "0");
  return code;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const requestId = newRequestId(req);
  const log = createLogger("leads-manager", requestId);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const ip = extractIp(req);

  try {
    const body = (await req.json()) as Body;
    const { action } = body;

    if (action === "submit") {
      const { nome_responsavel, whatsapp, nome_laboratorio, cidade, estado, quantidade_unidades } = body;

      if (!nome_responsavel || !whatsapp || !nome_laboratorio) {
        return errorResponse(400, "Campos obrigatórios ausentes", requestId, log);
      }

      // Rate limit por IP — submit
      const rl = await checkRateLimit(admin, "leads-manager:submit", `ip:${ip}`, { windowSec: 60, max: 5 });
      if (!rl.allowed) {
        log.warn("rate_limited", { ip, attempts: rl.attempts });
        return errorResponse(429, "Muitas tentativas. Tente novamente em instantes.", requestId, log);
      }

      const code = generateSecureOtp();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + OTP_TTL_MIN);

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
          tentativas_codigo: 0,
        })
        .select()
        .single();

      if (insertError) {
        return errorResponse(500, "Erro ao registrar interesse", requestId, log, insertError);
      }

      log.info(`OTP gerado para ${whatsapp} (lead ${lead.id})`);

      const { data: globalWpp } = await admin
        .from("app_settings").select("value").eq("key", "whatsapp_config").maybeSingle();
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

      // Rate limit por lead_id — verify
      const rl = await checkRateLimit(admin, "leads-manager:verify", `lead:${lead_id}`, { windowSec: 60, max: 5 });
      if (!rl.allowed) {
        return errorResponse(429, "Muitas tentativas. Aguarde alguns minutos.", requestId, log);
      }

      const { data: lead, error: fetchError } = await admin
        .from("inscricoes")
        .select("*")
        .eq("id", lead_id)
        .maybeSingle();

      if (fetchError || !lead) return errorResponse(404, "Inscrição não encontrada", requestId, log);

      // Limite de tentativas por código
      const tentativas = (lead.tentativas_codigo ?? 0) as number;
      if (tentativas >= OTP_MAX_TENTATIVAS) {
        // Expira o código automaticamente
        await admin.from("inscricoes")
          .update({ codigo_validacao: null, codigo_expira_em: null })
          .eq("id", lead_id);
        return errorResponse(429, "Número máximo de tentativas excedido. Solicite novo código.", requestId, log);
      }

      if (lead.codigo_validacao !== code) {
        await admin.from("inscricoes")
          .update({ tentativas_codigo: tentativas + 1 })
          .eq("id", lead_id);
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
          tentativas_codigo: 0,
        })
        .eq("id", lead_id);

      if (updateError) return errorResponse(500, "Erro ao confirmar", requestId, log, updateError);

      return jsonResponse(200, { ok: true }, requestId);
    }

    if (action === "resend") {
      const { lead_id } = body;
      if (!lead_id) return errorResponse(400, "ID ausente", requestId, log);

      const rl = await checkRateLimit(admin, "leads-manager:resend", `lead:${lead_id}`, { windowSec: 60, max: 3 });
      if (!rl.allowed) {
        return errorResponse(429, "Aguarde antes de solicitar novo código.", requestId, log);
      }

      const code = generateSecureOtp();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + OTP_TTL_MIN);

      const { data: lead, error: updateError } = await admin
        .from("inscricoes")
        .update({
          codigo_validacao: code,
          codigo_expira_em: expiresAt.toISOString(),
          tentativas_codigo: 0,
        })
        .eq("id", lead_id)
        .select()
        .single();

      if (updateError || !lead) return errorResponse(500, "Erro ao reenviar", requestId, log, updateError);

      log.info(`OTP re-gerado para lead ${lead.id}`);

      return jsonResponse(200, { ok: true }, requestId);
    }

    return errorResponse(400, "Ação inválida", requestId, log);
  } catch (err) {
    return errorResponse(500, "Erro interno", requestId, log, err);
  }
});
