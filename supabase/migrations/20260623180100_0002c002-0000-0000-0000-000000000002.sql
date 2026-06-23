-- ============================================================================
-- Migration: Criar has_permission() seguro com validação de tenant_id
-- Arquivo: supabase/migrations/[TIMESTAMP]_create_has_permission_safe.sql
-- ============================================================================
-- Esta migração cria uma versão SEGURA de has_permission que valida tenant_id
-- A função antiga pode coexistir, mas RLS deve usar a nova versão

-- ============================================================================
-- Função SEGURA: has_permission_safe()
-- ============================================================================
-- Valida que:
-- 1. Usuário está autenticado
-- 2. Usuário pertence ao tenant correto
-- 3. Usuário tem a permissão requerida NAQUELE tenant
--
CREATE OR REPLACE FUNCTION public.has_permission_safe(
  uid uuid, 
  perm text
) 
RETURNS boolean 
LANGUAGE plpgsql 
STABLE 
SECURITY DEFINER 
SET search_path TO 'public' 
AS $$
DECLARE
  tid uuid;
  user_tenant uuid;
BEGIN
  -- Step 1: Se não autenticado, retorna FALSE
  IF uid IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Step 2: Obter tenant_id do usuário
  SELECT tenant_id INTO user_tenant 
  FROM public.profiles 
  WHERE user_id = uid 
  LIMIT 1;
  
  -- Step 3: Se usuário não tem tenant, não tem permissão
  IF user_tenant IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Step 4: Obter tenant_id atual (do contexto)
  tid := public.current_tenant_id();
  
  -- Step 5: CRÍTICO - validar que tenant_id do usuário = tenant_id atual
  -- Isso impede que um usuário veja/acesse dados de outro tenant
  IF user_tenant != tid THEN
    RETURN FALSE;
  END IF;
  
  -- Step 6: Agora, validar a permissão NAQUELE tenant
  -- ADAPTE CONFORME SUA SCHEMA DE PERMISSÕES!
  -- (veja as opções A, B, C abaixo)
  
  -- ========== OPÇÃO A: Se tem tabela user_permissions ==========
  RETURN EXISTS(
    SELECT 1 FROM public.user_permissions
    WHERE user_id = uid 
    AND permission = perm
    AND tenant_id = tid
  );
  
  -- ========== OPÇÃO B: Se usa perfis + perfil_permissoes ==========
  -- DESCOMENTE esta seção se usar perfis:
  /*
  DECLARE
    user_role text;
  BEGIN
    SELECT perfil INTO user_role FROM public.profiles WHERE user_id = uid;
    
    RETURN EXISTS(
      SELECT 1 FROM public.permissoes_por_perfil
      WHERE perfil = user_role
      AND permissao = perm
      AND tenant_id = tid
    );
  END;
  */
  
  -- ========== OPÇÃO C: Se usa roles do Supabase ==========
  -- DESCOMENTE se usar supabase roles (auth.users):
  /*
  RETURN EXISTS(
    SELECT 1 FROM auth.users u
    INNER JOIN public.user_roles ur ON u.id = ur.user_id
    WHERE u.id = uid
    AND ur.role = perm
    AND (SELECT tenant_id FROM profiles WHERE user_id = uid) = tid
  );
  */
  
END; 
$$;

-- ============================================================================
-- Função HELPER: Validar tenant do usuário
-- ============================================================================
-- Usa em procedures para validar acesso antes de qualquer operação
--
CREATE OR REPLACE FUNCTION public.assert_user_in_tenant(
  required_tenant_id uuid
) 
RETURNS void 
LANGUAGE plpgsql 
STABLE 
SECURITY DEFINER 
SET search_path TO 'public' 
AS $$
DECLARE
  current_tid uuid := public.current_tenant_id();
BEGIN
  -- Se não autenticado
  IF current_tid IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  -- Se tenant não corresponde
  IF current_tid != required_tenant_id THEN
    RAISE EXCEPTION 'Access denied: tenant mismatch (current: %, required: %)', 
      current_tid, required_tenant_id;
  END IF;
END; 
$$;

-- ============================================================================
-- Função HELPER: Verificar que coluna será atualizada somente se mesmo tenant
-- ============================================================================
-- Uso: Prevenir UPDATE que mude tenant_id de um registro
--
CREATE OR REPLACE FUNCTION public.prevent_tenant_id_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Se tenant_id está sendo mudado, rejeita
  IF OLD.tenant_id IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'Cannot modify tenant_id of existing record';
  END IF;
  
  -- Se nova operação é de outro tenant, rejeita
  IF NEW.tenant_id != public.current_tenant_id() THEN
    RAISE EXCEPTION 'Cannot update record from different tenant';
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================================================
-- Step 2: Atualizar políticas RLS para usar has_permission_safe()
-- ============================================================================
-- PROCURE por políticas que usam has_permission() e atualize para has_permission_safe()

