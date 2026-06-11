-- =========================================================
-- BLOCO 1 — UNIQUE multi-tenant em pacientes e convenios
-- =========================================================

-- Pacientes: trocar UNIQUE global por UNIQUE (tenant_id, cpf)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname='public' AND indexname='pacientes_cpf_key'
  ) THEN
    ALTER TABLE public.pacientes DROP CONSTRAINT IF EXISTS pacientes_cpf_key;
    DROP INDEX IF EXISTS public.pacientes_cpf_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS pacientes_tenant_cpf_unique
  ON public.pacientes (tenant_id, cpf)
  WHERE cpf IS NOT NULL AND cpf <> '';

-- Convenios: trocar UNIQUE global de nome por UNIQUE (tenant_id, lower(nome))
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname='public' AND indexname='convenios_nome_key'
  ) THEN
    ALTER TABLE public.convenios DROP CONSTRAINT IF EXISTS convenios_nome_key;
    DROP INDEX IF EXISTS public.convenios_nome_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS convenios_tenant_nome_unique
  ON public.convenios (tenant_id, lower(nome));

-- =========================================================
-- BLOCO 2 — Índices compostos por escala
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_atendimentos_tenant_data
  ON public.atendimentos (tenant_id, data DESC);

CREATE INDEX IF NOT EXISTS idx_atendimento_exames_tenant_status
  ON public.atendimento_exames (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_pacientes_tenant_status
  ON public.pacientes (tenant_id, status);

-- =========================================================
-- BLOCO 3 — Validação JSONB em resultados
-- =========================================================
ALTER TABLE public.atendimento_exames
  DROP CONSTRAINT IF EXISTS atex_resultados_jsonb_chk;

ALTER TABLE public.atendimento_exames
  ADD CONSTRAINT atex_resultados_jsonb_chk
  CHECK (
    resultados IS NULL
    OR jsonb_typeof(resultados) IN ('object','array')
  );

-- =========================================================
-- BLOCO 4 — Justificativa obrigatória pós-finalização
-- =========================================================
CREATE OR REPLACE FUNCTION public.require_justificativa_pos_finalizacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_just text := public._get_audit_justificativa();
  v_post boolean := false;
  v_at_id bigint;
BEGIN
  -- Detecta atendimento alvo
  IF TG_TABLE_NAME = 'atendimentos' THEN
    v_at_id := COALESCE(NEW.id, OLD.id);
    v_post := lower(COALESCE(OLD.status_atendimento,'')) IN
      ('resultado liberado','cancelado','pedido cancelado');
  ELSIF TG_TABLE_NAME = 'atendimento_exames' THEN
    v_at_id := COALESCE(NEW.atendimento_id, OLD.atendimento_id);
    v_post := public._is_post_finalizacao(v_at_id);
  ELSIF TG_TABLE_NAME = 'atendimento_pagamentos' THEN
    v_at_id := COALESCE(NEW.atendimento_id, OLD.atendimento_id);
    v_post := public._is_post_finalizacao(v_at_id);
  END IF;

  -- Super admin pode tudo (manutenção/migração)
  IF public.is_super_admin(auth.uid()) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF v_post AND COALESCE(length(trim(v_just)),0) < 5 THEN
    RAISE EXCEPTION 'Justificativa obrigatória para alterar atendimento finalizado/cancelado'
      USING ERRCODE = '22023', HINT = 'Chame set_audit_justificativa(_text) antes da operação.';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_require_just_atendimentos ON public.atendimentos;
CREATE TRIGGER trg_require_just_atendimentos
  BEFORE UPDATE OR DELETE ON public.atendimentos
  FOR EACH ROW EXECUTE FUNCTION public.require_justificativa_pos_finalizacao();

DROP TRIGGER IF EXISTS trg_require_just_atex ON public.atendimento_exames;
CREATE TRIGGER trg_require_just_atex
  BEFORE UPDATE OR DELETE ON public.atendimento_exames
  FOR EACH ROW EXECUTE FUNCTION public.require_justificativa_pos_finalizacao();

DROP TRIGGER IF EXISTS trg_require_just_atpag ON public.atendimento_pagamentos;
CREATE TRIGGER trg_require_just_atpag
  BEFORE UPDATE OR DELETE ON public.atendimento_pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.require_justificativa_pos_finalizacao();

-- =========================================================
-- BLOCO 5 — handle_new_user seguro (anti-elevação)
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  meta_name        text;
  meta_avatar      text;
  meta_tenant      uuid := NULL;
  meta_perfil      text;
  meta_admin_flag  boolean := COALESCE((NEW.raw_user_meta_data->>'__admin_provisioned')::boolean, false);
BEGIN
  -- Nome/avatar são informações pessoais — seguros para herdar do metadata
  meta_name   := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );
  meta_avatar := NEW.raw_user_meta_data->>'avatar_url';

  -- ⚠️ SEGURANÇA: perfil e tenant SÓ são respeitados quando vêm de uma
  -- edge function admin (que injeta __admin_provisioned=true via service-role).
  -- Em signup público, força perfil "recepcionista" no tenant default.
  IF meta_admin_flag THEN
    meta_perfil := COALESCE(NEW.raw_user_meta_data->>'perfil', 'recepcionista');
    BEGIN
      meta_tenant := (NEW.raw_user_meta_data->>'tenant_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      meta_tenant := NULL;
    END;
  ELSE
    meta_perfil := 'recepcionista';
    meta_tenant := NULL;
  END IF;

  -- Restringe perfil a um conjunto válido (defesa em profundidade)
  IF meta_perfil NOT IN ('admin','analista','recepcionista','financeiro') THEN
    meta_perfil := 'recepcionista';
  END IF;

  IF meta_tenant IS NULL THEN
    meta_tenant := '00000000-0000-0000-0000-000000000001'::uuid;
  END IF;

  INSERT INTO public.profiles (user_id, nome, email, avatar, perfil, tenant_id)
  VALUES (NEW.id, meta_name, NEW.email, meta_avatar, meta_perfil, meta_tenant)
  ON CONFLICT (user_id) DO NOTHING;

  -- Role inicial sempre 'user'. Elevação só via admin via tabela user_roles.
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Se admin provisionou e pediu role específica, aplica (admin/super_admin).
  IF meta_admin_flag AND NEW.raw_user_meta_data ? 'role' THEN
    BEGIN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, (NEW.raw_user_meta_data->>'role')::app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      -- Ignora valor inválido — segurança em primeiro lugar
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;