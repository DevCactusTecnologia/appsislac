-- ============================================================================
-- Migration: Corrigir tabela UNIDADES - Adicionar tenant_id e RLS seguro
-- Data: 2026-06-23
-- Vulnerabilidade: USING(true) permitia qualquer usuário ler todas as unidades
-- ============================================================================

-- Step 1: Adicionar coluna tenant_id
ALTER TABLE public.unidades 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Step 2: Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_unidades_tenant_id ON public.unidades(tenant_id);

-- Step 3: Popular tenant_id para registros existentes
-- Estratégia: Atribuir ao primeiro tenant (padrão) ou ao proprietário se houver relação
UPDATE public.unidades u
SET tenant_id = (
  SELECT COALESCE(p.tenant_id, '00000000-0000-0000-0000-000000000001')
  FROM public.profiles p
  WHERE p.user_id IN (
    SELECT user_id FROM public.profiles LIMIT 1
  )
  LIMIT 1
)
WHERE u.tenant_id IS NULL;

-- Fallback: Se ainda houver NULL, atribuir tenant padrão
UPDATE public.unidades
SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

-- Step 4: Tornar coluna obrigatória
ALTER TABLE public.unidades
ALTER COLUMN tenant_id SET NOT NULL;

-- Step 5: Remover política INSEGURA
DROP POLICY IF EXISTS "Authenticated read unidades" ON public.unidades;

-- Step 6: Criar NOVA política SEGURA
CREATE POLICY "unidades_authenticated_select"
  ON public.unidades
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "unidades_authenticated_insert"
  ON public.unidades
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "unidades_authenticated_update"
  ON public.unidades
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "unidades_authenticated_delete"
  ON public.unidades
  FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "unidades_super_admin"
  ON public.unidades
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Step 7: Trigger para prevenir mudança de tenant_id
CREATE OR REPLACE FUNCTION public.prevent_unidades_tenant_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.tenant_id IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'Cannot modify tenant_id of existing record';
  END IF;
  IF NEW.tenant_id != public.current_tenant_id() AND NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Cannot update record from different tenant';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS prevent_unidades_tenant_change ON public.unidades;
CREATE TRIGGER prevent_unidades_tenant_change
  BEFORE UPDATE ON public.unidades
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_unidades_tenant_change();
