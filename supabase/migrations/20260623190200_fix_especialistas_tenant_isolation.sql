-- ============================================================================
-- Migration: Corrigir tabela ESPECIALISTAS - Adicionar tenant_id e isolamento
-- Data: 2026-06-23
-- Vulnerabilidade: USING(true) permitia ler especialistas de todos os labs
-- ============================================================================

ALTER TABLE public.especialistas 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_especialistas_tenant_id ON public.especialistas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_especialistas_tenant_nome ON public.especialistas(tenant_id, nome);

UPDATE public.especialistas
SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

ALTER TABLE public.especialistas
ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.especialistas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read especialistas" ON public.especialistas;
DROP POLICY IF EXISTS "Especialistas readable" ON public.especialistas;

CREATE POLICY "especialistas_tenant_select"
  ON public.especialistas
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "especialistas_tenant_insert"
  ON public.especialistas
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "especialistas_tenant_update"
  ON public.especialistas
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "especialistas_tenant_delete"
  ON public.especialistas
  FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "especialistas_super_admin"
  ON public.especialistas
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.prevent_especialistas_tenant_change()
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

DROP TRIGGER IF EXISTS prevent_especialistas_tenant_change ON public.especialistas;
CREATE TRIGGER prevent_especialistas_tenant_change
  BEFORE UPDATE ON public.especialistas
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_especialistas_tenant_change();
