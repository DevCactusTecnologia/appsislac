
CREATE TABLE IF NOT EXISTS public.reguas_etarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  nome text NOT NULL,
  sistema boolean NOT NULL DEFAULT false,
  faixas jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reguas_etarias TO authenticated;
GRANT ALL ON public.reguas_etarias TO service_role;

ALTER TABLE public.reguas_etarias ENABLE ROW LEVEL SECURITY;

CREATE POLICY reguas_select ON public.reguas_etarias FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR tenant_id = current_tenant_id());

CREATE POLICY reguas_insert ON public.reguas_etarias FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY reguas_update ON public.reguas_etarias FOR UPDATE TO authenticated
  USING (tenant_id = current_tenant_id() AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY reguas_delete ON public.reguas_etarias FOR DELETE TO authenticated
  USING (tenant_id = current_tenant_id() AND has_role(auth.uid(), 'admin'::app_role) AND sistema = false);

CREATE INDEX IF NOT EXISTS idx_reguas_etarias_tenant ON public.reguas_etarias(tenant_id);

CREATE OR REPLACE FUNCTION public.reguas_etarias_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_reguas_etarias_updated_at
  BEFORE UPDATE ON public.reguas_etarias
  FOR EACH ROW EXECUTE FUNCTION public.reguas_etarias_set_updated_at();
