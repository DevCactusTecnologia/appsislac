
-- =====================================================
-- Fase 1: operational_audit + platform_audit (não destrutiva)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.operational_audit (
  id            bigserial PRIMARY KEY,
  tenant_id     uuid NOT NULL,
  ator_id       uuid,
  ator_papel    text,
  recurso_tipo  text NOT NULL,
  recurso_id    text,
  acao          text NOT NULL,
  contexto      jsonb NOT NULL DEFAULT '{}'::jsonb,
  critico       boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS operational_audit_tenant_created_idx
  ON public.operational_audit (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS operational_audit_recurso_idx
  ON public.operational_audit (tenant_id, recurso_tipo, recurso_id);

GRANT SELECT ON public.operational_audit TO authenticated;
GRANT ALL    ON public.operational_audit TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.operational_audit_id_seq TO service_role;

ALTER TABLE public.operational_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS operational_audit_tenant_read   ON public.operational_audit;
DROP POLICY IF EXISTS operational_audit_service_write ON public.operational_audit;
CREATE POLICY operational_audit_tenant_read   ON public.operational_audit FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin());
CREATE POLICY operational_audit_service_write ON public.operational_audit FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.platform_audit (
  id            bigserial PRIMARY KEY,
  ator_id       uuid,
  ator_papel    text,
  recurso_tipo  text NOT NULL,
  recurso_id    text,
  acao          text NOT NULL,
  contexto      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS platform_audit_created_idx ON public.platform_audit (created_at DESC);
CREATE INDEX IF NOT EXISTS platform_audit_recurso_idx ON public.platform_audit (recurso_tipo, recurso_id);

GRANT SELECT ON public.platform_audit TO authenticated;
GRANT ALL    ON public.platform_audit TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.platform_audit_id_seq TO service_role;

ALTER TABLE public.platform_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS platform_audit_super_admin_read ON public.platform_audit;
DROP POLICY IF EXISTS platform_audit_service_write    ON public.platform_audit;
CREATE POLICY platform_audit_super_admin_read ON public.platform_audit FOR SELECT TO authenticated
  USING (public.is_super_admin());
CREATE POLICY platform_audit_service_write    ON public.platform_audit FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ===== Forwarders =====

CREATE OR REPLACE FUNCTION public.fwd_atendimento_audit_to_operational()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.operational_audit (tenant_id, ator_id, recurso_tipo, recurso_id, acao, contexto, critico, created_at)
  VALUES (
    NEW.tenant_id, NEW.changed_by,
    CASE WHEN NEW.exame_nome <> '' THEN 'exame'
         WHEN NEW.entidade = 'pagamento' THEN 'pagamento'
         WHEN NEW.resultado_critico THEN 'critico'
         ELSE 'atendimento' END,
    COALESCE(NEW.atendimento_id::text, NEW.registro_id::text),
    NEW.acao,
    jsonb_build_object(
      'entidade', NEW.entidade, 'operacao', NEW.operacao, 'protocolo', NEW.protocolo,
      'paciente_nome', NEW.paciente_nome, 'exame_nome', NEW.exame_nome,
      'old_value', NEW.old_value, 'new_value', NEW.new_value,
      'justificativa', NEW.justificativa, 'pos_finalizacao', NEW.pos_finalizacao,
      'email', NEW.changed_by_email),
    NEW.resultado_critico, NEW.changed_at);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS atendimento_audit_fwd ON public.atendimento_audit;
CREATE TRIGGER atendimento_audit_fwd AFTER INSERT ON public.atendimento_audit
  FOR EACH ROW EXECUTE FUNCTION public.fwd_atendimento_audit_to_operational();

CREATE OR REPLACE FUNCTION public.fwd_app_settings_audit_to_platform()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.platform_audit (ator_id, recurso_tipo, recurso_id, acao, contexto, created_at)
  VALUES (NEW.changed_by, 'settings', NEW.key, NEW.operacao,
          jsonb_build_object('old_value', NEW.old_value, 'new_value', NEW.new_value),
          NEW.changed_at);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS app_settings_audit_fwd ON public.app_settings_audit;
CREATE TRIGGER app_settings_audit_fwd AFTER INSERT ON public.app_settings_audit
  FOR EACH ROW EXECUTE FUNCTION public.fwd_app_settings_audit_to_platform();

CREATE OR REPLACE FUNCTION public.fwd_storage_audit_to_operational()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant uuid; j jsonb := to_jsonb(NEW);
BEGIN
  v_tenant := NULLIF(j ->> 'tenant_id','')::uuid;
  IF v_tenant IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.operational_audit (tenant_id, ator_id, recurso_tipo, recurso_id, acao, contexto, created_at)
  VALUES (v_tenant, NULLIF(j ->> 'user_id','')::uuid, 'storage',
          j ->> 'object_path',
          COALESCE(j ->> 'acao', j ->> 'operacao', 'storage'),
          j, COALESCE(NULLIF(j ->> 'created_at','')::timestamptz, now()));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS storage_audit_fwd ON public.storage_audit;
CREATE TRIGGER storage_audit_fwd AFTER INSERT ON public.storage_audit
  FOR EACH ROW EXECUTE FUNCTION public.fwd_storage_audit_to_operational();

CREATE OR REPLACE FUNCTION public.fwd_pdf_override_audit_to_operational()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant uuid; j jsonb := to_jsonb(NEW);
BEGIN
  v_tenant := NULLIF(j ->> 'tenant_id','')::uuid;
  IF v_tenant IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.operational_audit (tenant_id, ator_id, recurso_tipo, recurso_id, acao, contexto, critico, created_at)
  VALUES (v_tenant, NULLIF(j ->> 'changed_by','')::uuid, 'pdf_override',
          COALESCE(j ->> 'atendimento_exame_id', j ->> 'registro_id'),
          COALESCE(j ->> 'acao', 'pdf_override'),
          j, true, COALESCE(NULLIF(j ->> 'created_at','')::timestamptz, now()));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS pdf_override_audit_fwd ON public.pdf_override_audit;
CREATE TRIGGER pdf_override_audit_fwd AFTER INSERT ON public.pdf_override_audit
  FOR EACH ROW EXECUTE FUNCTION public.fwd_pdf_override_audit_to_operational();

CREATE OR REPLACE FUNCTION public.fwd_protocolo_auditoria_to_operational()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant uuid; j jsonb := to_jsonb(NEW);
BEGIN
  v_tenant := NULLIF(j ->> 'tenant_id','')::uuid;
  IF v_tenant IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.operational_audit (tenant_id, ator_id, recurso_tipo, recurso_id, acao, contexto, created_at)
  VALUES (v_tenant, NULLIF(j ->> 'changed_by','')::uuid, 'protocolo',
          j ->> 'protocolo', COALESCE(j ->> 'acao', 'protocolo'),
          j, COALESCE(NULLIF(j ->> 'created_at','')::timestamptz, now()));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protocolo_auditoria_fwd ON public.protocolo_auditoria;
CREATE TRIGGER protocolo_auditoria_fwd AFTER INSERT ON public.protocolo_auditoria
  FOR EACH ROW EXECUTE FUNCTION public.fwd_protocolo_auditoria_to_operational();

CREATE OR REPLACE FUNCTION public.fwd_criticos_comunicacoes_to_operational()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant uuid; j jsonb := to_jsonb(NEW);
BEGIN
  v_tenant := NULLIF(j ->> 'tenant_id','')::uuid;
  IF v_tenant IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.operational_audit (tenant_id, ator_id, recurso_tipo, recurso_id, acao, contexto, critico, created_at)
  VALUES (v_tenant, NULLIF(j ->> 'created_by','')::uuid, 'critico',
          COALESCE(j ->> 'atendimento_exame_id', j ->> 'registro_id'),
          COALESCE(j ->> 'acao', 'comunicacao_critico'),
          j, true, COALESCE(NULLIF(j ->> 'created_at','')::timestamptz, now()));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS criticos_comunicacoes_fwd ON public.criticos_comunicacoes;
CREATE TRIGGER criticos_comunicacoes_fwd AFTER INSERT ON public.criticos_comunicacoes
  FOR EACH ROW EXECUTE FUNCTION public.fwd_criticos_comunicacoes_to_operational();

CREATE OR REPLACE FUNCTION public.fwd_audit_logs_split()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.tenant_id IS NOT NULL THEN
    INSERT INTO public.operational_audit (tenant_id, ator_id, recurso_tipo, recurso_id, acao, contexto, created_at)
    VALUES (NEW.tenant_id, NEW.user_id, NEW.tabela, NEW.registro_id, NEW.acao,
            jsonb_build_object('antes', NEW.antes, 'depois', NEW.depois, 'user_email', NEW.user_email),
            NEW.created_at);
  ELSE
    INSERT INTO public.platform_audit (ator_id, recurso_tipo, recurso_id, acao, contexto, created_at)
    VALUES (NEW.user_id, NEW.tabela, NEW.registro_id, NEW.acao,
            jsonb_build_object('antes', NEW.antes, 'depois', NEW.depois, 'user_email', NEW.user_email),
            NEW.created_at);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS audit_logs_fwd ON public.audit_logs;
CREATE TRIGGER audit_logs_fwd AFTER INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.fwd_audit_logs_split();

CREATE OR REPLACE FUNCTION public.fwd_to_platform_audit_generic()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_recurso_tipo text := TG_ARGV[0]; j jsonb := to_jsonb(NEW);
BEGIN
  INSERT INTO public.platform_audit (ator_id, recurso_tipo, recurso_id, acao, contexto, created_at)
  VALUES (NULLIF(j ->> 'changed_by','')::uuid, v_recurso_tipo,
          COALESCE(j ->> 'tenant_id', j ->> 'subscription_id', j ->> 'registro_id'),
          COALESCE(j ->> 'acao', j ->> 'operacao', v_recurso_tipo),
          j, COALESCE(NULLIF(j ->> 'created_at','')::timestamptz, now()));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tenant_provision_audit_fwd ON public.tenant_provision_audit;
CREATE TRIGGER tenant_provision_audit_fwd AFTER INSERT ON public.tenant_provision_audit
  FOR EACH ROW EXECUTE FUNCTION public.fwd_to_platform_audit_generic('tenant');

DROP TRIGGER IF EXISTS subscription_changes_log_fwd ON public.subscription_changes_log;
CREATE TRIGGER subscription_changes_log_fwd AFTER INSERT ON public.subscription_changes_log
  FOR EACH ROW EXECUTE FUNCTION public.fwd_to_platform_audit_generic('subscription');

DROP TRIGGER IF EXISTS tenant_migration_log_fwd ON public.tenant_migration_log;
CREATE TRIGGER tenant_migration_log_fwd AFTER INSERT ON public.tenant_migration_log
  FOR EACH ROW EXECUTE FUNCTION public.fwd_to_platform_audit_generic('migration');

-- ===== Backfill select_options (idempotente) =====

INSERT INTO public.select_options (tenant_id, categoria, valor, label, ordem, ativo, sistema, created_at, updated_at)
SELECT m.tenant_id, 'motivo_cancelamento', m.nome, m.nome, 0, m.ativo, m.sistema, m.created_at, m.updated_at
FROM public.motivos_cancelamento m
WHERE NOT EXISTS (
  SELECT 1 FROM public.select_options s
  WHERE s.categoria='motivo_cancelamento' AND s.valor=m.nome
    AND s.tenant_id IS NOT DISTINCT FROM m.tenant_id);

INSERT INTO public.select_options (tenant_id, categoria, valor, label, ordem, ativo, sistema, created_at, updated_at)
SELECT r.tenant_id, 'recoleta_motivo', r.nome, r.nome, r.ordem, r.ativo, r.sistema, r.created_at, r.updated_at
FROM public.recoletas_motivos r
WHERE NOT EXISTS (
  SELECT 1 FROM public.select_options s
  WHERE s.categoria='recoleta_motivo' AND s.valor=r.nome
    AND s.tenant_id IS NOT DISTINCT FROM r.tenant_id);

INSERT INTO public.select_options (tenant_id, categoria, valor, label, ordem, ativo, sistema, created_at, updated_at)
SELECT d.tenant_id, 'financeiro_destino_pagamento', d.nome, d.nome, 0, d.ativo, d.sistema, d.created_at, d.updated_at
FROM public.financeiro_destinos_pagamento d
WHERE NOT EXISTS (
  SELECT 1 FROM public.select_options s
  WHERE s.categoria='financeiro_destino_pagamento' AND s.valor=d.nome
    AND s.tenant_id IS NOT DISTINCT FROM d.tenant_id);

INSERT INTO public.select_options (tenant_id, categoria, valor, label, ordem, ativo, sistema, created_at, updated_at)
SELECT f.tenant_id, 'financeiro_forma_pagamento', f.nome, f.nome, f.ordem, f.ativo, f.sistema, f.created_at, f.updated_at
FROM public.financeiro_formas_pagamento f
WHERE NOT EXISTS (
  SELECT 1 FROM public.select_options s
  WHERE s.categoria='financeiro_forma_pagamento' AND s.valor=f.nome
    AND s.tenant_id IS NOT DISTINCT FROM f.tenant_id);

INSERT INTO public.select_options (tenant_id, categoria, valor, label, ordem, ativo, sistema, created_at, updated_at)
SELECT t.tenant_id, 'financeiro_tipo_despesa', t.nome, t.nome, 0, t.ativo, t.sistema, t.created_at, t.updated_at
FROM public.financeiro_tipos_despesa t
WHERE NOT EXISTS (
  SELECT 1 FROM public.select_options s
  WHERE s.categoria='financeiro_tipo_despesa' AND s.valor=t.nome
    AND s.tenant_id IS NOT DISTINCT FROM t.tenant_id);
