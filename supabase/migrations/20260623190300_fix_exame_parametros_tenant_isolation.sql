-- ============================================================================
-- Migration: Corrigir tabela EXAME_PARAMETROS - Adicionar tenant_id
-- Data: 2026-06-23
-- Vulnerabilidade: USING(true) permitia ler parâmetros de todos os labs
-- ============================================================================

ALTER TABLE public.exame_parametros 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_exame_parametros_tenant_id ON public.exame_parametros(tenant_id);

UPDATE public.exame_parametros
SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

ALTER TABLE public.exame_parametros
ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.exame_parametros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Visualizar parametros autenticado" ON public.exame_parametros;

CREATE POLICY "exame_parametros_tenant_select"
  ON public.exame_parametros
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "exame_parametros_tenant_insert"
  ON public.exame_parametros
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "exame_parametros_tenant_update"
  ON public.exame_parametros
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "exame_parametros_tenant_delete"
  ON public.exame_parametros
  FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "exame_parametros_super_admin"
  ON public.exame_parametros
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.prevent_exame_parametros_tenant_change()
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

DROP TRIGGER IF EXISTS prevent_exame_parametros_tenant_change ON public.exame_parametros;
CREATE TRIGGER prevent_exame_parametros_tenant_change
  BEFORE UPDATE ON public.exame_parametros
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_exame_parametros_tenant_change();
