// Edge function transacional: update-atendimento
// Garante BEGIN/COMMIT/ROLLBACK via RPC SQL `update_atendimento_tx`.
// - Valida JWT do usuário
// - Valida tenant via current_tenant_id() dentro da RPC
// - Em caso de erro em QUALQUER etapa (delete/insert/update), todo o efeito é
//   revertido pelo PostgreSQL automaticamente.

import { getUserClient, getUserTenantClient, resolveUserTenantId, MigrationBlockedError } from "../_shared/runtime/db.ts";

import { corsHeaders } from "../_shared/cors.ts";
interface ExamePayload {
  nome_exame: string;
  exame_id?: string | null;
  material?: string;
  status?: string;
  valor?: number;
  ordem?: number;
  motivo_cancelamento?: string | null;
  cobranca_destino?: "paciente" | "convenio";
  convenio_cobranca_id?: number | null;
  amostra_seq?: number;
  grupo_exame_id?: string | null;
  tipo_processo?: "INTERNO" | "TERCEIRIZADO";
  lab_apoio_id?: string | null;
  solicitante?: string;
}

interface PagamentoPayload {
  tipo: string;
  valor: number;
  data?: string;
}

interface RequestBody {
  atendimento_id: number;
  patch?: Record<string, unknown> | null;
  exames?: ExamePayload[] | null;
  pagamentos?: PagamentoPayload[] | null;
  cancelar_tudo?: boolean;
  motivo_cancel?: string | null;
  justificativa?: string | null;
}

/**
 * Decide qual permissão server-side é exigida para um payload de update.
 * RBAC ponta a ponta: visibility é UX, authorization é segurança.
 *
 * - cancelamento  → cancelar_atendimento
 * - somente pagamentos (sem patch/exames) → registrar_pagamento
 * - resto → editar_atendimento
 *
 * Exportado para permitir teste unitário sem subir HTTP/DB.
 */
export function requiredPermissionForUpdate(body: RequestBody): string {
  const patch = (body.patch ?? null) as Record<string, unknown> | null;
  const status = patch && (patch as { statusAtendimento?: { label?: string } }).statusAtendimento;
  const isCancel =
    body.cancelar_tudo === true ||
    (typeof body.motivo_cancel === "string" && body.motivo_cancel.trim().length > 0) ||
    (status?.label === "Pedido cancelado" || status?.label === "Cancelado");
  if (isCancel) return "cancelar_atendimento";

  const hasPatch = patch && Object.keys(patch).length > 0;
  const hasExames = Array.isArray(body.exames) && body.exames.length > 0;
  const hasPagamentos = Array.isArray(body.pagamentos) && body.pagamentos.length > 0;

  if (!hasPatch && !hasExames && hasPagamentos) return "registrar_pagamento";
  return "editar_atendimento";
}

function badRequest(msg: string, extra?: unknown) {
  return new Response(
    JSON.stringify({ ok: false, error: msg, detail: extra ?? null }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return badRequest("método não suportado");
  }

  // 1) Auth — propaga o JWT do chamador para que current_tenant_id() funcione.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ ok: false, error: "Não autenticado" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const auth = getUserClient(authHeader);
  const { data: userData, error: userErr } = await auth.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(
      JSON.stringify({ ok: false, error: "Sessão inválida" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let supabase;
  try {
    const tenantId = await resolveUserTenantId(userData.user.id);
    if (!tenantId) {
      return new Response(
        JSON.stringify({ ok: false, error: "Tenant do usuário não encontrado" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    supabase = await getUserTenantClient(authHeader, tenantId);
  } catch (e) {
    if (e instanceof MigrationBlockedError) {
      return new Response(
        JSON.stringify({ ok: false, error: "Runtime dedicado indisponível", code: e.code }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    throw e;
  }

  // 2) Payload
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return badRequest("JSON inválido");
  }

  if (!body || typeof body.atendimento_id !== "number" || !Number.isFinite(body.atendimento_id)) {
    return badRequest("atendimento_id obrigatório");
  }
  if (body.exames !== undefined && body.exames !== null && !Array.isArray(body.exames)) {
    return badRequest("exames deve ser array");
  }
  if (body.pagamentos !== undefined && body.pagamentos !== null && !Array.isArray(body.pagamentos)) {
    return badRequest("pagamentos deve ser array");
  }
  if (body.exames) {
    for (const e of body.exames) {
      if (!e.nome_exame || typeof e.nome_exame !== "string") {
        return badRequest("exame.nome_exame obrigatório");
      }
    }
  }
  if (body.pagamentos) {
    for (const p of body.pagamentos) {
      if (!p.tipo || typeof p.valor !== "number") {
        return badRequest("pagamento.tipo e pagamento.valor obrigatórios");
      }
    }
  }

  // 2.b) RBAC server-side — defesa em profundidade.
  // Decidimos a permissão exigida com base no payload e validamos via has_permission().
  {
    const required = requiredPermissionForUpdate(body);
    const { data: allowed, error: permErr } = await supabase.rpc("has_permission", {
      _user_id: userData.user.id,
      _permission: required,
    });
    if (permErr) {
      console.error("[update-atendimento] has_permission error", { user: userData.user.id, code: permErr.code, message: permErr.message });
      return new Response(
        JSON.stringify({ ok: false, error: "Falha ao validar permissão" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!allowed) {
      return new Response(
        JSON.stringify({ ok: false, error: `Sem permissão (${required})`, code: "permission_denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  }

  // 3) Justificativa de auditoria — agora passada diretamente para a RPC
  // para garantir que seja executada na mesma conexão/sessão do banco.
  const just = (body.justificativa ?? "").trim();

  // 4) RPC transacional — BEGIN/COMMIT/ROLLBACK gerenciados pelo PostgreSQL.
  const { data, error } = await supabase.rpc("update_atendimento_tx", {
    _atendimento_id: body.atendimento_id,
    _patch: body.patch ?? {},
    _exames: body.exames ?? null,
    _pagamentos: body.pagamentos ?? null,
    _cancelar_tudo: !!body.cancelar_tudo,
    _motivo_cancel: body.motivo_cancel ?? null,
    _justificativa: just.length >= 5 ? just : null,
  });

  if (error) {
    // Erros 42501 = RLS/tenant; 42704 = não encontrado
    const status = error.code === "42501" ? 403 : error.code === "42704" ? 404 : 500;
    console.error("[update-atendimento] rpc error", {
      user: userData.user.id,
      atendimento_id: body.atendimento_id,
      code: error.code,
      message: error.message,
    });

    // Hardening: Sanitização manual para manter compatibilidade local sem edgeBoot completo
    const safeMessage = error.code === "42501" ? "Sem permissão." :
                       error.code === "42704" ? "Atendimento não encontrado." :
                       "Erro ao atualizar atendimento.";

    return new Response(
      JSON.stringify({
        ok: false,
        error: safeMessage,
        code: error.code ?? "unknown",
      }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(JSON.stringify(data ?? { ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});