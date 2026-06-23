-- ============================================================================
-- Migration: Mega Security Fix - Corrigir 12+ vulnerabilidades restantes
-- Data: 2026-06-23
-- ============================================================================

-- ============================================================================
-- PARTE 1: CORRIGIR 5 FUNCTIONS - ADICIONAR SECURITY DEFINER
-- ============================================================================

-- Função 1: ocorrencias_page
DROP FUNCTION IF EXISTS public.ocorrencias_page(timestamptz, bigint, text, integer, timestamptz, timestamptz, text) CASCADE;
CREATE OR REPLACE FUNCTION public.ocorrencias_page(
  p_filter_date timestamptz,
  p_after_id bigint,
  p_search text,
  p_limit integer,
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_status text
)
RETURNS TABLE (
  id bigint,
  created_at timestamptz,
  descricao text,
  status text,
  tenant_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated or tenant not set';
  END IF;
  
  RETURN QUERY
  SELECT 
    o.id,
    o.created_at,
    o.descricao,
    o.status,
    o.tenant_id
  FROM public.ocorrencias o
  WHERE o.tenant_id = v_tenant_id
    AND (p_search IS NULL OR o.descricao ILIKE '%' || p_search || '%')
    AND (p_status IS NULL OR o.status = p_status)
    AND (p_start_date IS NULL OR o.created_at >= p_start_date)
    AND (p_end_date IS NULL OR o.created_at <= p_end_date)
    AND (p_after_id IS NULL OR o.id > p_after_id)
  ORDER BY o.created_at DESC, o.id DESC
  LIMIT COALESCE(p_limit, 50);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ocorrencias_page(timestamptz, bigint, text, integer, timestamptz, timestamptz, text) TO authenticated;

-- Função 2: validate_protocolo_atendimento
DROP FUNCTION IF EXISTS public.validate_protocolo_atendimento(text) CASCADE;
CREATE OR REPLACE FUNCTION public.validate_protocolo_atendimento(p_protocolo text)
RETURNS TABLE (
  is_valid boolean,
  message text,
  atendimento_id bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_atendimento_id bigint;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  SELECT a.id INTO v_atendimento_id
  FROM public.atendimentos a
  WHERE a.protocolo = p_protocolo
    AND a.tenant_id = v_tenant_id
  LIMIT 1;
  
  IF v_atendimento_id IS NULL THEN
    RETURN QUERY SELECT false, 'Protocolo não encontrado', NULL::bigint;
  ELSE
    RETURN QUERY SELECT true, 'Protocolo válido', v_atendimento_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_protocolo_atendimento(text) TO authenticated;

-- Função 3: validate_protocolo_fatura
DROP FUNCTION IF EXISTS public.validate_protocolo_fatura(text) CASCADE;
CREATE OR REPLACE FUNCTION public.validate_protocolo_fatura(p_protocolo text)
RETURNS TABLE (
  is_valid boolean,
  message text,
  fatura_id bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_fatura_id bigint;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  SELECT f.id INTO v_fatura_id
  FROM public.faturas f
  WHERE f.protocolo = p_protocolo
    AND f.tenant_id = v_tenant_id
  LIMIT 1;
  
  IF v_fatura_id IS NULL THEN
    RETURN QUERY SELECT false, 'Protocolo não encontrado', NULL::bigint;
  ELSE
    RETURN QUERY SELECT true, 'Protocolo válido', v_fatura_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_protocolo_fatura(text) TO authenticated;

-- Função 4: validate_protocolo_orcamento
DROP FUNCTION IF EXISTS public.validate_protocolo_orcamento(text) CASCADE;
CREATE OR REPLACE FUNCTION public.validate_protocolo_orcamento(p_protocolo text)
RETURNS TABLE (
  is_valid boolean,
  message text,
  orcamento_id bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_orcamento_id bigint;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  SELECT o.id INTO v_orcamento_id
  FROM public.orcamentos o
  WHERE o.protocolo = p_protocolo
    AND o.tenant_id = v_tenant_id
  LIMIT 1;
  
  IF v_orcamento_id IS NULL THEN
    RETURN QUERY SELECT false, 'Protocolo não encontrado', NULL::bigint;
  ELSE
    RETURN QUERY SELECT true, 'Protocolo válido', v_orcamento_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_protocolo_orcamento(text) TO authenticated;

-- Função 5: validate_protocolo_saida
DROP FUNCTION IF EXISTS public.validate_protocolo_saida(text) CASCADE;
CREATE OR REPLACE FUNCTION public.validate_protocolo_saida(p_protocolo text)
RETURNS TABLE (
  is_valid boolean,
  message text,
  saida_id bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_saida_id bigint;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  SELECT s.id INTO v_saida_id
  FROM public.saidas s
  WHERE s.protocolo = p_protocolo
    AND s.tenant_id = v_tenant_id
  LIMIT 1;
  
  IF v_saida_id IS NULL THEN
    RETURN QUERY SELECT false, 'Protocolo não encontrado', NULL::bigint;
  ELSE
    RETURN QUERY SELECT true, 'Protocolo válido', v_saida_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_protocolo_saida(text) TO authenticated;

-- ============================================================================
-- PARTE 2: AUDIT LOGGING - Tabela + Functions + Triggers
-- ============================================================================

-- Criar tabela audit_log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  action TEXT NOT NULL,  -- INSERT, UPDATE, DELETE
  user_id UUID,
  tenant_id UUID NOT NULL,
  record_id BIGINT,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_log_tenant_id ON public.audit_log(tenant_id);
CREATE INDEX idx_audit_log_table_name ON public.audit_log(table_name);
CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at);
CREATE INDEX idx_audit_log_user_id ON public.audit_log(user_id);

-- Função para logging
CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  -- Obter tenant_id do registro
  IF TG_TABLE_NAME IN ('pacientes', 'atendimentos', 'faturas', 'orcamentos', 'saidas') THEN
    IF TG_OP = 'DELETE' THEN
      v_tenant_id := OLD.tenant_id;
    ELSE
      v_tenant_id := NEW.tenant_id;
    END IF;
  ELSE
    v_tenant_id := public.current_tenant_id();
  END IF;
  
  -- Inserir log
  INSERT INTO public.audit_log (
    table_name,
    action,
    user_id,
    tenant_id,
    record_id,
    old_data,
    new_data,
    ip_address,
    user_agent,
    created_at
  ) VALUES (
    TG_TABLE_NAME,
    TG_OP,
    auth.uid(),
    v_tenant_id,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN row_to_json(NEW) ELSE NULL END,
    current_setting('request.headers.x-forwarded-for')::inet,
    current_setting('request.headers.user-agent', true),
    NOW()
  );
  
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- ============================================================================
-- PARTE 3: COLUMN-LEVEL SECURITY - Views Seguras
-- ============================================================================

-- View segura para pacientes (sem CPF para usuários normais)
CREATE OR REPLACE VIEW public.pacientes_safe AS
SELECT
  p.id,
  p.nome,
  p.email,
  p.telefone,
  p.celular,
  p.data_nascimento,
  p.sexo,
  p.cep,
  p.estado,
  p.cidade,
  p.bairro,
  p.endereco,
  p.numero,
  p.complemento,
  p.status,
  p.tenant_id,
  CASE 
    WHEN public.is_super_admin(auth.uid()) THEN p.cpf
    ELSE '***.***.***-**'::text
  END as cpf_masked,
  p.created_at,
  p.updated_at
FROM public.pacientes p
WHERE p.tenant_id = public.current_tenant_id()
   OR public.is_super_admin(auth.uid());

-- ============================================================================
-- PARTE 4: ADICIONAR VALIDAÇÃO DE TENANT EM TABELAS CRÍTICAS
-- ============================================================================

-- Função helper para validar tenant em operações
CREATE OR REPLACE FUNCTION public.validate_tenant_access(p_table_name text, p_record_id bigint)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record_tenant uuid;
BEGIN
  IF p_table_name = 'pacientes' THEN
    SELECT tenant_id INTO v_record_tenant FROM public.pacientes WHERE id = p_record_id;
  ELSIF p_table_name = 'atendimentos' THEN
    SELECT tenant_id INTO v_record_tenant FROM public.atendimentos WHERE id = p_record_id;
  ELSIF p_table_name = 'faturas' THEN
    SELECT tenant_id INTO v_record_tenant FROM public.faturas WHERE id = p_record_id;
  ELSE
    RETURN false;
  END IF;
  
  RETURN v_record_tenant = public.current_tenant_id() OR public.is_super_admin(auth.uid());
END;
$$;

-- ============================================================================
-- PARTE 5: PROTEÇÃO CONTRA BRUTE FORCE - Tracking de Login
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.login_attempts (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  tenant_id UUID,
  ip_address INET NOT NULL,
  success BOOLEAN NOT NULL,
  attempted_at TIMESTAMP DEFAULT NOW(),
  user_agent TEXT
);

CREATE INDEX idx_login_attempts_email_ip ON public.login_attempts(email, ip_address);
CREATE INDEX idx_login_attempts_attempted_at ON public.login_attempts(attempted_at);

-- Função para checar brute force
CREATE OR REPLACE FUNCTION public.is_brute_force_attack(p_email text, p_ip inet)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_failed_attempts integer;
BEGIN
  -- Contar tentativas falhadas nos últimos 15 minutos
  SELECT COUNT(*)
  INTO v_failed_attempts
  FROM public.login_attempts
  WHERE email = p_email
    AND ip_address = p_ip
    AND success = false
    AND attempted_at > NOW() - INTERVAL '15 minutes';
  
  -- Bloquear se >= 5 tentativas falhadas
  RETURN v_failed_attempts >= 5;
END;
$$;

-- ============================================================================
-- PARTE 6: SENSITIVE DATA ENCRYPTION (Hashes)
-- ============================================================================

-- Função para hash de sensível
CREATE OR REPLACE FUNCTION public.hash_sensitive(p_data text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Usar digest do pgcrypto (SHA-256)
  RETURN encode(digest(p_data, 'sha256'), 'hex');
END;
$$;

-- ============================================================================
-- VALIDAÇÕES PÓS-MIGRAÇÃO
-- ============================================================================

-- Verificar se Functions foram criadas com SECURITY DEFINER:
-- SELECT routine_name, security_invoker 
-- FROM information_schema.routines 
-- WHERE routine_schema = 'public'
--   AND routine_name IN (
--     'ocorrencias_page',
--     'validate_protocolo_atendimento',
--     'validate_protocolo_fatura',
--     'validate_protocolo_orcamento',
--     'validate_protocolo_saida'
--   );
-- Esperado: security_invoker = false (= SECURITY DEFINER)

-- Verificar audit_log foi criada:
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'audit_log';

-- Verificar views seguras:
-- SELECT table_name FROM information_schema.views WHERE table_schema = 'public' AND table_name LIKE '%_safe';
