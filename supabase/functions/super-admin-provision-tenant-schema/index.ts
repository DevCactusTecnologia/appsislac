// Edge function: super-admin-provision-tenant-schema
//
// Fase 1 — Provisionamento do schema mínimo do SISLAC no BANCO DEDICADO
// de um tenant (Supabase project-per-tenant ou Postgres externo).
//
// O que faz:
//   1. Valida super admin.
//   2. Lê metadados de conexão em tenant_registry + senha do Vault (secret ref).
//   3. Conecta via postgres.js e roda o SCHEMA_MINIMO (idempotente).
//   4. Grava schema_provisioned_at = now() em tenant_registry.
//
// O que NÃO faz (fica para próximas iterações desta fase):
//   - Migração de dados do shared → dedicated (Fase 3).
//   - Criação de auth.users no projeto dedicado (auth continua shared).
//   - Provisionar RLS por tenant_id (banco é 100% do tenant, sem multi-tenant).
//
// IMPORTANTE: até `schema_provisioned_at` ser preenchido, o runtime frontend
// deve continuar roteando este tenant para o shared (fail-safe).

import { createClient } from "../_shared/runtime/createClient.ts";
import { Client } from "https://deno.land/x/postgres@v0.19.3/mod.ts";
import { jsonResponse, errorResponse, preflight, newRequestId, createLogger } from "../_shared/hardening.ts";

const SECRET_REF_RE = /^[A-Z][A-Z0-9_]{2,63}$/;

// ─── Schema mínimo v1 ────────────────────────────────────────────────
// Idempotente (CREATE ... IF NOT EXISTS). Cada bloco é um "statement" contado.
// A tabela `_sislac_health_check` prova que o provisionamento rodou.
// As demais são o núcleo operacional que a Fase 2 vai começar a rotear.
const SCHEMA_MINIMO_V1: string[] = [
  // Extensões usadas por defaults e chaves.
  `CREATE EXTENSION IF NOT EXISTS "pgcrypto"`,

  // Health check: comprovante do provisionamento.
  `CREATE TABLE IF NOT EXISTS public._sislac_health_check (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    schema_version text NOT NULL,
    provisioned_at timestamptz NOT NULL DEFAULT now(),
    note text
  )`,

  // Pacientes (núcleo operacional).
  `CREATE TABLE IF NOT EXISTS public.pacientes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    cpf text,
    data_nascimento date,
    sexo text,
    telefone text,
    email text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_pacientes_nome ON public.pacientes (lower(nome))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_pacientes_cpf ON public.pacientes (cpf) WHERE cpf IS NOT NULL`,

  // Atendimentos.
  `CREATE TABLE IF NOT EXISTS public.atendimentos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
    codigo text,
    status text NOT NULL DEFAULT 'aberto',
    data_atendimento timestamptz NOT NULL DEFAULT now(),
    valor_total numeric(12,2) NOT NULL DEFAULT 0,
    valor_pago numeric(12,2) NOT NULL DEFAULT 0,
    observacoes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_atendimentos_paciente ON public.atendimentos(paciente_id)`,
  `CREATE INDEX IF NOT EXISTS idx_atendimentos_data ON public.atendimentos(data_atendimento DESC)`,

  // Exames de atendimento (item).
  `CREATE TABLE IF NOT EXISTS public.atendimento_exames (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    atendimento_id uuid NOT NULL REFERENCES public.atendimentos(id) ON DELETE CASCADE,
    exame_codigo text NOT NULL,
    exame_nome text NOT NULL,
    valor numeric(12,2) NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'pendente',
    resultado jsonb,
    liberado_em timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_atend_exames_atendimento ON public.atendimento_exames(atendimento_id)`,

  // Pagamentos.
  `CREATE TABLE IF NOT EXISTS public.atendimento_pagamentos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    atendimento_id uuid NOT NULL REFERENCES public.atendimentos(id) ON DELETE CASCADE,
    valor numeric(12,2) NOT NULL,
    forma text NOT NULL,
    data date NOT NULL DEFAULT CURRENT_DATE,
    tipo text NOT NULL DEFAULT 'entrada',
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_atend_pag_atendimento ON public.atendimento_pagamentos(atendimento_id)`,
  `CREATE INDEX IF NOT EXISTS idx_atend_pag_data ON public.atendimento_pagamentos(data)`,

  // Trigger reutilizável para updated_at.
  `CREATE OR REPLACE FUNCTION public.sislac_set_updated_at() RETURNS trigger AS $$
    BEGIN NEW.updated_at = now(); RETURN NEW; END;
   $$ LANGUAGE plpgsql`,
  `DROP TRIGGER IF EXISTS trg_pacientes_updated_at ON public.pacientes`,
  `CREATE TRIGGER trg_pacientes_updated_at BEFORE UPDATE ON public.pacientes
     FOR EACH ROW EXECUTE FUNCTION public.sislac_set_updated_at()`,
  `DROP TRIGGER IF EXISTS trg_atendimentos_updated_at ON public.atendimentos`,
  `CREATE TRIGGER trg_atendimentos_updated_at BEFORE UPDATE ON public.atendimentos
     FOR EACH ROW EXECUTE FUNCTION public.sislac_set_updated_at()`,
  `DROP TRIGGER IF EXISTS trg_atend_exames_updated_at ON public.atendimento_exames`,
  `CREATE TRIGGER trg_atend_exames_updated_at BEFORE UPDATE ON public.atendimento_exames
     FOR EACH ROW EXECUTE FUNCTION public.sislac_set_updated_at()`,

  // GRANTs: banco é dedicado ao tenant, então authenticated pode tudo.
  // (Auth cross-project via JWT do shared — validado pela Fase 2.)
  `GRANT USAGE ON SCHEMA public TO anon, authenticated`,
  `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated`,
  `GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role`,
  `ALTER DEFAULT PRIVILEGES IN SCHEMA public
     GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated`,
  `ALTER DEFAULT PRIVILEGES IN SCHEMA public
     GRANT ALL ON TABLES TO service_role`,
];

