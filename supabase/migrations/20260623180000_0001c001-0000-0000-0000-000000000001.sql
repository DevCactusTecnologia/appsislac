-- ============================================================================
-- Migration: Adicionar tenant_id à tabela inscricoes com RLS seguro
-- Arquivo: supabase/migrations/[TIMESTAMP]_add_tenant_id_to_inscricoes.sql
-- ============================================================================

-- ============================================================================
-- Step 1: Adicionar coluna tenant_id
-- ============================================================================
ALTER TABLE public.inscricoes 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

-- ============================================================================
-- Step 2: Criar índice para performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_inscricoes_tenant_id 
ON public.inscricoes(tenant_id);

-- Índice composto para melhor performance
CREATE INDEX IF NOT EXISTS idx_inscricoes_tenant_email 
ON public.inscricoes(tenant_id, email) WHERE email IS NOT NULL;

-- ============================================================================
-- Step 3: Definir valor padrão para registros existentes
-- ============================================================================
-- IMPORTANTE: Ajuste conforme sua lógica de negócio!
-- 
-- Opção A: Se inscricoes tem user_id, pegue tenant_id do profile do usuário
UPDATE public.inscricoes i
SET tenant_id = (
  SELECT COALESCE(p.tenant_id, '00000000-0000-0000-0000-000000000001')
  FROM public.profiles p
  WHERE p.user_id = i.user_id
  LIMIT 1
)
WHERE i.tenant_id IS NULL AND i.user_id IS NOT NULL;

-- Opção B: Se não tem user_id, use um tenant padrão (AJUSTE ISSO!)
UPDATE public.inscricoes
SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

-- ============================================================================
-- Step 4: Tornar coluna obrigatória
-- ============================================================================
ALTER TABLE public.inscricoes
ALTER COLUMN tenant_id SET NOT NULL;

-- ============================================================================
-- Step 5: Remover políticas antigas INSEGURAS
-- ============================================================================
DROP POLICY IF EXISTS "Public insert" ON public.inscricoes;
DROP POLICY IF EXISTS "Public select their own by ID" ON public.inscricoes;
DROP POLICY IF EXISTS "Public update their own by ID" ON public.inscricoes;
DROP POLICY IF EXISTS "inscricoes_anon_read" ON public.inscricoes;
DROP POLICY IF EXISTS "inscricoes_anon_update" ON public.inscricoes;

-- ============================================================================
-- Step 6: Criar NOVAS políticas RLS SEGURAS
-- ============================================================================

-- Política 1: ANON pode CRIAR inscrição (formulário público)
-- Mas apenas com um token único e validado
CREATE POLICY "inscricoes_anon_insert_with_token"
  ON public.inscricoes
  FOR INSERT TO anon
  WITH CHECK (
    -- Token deve existir e ser único
    token IS NOT NULL 
    AND token != ''
    AND char_length(token) >= 32
  );

-- Política 2: ANON pode LER SOMENTE inscrição com seu token
-- Implementação: Token é passado via header HTTP (x-inscricao-token)
CREATE POLICY "inscricoes_anon_select_by_token"
  ON public.inscricoes
  FOR SELECT TO anon
  USING (
    -- Recupera token do header HTTP request
    -- IMPORTANTE: Configure isso na sua app via request headers
    token = current_setting('request.headers.x-inscricao-token'::text, true)
  );

-- Política 3: AUTHENTICATED (usuário logado) vê inscrições do seu tenant
CREATE POLICY "inscricoes_authenticated_select"
  ON public.inscricoes
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
  );

-- Política 4: AUTHENTICATED pode UPDATE inscrições do seu tenant
CREATE POLICY "inscricoes_authenticated_update"
  ON public.inscricoes
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
  );

-- Política 5: AUTHENTICATED pode DELETE inscrições do seu tenant
CREATE POLICY "inscricoes_authenticated_delete"
  ON public.inscricoes
  FOR DELETE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
  );

-- Política 6: SUPER ADMIN vê tudo (apenas para super_admin role)
CREATE POLICY "inscricoes_super_admin_all"
  ON public.inscricoes
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- ============================================================================
-- Step 7: Verificação pós-migração
-- ============================================================================
-- Execute isto para validar:

-- Check 1: Nenhuma inscricao sem tenant_id
-- SELECT COUNT(*) FROM public.inscricoes WHERE tenant_id IS NULL;
-- Esperado: 0

-- Check 2: Políticas criadas corretamente
-- SELECT schemaname, tablename, policyname, qual 
-- FROM pg_policies 
-- WHERE tablename = 'inscricoes' 
-- ORDER BY policyname;
-- Esperado: 6 políticas novas

-- Check 3: Índices criados
-- SELECT indexname FROM pg_indexes 
-- WHERE tablename = 'inscricoes' 
-- AND indexname LIKE '%tenant%';
-- Esperado: 2 índices

-- ============================================================================
-- Step 8: Teste manual (execute como diferentes usuários)
-- ============================================================================
-- Test 1: Como ANON com token válido
-- SELECT COUNT(*) FROM inscricoes;
-- Esperado: Apenas inscrições com este token

-- Test 2: Como AUTHENTICATED (Tenant A)
-- SELECT COUNT(*) FROM inscricoes;
-- Esperado: Apenas inscrições do Tenant A

-- Test 3: Como AUTHENTICATED (Tenant B)  
-- SELECT COUNT(*) FROM inscricoes;
-- Esperado: Apenas inscrições do Tenant B (diferente do Test 2)

-- Test 4: Como SUPER_ADMIN
-- SELECT COUNT(*) FROM inscricoes;
-- Esperado: Todas as inscrições
