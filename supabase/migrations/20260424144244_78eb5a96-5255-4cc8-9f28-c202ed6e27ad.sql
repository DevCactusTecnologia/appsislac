-- =====================================================
-- AUDITORIA COMPLETA E IMUTÁVEL — SISLAC
-- =====================================================

-- BLOCO 1: Tabela de auditoria
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  tabela TEXT NOT NULL,
  registro_id TEXT,
  acao TEXT NOT NULL CHECK (acao IN ('INSERT', 'UPDATE', 'DELETE')),
  antes JSONB,
  depois JSONB,
  user_id UUID,
  user_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON public.audit_logs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tabela ON public.audit_logs (tabela);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_registro ON public.audit_logs (tabela, registro_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs (user_id);

-- BLOCO 4: RLS — somente leitura, restrita por tenant + admin/auditoria
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Apenas admins ou usuários com permissão "auditoria" podem ler logs do próprio tenant
CREATE POLICY audit_logs_select
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR (
    tenant_id = current_tenant_id()
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_permission(auth.uid(), 'auditoria'::text)
    )
  )
);

-- IMUTABILIDADE: ninguém pode UPDATE/DELETE/INSERT manual.
-- Apenas a função SECURITY DEFINER `audit_trigger` insere registros.
-- Não criamos policies de INSERT/UPDATE/DELETE → bloqueado por padrão pelo RLS.

-- =====================================================
-- BLOCO 2: Função genérica de auditoria
-- =====================================================
CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_email TEXT;
  v_tenant UUID;
  v_registro TEXT;
  v_antes JSONB;
  v_depois JSONB;
BEGIN
  -- Captura usuário do JWT (pode ser NULL em operações de sistema)
  BEGIN
    v_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  BEGIN
    v_email := COALESCE(
      (current_setting('request.jwt.claims', true)::jsonb ->> 'email'),
      ''
    );
  EXCEPTION WHEN OTHERS THEN
    v_email := '';
  END;

  -- tenant_id (NEW preferencial; OLD em DELETE)
  IF TG_OP = 'DELETE' THEN
    v_tenant := (to_jsonb(OLD) ->> 'tenant_id')::uuid;
    v_registro := COALESCE(to_jsonb(OLD) ->> 'id', '');
    v_antes := to_jsonb(OLD);
    v_depois := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_tenant := (to_jsonb(NEW) ->> 'tenant_id')::uuid;
    v_registro := COALESCE(to_jsonb(NEW) ->> 'id', '');
    v_antes := NULL;
    v_depois := to_jsonb(NEW);
  ELSE -- UPDATE
    v_tenant := (to_jsonb(NEW) ->> 'tenant_id')::uuid;
    v_registro := COALESCE(to_jsonb(NEW) ->> 'id', '');
    v_antes := to_jsonb(OLD);
    v_depois := to_jsonb(NEW);
  END IF;

  INSERT INTO public.audit_logs (
    tenant_id, tabela, registro_id, acao,
    antes, depois, user_id, user_email, created_at
  )
  VALUES (
    v_tenant, TG_TABLE_NAME, v_registro, TG_OP,
    v_antes, v_depois, v_user_id, v_email, now()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- =====================================================
-- BLOCO 3: Aplicar triggers nas tabelas críticas
-- =====================================================
-- Helper: aplica trigger se ainda não existir
DO $$
DECLARE
  t TEXT;
  tabelas TEXT[] := ARRAY[
    -- Núcleo clínico
    'pacientes',
    'atendimentos',
    'atendimento_exames',
    'atendimento_pagamentos',
    'amostras',
    'identidade_confirmacoes',
    'orientacoes_entregues',
    'criticos_comunicacoes',
    -- Catálogo / configuração de exames (impacto clínico direto)
    'exames_catalogo',
    'exame_parametros',
    'exame_pops',
    'exame_layouts',
    -- Financeiro
    'financeiro_saidas',
    'convenio_faturas',
    'convenio_fatura_itens',
    'convenios',
    -- Outros sensíveis
    'especialistas',
    'app_settings'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    -- Só aplica se a tabela existir
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS audit_%1$s ON public.%1$I;
         CREATE TRIGGER audit_%1$s
         AFTER INSERT OR UPDATE OR DELETE ON public.%1$I
         FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();',
        t
      );
    END IF;
  END LOOP;
END $$;

-- =====================================================
-- COMENTÁRIOS
-- =====================================================
COMMENT ON TABLE public.audit_logs IS
  'Log imutável de auditoria. Inserts apenas via trigger SECURITY DEFINER. '
  'Sem policies de INSERT/UPDATE/DELETE para usuários — leitura restrita a admin/auditoria do tenant.';

COMMENT ON FUNCTION public.audit_trigger() IS
  'Trigger genérico de auditoria. Captura antes/depois (JSONB), user_id do JWT e tenant_id da linha. '
  'NÃO aplicar em audit_logs (loop infinito).';
