// Resolve um codigo de shortlink → retorna a URL assinada do PDF.
// Pública (sem JWT). Incrementa contador de acessos.
// Usada pela rota /p/:codigo no frontend para fazer o redirect.

import { createClient } from "../_shared/runtime/createClient.ts";
import {
  createLogger,
  errorResponse,
  jsonResponse,
  newRequestId,
  preflight,
} from "../_shared/hardening.ts";
import { checkRateLimit, extractIp } from "../_shared/rateLimit.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const requestId = newRequestId(req);
  const log = createLogger("comprovante-resolve", requestId);

  if (req.method !== "GET") {
    return errorResponse(405, "method not allowed", requestId, log);
  }

  const url = new URL(req.url);
  const codigo = (url.searchParams.get("codigo") ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{4,12}$/.test(codigo)) {
    return errorResponse(400, "codigo invalido", requestId, log);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return errorResponse(500, "service unavailable", requestId, log);
  }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // P0 #3 — rate-limit por IP + por código (anti brute-force)
  const ip = extractIp(req);
  const rlIp = await checkRateLimit(admin, "comprovante-resolve", `ip:${ip}`, { windowSec: 60, max: 30 });
  if (!rlIp.allowed) {
    return errorResponse(429, "Muitas tentativas. Aguarde alguns minutos.", requestId, log);
  }
  const rlCod = await checkRateLimit(admin, "comprovante-resolve", `codigo:${codigo}`, { windowSec: 60, max: 5 });
  if (!rlCod.allowed) {
    return errorResponse(429, "Muitas tentativas para este código.", requestId, log);
  }

  const { data: link, error } = await admin
    .from("comprovante_links")
    .select("id, url_assinada, expira_em, tipo, atendimento_protocolo")
    .eq("codigo", codigo)
    .maybeSingle();

  if (error) return errorResponse(502, "erro ao buscar link", requestId, log, error);
  if (!link) return errorResponse(404, "link nao encontrado", requestId, log);

  if (new Date(link.expira_em).getTime() < Date.now()) {
    return errorResponse(410, "link expirado", requestId, log);
  }

  // best-effort: incrementa contador
  void admin
    .from("comprovante_links")
    .update({
      acessos: (link as unknown as { acessos?: number }).acessos
        ? ((link as unknown as { acessos?: number }).acessos as number) + 1
        : 1,
      ultimo_acesso_em: new Date().toISOString(),
    })
    .eq("id", link.id);

  return jsonResponse(
    200,
    {
      url: link.url_assinada,
      tipo: link.tipo,
      protocolo: link.atendimento_protocolo,
      expiraEm: link.expira_em,
    },
    requestId,
  );
});