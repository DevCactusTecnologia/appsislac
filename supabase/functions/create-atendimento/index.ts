// Edge function transacional: create-atendimento
// Insere atendimento + exames + pagamentos numa única transação via RPC
// `create_atendimento_tx`. Em caso de erro, ROLLBACK automático.
// - Valida JWT do usuário
// - Tenant validado dentro da RPC via current_tenant_id()

import { getUserClient, getUserTenantClient, resolveUserTenantId, MigrationBlockedError } from "../_shared/runtime/db.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ExamePayload {
  nome_exame: string;
  exame_id?: string | null;
  material?: string;
  status?: string;
  valor?: number;
  ordem?: number;
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

interface AtendimentoPayload {
  protocolo?: string;
  data?: string;
  paciente_id?: number | null;
  paciente_nome: string;
  paciente_cpf: string;
  paciente_nascimento?: string | null;
  solicitante?: string;
  convenio_id?: number;
  convenio_nome?: string;
  unidade_id?: string;
  motivo_cancelamento?: string | null;
  /** UUID gerado pelo cliente para prevenir duplicação em reenvios. */
  idempotency_key?: string | null;
}

interface RequestBody {
  atendimento: AtendimentoPayload;
  exames?: ExamePayload[];
  pagamentos?: PagamentoPayload[];
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

  // 1) Auth — propaga JWT para current_tenant_id() funcionar
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ ok: false, error: "Não autenticado" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Auth client (shared anon + user JWT) — só para validar sessão.
  const auth = getUserClient(authHeader);
  const { data: userData, error: userErr } = await auth.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(
      JSON.stringify({ ok: false, error: "Sessão inválida" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Tenant-aware client (roteia shared/dedicated preservando JWT).
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

  // 1.b) RBAC server-side — defesa em profundidade.
  // Visibility is UX. Authorization is security. Nunca confiar só no frontend.
  {
    const { data: allowed, error: permErr } = await supabase.rpc("has_permission", {
      _user_id: userData.user.id,
      _permission: "criar_atendimento",
    });
    if (permErr) {
      console.error("[create-atendimento] has_permission error", { user: userData.user.id, code: permErr.code, message: permErr.message });
      return new Response(
        JSON.stringify({ ok: false, error: "Falha ao validar permissão" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!allowed) {
      return new Response(
        JSON.stringify({ ok: false, error: "Sem permissão para criar atendimento", code: "permission_denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  }

  // 2) Payload
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return badRequest("JSON inválido");
  }

  if (!body || !body.atendimento || typeof body.atendimento !== "object") {
    return badRequest("atendimento obrigatório");
  }
  if (!body.atendimento.paciente_nome || typeof body.atendimento.paciente_nome !== "string") {
    return badRequest("paciente_nome obrigatório");
  }
  if (typeof body.atendimento.paciente_cpf !== "string") {
    return badRequest("paciente_cpf deve ser string");
  }
  if (body.exames !== undefined && !Array.isArray(body.exames)) {
    return badRequest("exames deve ser array");
  }
  if (body.pagamentos !== undefined && !Array.isArray(body.pagamentos)) {
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

  // 3) RPC transacional
  const { data, error } = await supabase.rpc("create_atendimento_tx", {
    _atendimento: body.atendimento as unknown as Record<string, unknown>,
    _exames: (body.exames ?? null) as unknown as Record<string, unknown> | null,
    _pagamentos: (body.pagamentos ?? null) as unknown as Record<string, unknown> | null,
  });

  if (error) {
    const status = error.code === "42501" ? 403 : error.code === "22023" ? 400 : 500;
    console.error("[create-atendimento] rpc error", {
      user: userData.user.id,
      code: error.code,
      message: error.message,
    });
    
    // Hardening: Nunca retornar error.message diretamente.
    const safeMessage = error.code === "23505" ? "Este atendimento ou protocolo já existe." :
                       error.code === "42501" ? "Sem permissão." :
                       "Erro ao salvar atendimento.";

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