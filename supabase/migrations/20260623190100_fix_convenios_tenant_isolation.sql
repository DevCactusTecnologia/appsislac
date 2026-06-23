-- ============================================================================
-- Migration: Corrigir tabela CONVENIOS - Adicionar tenant_id e isolamento
-- Data: 2026-06-23
-- Vulnerabilidade: Sem tenant_id, todos os convênios eram compartilhados
-- ============================================================================

-- Step 1: Adicionar coluna tenant_id
ALTER TABLE public.convenios 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Step 2: Criar índices
CREATE INDEX IF NOT EXISTS idx_convenios_tenant_id ON public.convenios(tenant_id);
CREATE INDEX IF NOT EXISTS idx_convenios_tenant_nome ON public.convenios(tenant_id, nome);

-- Step 3: Popular tenant_id para registros existentes
UPDATE public.convenios c
SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE c.tenant_id IS NULL;

-- Step 4: Tornar coluna obrigatória
ALTER TABLE public.convenios
ALTER COLUMN tenant_id SET NOT NULL;

-- Step 5: Adicionar/corrigir RLS
ALTER TABLE public.convenios ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas
DROP POLICY IF EXISTS "Convenios readable by tenant" ON public.convenios;
DROP POLICY IF EXISTS "Convenios all" ON public.convenios;

-- Step 6: Criar políticas SEGURAS
CREATE POLICY "convenios_tenant_select"
  ON public.convenios
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "convenios_tenant_insert"
  ON public.convenios
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "convenios_tenant_update"
  ON public.convenios
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "convenios_tenant_delete"
  ON public.convenios
  FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "convenios_super_admin"
  ON public.convenios
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Step 7: Trigger para proteger tenant_id
CREATE OR REPLACE FUNCTION public.prevent_convenios_tenant_change()
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

DROP TRIGGER IF EXISTS prevent_convenios_tenant_change ON public.convenios;
CREATE TRIGGER prevent_convenios_tenant_change
  BEFORE UPDATE ON public.convenios
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_convenios_tenant_change();