-- EXEMPLO (ajuste conforme suas tabelas):
-- DROP POLICY IF EXISTS "pacientes_read" ON public.pacientes;
-- CREATE POLICY "pacientes_read"
--   ON public.pacientes
--   FOR SELECT
--   TO authenticated
--   USING (
--     tenant_id = public.current_tenant_id() 
--     AND public.has_permission_safe(auth.uid(), 'visualizar_pacientes')
--   );

-- ============================================================================
-- Step 3: Criar TRIGGER para prevenir mudança de tenant_id
-- ============================================================================
-- Aplique esta trigger em TODAS as tabelas multi-tenant

-- Exemplo: trigger em pacientes
-- CREATE TRIGGER prevent_tenant_change_pacientes
--   BEFORE UPDATE ON public.pacientes
--   FOR EACH ROW
--   EXECUTE FUNCTION public.prevent_tenant_id_change();

-- Exemplo: trigger em atendimentos  
-- CREATE TRIGGER prevent_tenant_change_atendimentos
--   BEFORE UPDATE ON public.atendimentos
--   FOR EACH ROW
--   EXECUTE FUNCTION public.prevent_tenant_id_change();

-- ============================================================================
-- Step 4: Verificações pós-migração
-- ============================================================================

-- Check 1: Função foi criada
-- SELECT routine_name FROM information_schema.routines 
-- WHERE routine_name IN ('has_permission_safe', 'assert_user_in_tenant', 'prevent_tenant_id_change')
-- AND routine_schema = 'public';
-- Esperado: 3 funções

-- Check 2: Políticas RLS estão usando a função segura
-- SELECT schemaname, tablename, policyname, qual
-- FROM pg_policies
-- WHERE qual LIKE '%has_permission%'
-- ORDER BY tablename;
-- Esperado: Todas com has_permission_safe()

-- Check 3: Testar permissão com tenant incorreto
-- Execute como usuario de Tenant A, tente acessar como Tenant B:
-- SELECT public.has_permission_safe(
--   (SELECT id FROM auth.users LIMIT 1),
--   'visualizar_pacientes'
-- );
-- Esperado: false (porque tenant não corresponde)

-- ============================================================================
-- Step 5: Exemplo de uso em Procedure (OPCIONAL)
-- ============================================================================
-- Se você usa procedures para operações críticas:

CREATE OR REPLACE FUNCTION public.update_paciente_safe(
  pac_id bigint,
  new_nome text,
  new_email text
)
RETURNS TABLE (success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  pac_tenant uuid;
  current_uid uuid := auth.uid();
BEGIN
  -- Validar que usuário está autenticado
  IF current_uid IS NULL THEN
    RETURN QUERY SELECT false, 'Not authenticated'::text;
    RETURN;
  END IF;
  
  -- Obter tenant do paciente
  SELECT tenant_id INTO pac_tenant FROM public.pacientes WHERE id = pac_id;
  
  -- Validar que paciente pertence ao tenant do usuário
  PERFORM public.assert_user_in_tenant(pac_tenant);
  
  -- Validar permissão
  IF NOT public.has_permission_safe(current_uid, 'editar_pacientes') THEN
    RETURN QUERY SELECT false, 'Permission denied'::text;
    RETURN;
  END IF;
  
  -- Executar update seguro
  UPDATE public.pacientes 
  SET 
    nome = new_nome,
    email = new_email,
    updated_at = now()
  WHERE id = pac_id AND tenant_id = public.current_tenant_id();
  
  RETURN QUERY SELECT true, 'Paciente atualizado com sucesso'::text;
END;
$$;

-- Uso na aplicação:
-- const { data, error } = await supabase.rpc('update_paciente_safe', {
--   pac_id: 123,
--   new_nome: 'João Silva',
--   new_email: 'joao@example.com'
-- });

-- ============================================================================
-- Rollback (se necessário)
-- ============================================================================
-- DROP FUNCTION IF EXISTS public.has_permission_safe(uuid, text);
-- DROP FUNCTION IF EXISTS public.assert_user_in_tenant(uuid);
-- DROP FUNCTION IF EXISTS public.prevent_tenant_id_change();
-- DROP FUNCTION IF EXISTS public.update_paciente_safe(bigint, text, text);