const SCHEMA_VERSION = "v1.0.0-poc";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const requestId = newRequestId(req);
  const log = createLogger("super-admin-provision-tenant-schema", requestId);
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

  let body: { tenantId?: string } = {};
  try { body = await req.json(); } catch {
    return errorResponse(400, "JSON inválido", requestId, log);
  }
  const tenantId = body.tenantId;
  if (!tenantId) return errorResponse(400, "tenantId obrigatório", requestId, log);

  const { data: reg, error: regErr } = await admin
    .from("tenant_registry")
    .select("db_host, db_port, db_name, db_user, db_secret_ref, runtime_mode, database_strategy")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (regErr) return errorResponse(500, "Falha ao ler tenant_registry", requestId, log, regErr);
  if (!reg) return errorResponse(404, "tenant_registry não encontrado", requestId, log);

  const isDedicated = reg.runtime_mode === "isolated_db" || reg.database_strategy === "dedicated";
  if (!isDedicated) {
    return errorResponse(400, "Tenant está configurado como Compartilhado — não há schema dedicado para provisionar", requestId, log);
  }

  const host = reg.db_host ?? "";
  const port = reg.db_port ?? 0;
  const database = reg.db_name ?? "";
  const user = reg.db_user ?? "";
  const secretRef = reg.db_secret_ref ?? "";
  if (!host || !port || !database || !user || !secretRef) {
    return errorResponse(400, "Metadados de conexão incompletos (host/porta/database/user/secret)", requestId, log);
  }
  if (!SECRET_REF_RE.test(secretRef)) return errorResponse(400, "Nome do secret inválido", requestId, log);

  const password = Deno.env.get(secretRef);
  if (!password) return errorResponse(400, `Secret "${secretRef}" não está cadastrado no Lovable Cloud`, requestId, log);

  const client = new Client({
    hostname: host,
    port,
    database,
    user,
    password,
    tls: { enabled: true, enforce: false } as any,
    connection: { attempts: 1 },
  });

  const t0 = Date.now();
  try {
    await client.connect();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.info("connect_failed", { host, port, msg });
    return jsonResponse(200, { ok: false, stage: "connect", error: msg });
  }

  let executed = 0;
  try {
    await client.queryArray("BEGIN");
    for (const stmt of SCHEMA_MINIMO_V1) {
      await client.queryArray(stmt);
      executed++;
    }
    await client.queryArray(
      `INSERT INTO public._sislac_health_check (schema_version, note)
       VALUES ($1, $2)`,
      [SCHEMA_VERSION, `Provisionado via super-admin-provision-tenant-schema por caller=${caller.id}`],
    );
    await client.queryArray("COMMIT");
  } catch (e) {
    try { await client.queryArray("ROLLBACK"); } catch { /* noop */ }
    const msg = e instanceof Error ? e.message : String(e);
    log.error("provision_failed", { host, port, executed, msg });
    return jsonResponse(200, { ok: false, stage: "ddl", error: msg, statements: executed });
  } finally {
    try { await client.end(); } catch { /* noop */ }
  }

  const nowIso = new Date().toISOString();
  const { error: upErr } = await admin
    .from("tenant_registry")
    .update({ schema_provisioned_at: nowIso, schema_version: SCHEMA_VERSION })
    .eq("tenant_id", tenantId);
  if (upErr) {
    log.warn("schema_provisioned_at update failed", { tenantId, err: upErr.message });
  }

  log.info("schema provisionado", { tenantId, statements: executed, ms: Date.now() - t0 });
  return jsonResponse(200, {
    ok: true,
    schema_provisioned_at: nowIso,
    schema_version: SCHEMA_VERSION,
    statements: executed,
    latencyMs: Date.now() - t0,
  });
});
