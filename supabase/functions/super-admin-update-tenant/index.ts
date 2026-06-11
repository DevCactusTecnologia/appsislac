// Edge function super-admin-update-tenant
// Atualiza status (ativo/suspenso), plano ou metadados de um tenant.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { jsonResponse, errorResponse, preflight, newRequestId, createLogger } from "../_shared/hardening.ts";

interface Body {
  tenantId?: unknown;
  status?: unknown;
  plano?: unknown;
  nome?: unknown;
  cnpj?: unknown;
  emailContato?: unknown;
  telefone?: unknown;
  cidade?: unknown;
  estado?: unknown;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const requestId = newRequestId(req);
  const log = createLogger("super-admin-update-tenant", requestId);
  if (req.method !== "POST") return errorResponse(405, "Method not allowed", requestId, log);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) return errorResponse(500, "Server misconfiguration", requestId, log);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user: caller }, error: cErr } = await userClient.auth.getUser();
  if (cErr || !caller) return errorResponse(401, "Não autenticado", requestId, log);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: isSuper } = await admin.rpc("is_super_admin", { _user_id: caller.id });
  if (!isSuper) return errorResponse(403, "Apenas super admins", requestId, log);

  let body: Body;
  try { body = await req.json() as Body; } catch {
    return errorResponse(400, "JSON inválido", requestId, log);
  }
  const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
  if (!tenantId) return errorResponse(400, "tenantId obrigatório", requestId, log);

  const updates: Record<string, unknown> = {};
  if (typeof body.status === "string" && ["ativo", "suspenso", "inativo"].includes(body.status)) updates.status = body.status;
  if (typeof body.plano === "string") updates.plano = body.plano;
  if (typeof body.nome === "string" && body.nome.trim()) updates.nome = body.nome.trim();
  if (typeof body.cnpj === "string") updates.cnpj = body.cnpj.trim();
  if (typeof body.emailContato === "string") updates.email_contato = body.emailContato.trim();
  if (typeof body.telefone === "string") updates.telefone = body.telefone.trim();
  if (typeof body.cidade === "string") updates.cidade = body.cidade.trim();
  if (typeof body.estado === "string") updates.estado = body.estado.trim().toUpperCase().slice(0, 2);

  if (Object.keys(updates).length === 0) return errorResponse(400, "Nada para atualizar", requestId, log);

  const { data, error } = await admin
    .from("tenants")
    .update(updates)
    .eq("id", tenantId)
    .select()
    .single();
  if (error) return errorResponse(500, "Erro ao atualizar tenant", requestId, log, error);

  // Se o tenant foi suspenso/inativado, força logout imediato de todos os usuários:
  // revoga refresh tokens (signOut global) e toca profiles para disparar realtime
  // no AuthContext, que então faz signOut local na hora.
  if (typeof updates.status === "string" && updates.status !== "ativo") {
    try {
      const { data: profs } = await admin
        .from("profiles")
        .select("user_id")
        .eq("tenant_id", tenantId);
      const userIds = (profs ?? []).map((p: { user_id: string }) => p.user_id).filter(Boolean);
      await Promise.all(
        userIds.map(async (uid) => {
          try { await admin.auth.admin.signOut(uid, "global"); }
          catch (e) { log.warn("signOut falhou", { uid, e: String(e) }); }
        }),
      );
      await admin
        .from("profiles")
        .update({ updated_at: new Date().toISOString() })
        .eq("tenant_id", tenantId);
      log.info("usuarios deslogados por suspensão", { tenantId, count: userIds.length });
    } catch (e) {
      log.warn("falha ao revogar sessões do tenant", { tenantId, e: String(e) });
    }
  }

  log.info("tenant atualizado", { tenantId, updates });
  return jsonResponse(200, { ok: true, tenant: data }, requestId);
});
