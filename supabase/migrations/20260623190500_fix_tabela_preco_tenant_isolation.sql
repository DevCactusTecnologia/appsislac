-- ============================================================================
-- Migration: Corrigir tabela TABELA_PRECO - Adicionar tenant_id
-- Data: 2026-06-23
-- Vulnerabilidade: Tabelas de preço expostas entre competidores
-- ============================================================================

ALTER TABLE public.tabela_preco 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_tabela_preco_tenant_id ON public.tabela_preco(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tabela_preco_tenant_item ON public.tabela_preco(tenant_id, item_id);

UPDATE public.tabela_preco
SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

ALTER TABLE public.tabela_preco
ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.tabela_preco ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Preco readable" ON public.tabela_preco;
DROP POLICY IF EXISTS "Preco all" ON public.tabela_preco;

CREATE POLICY "tabela_preco_tenant_select"
  ON public.tabela_preco
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "tabela_preco_tenant_insert"
  ON public.tabela_preco
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "tabela_preco_tenant_update"
  ON public.tabela_preco
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "tabela_preco_tenant_delete"
  ON public.tabela_preco
  FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "tabela_preco_super_admin"
  ON public.tabela_preco
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.prevent_tabela_preco_tenant_change()
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

DROP TRIGGER IF EXISTS prevent_tabela_preco_tenant_change ON public.tabela_preco;
CREATE TRIGGER prevent_tabela_preco_tenant_change
  BEFORE UPDATE ON public.tabela_preco
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_tabela_preco_tenant_change();
