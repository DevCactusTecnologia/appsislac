-- Tabela dedicada a configurações globais do SaaS (não vinculadas a tenant)
CREATE TABLE IF NOT EXISTS public.saas_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.saas_settings ENABLE ROW LEVEL SECURITY;

-- Apenas super admin pode ler/escrever
CREATE POLICY saas_settings_select ON public.saas_settings
  FOR SELECT
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY saas_settings_insert ON public.saas_settings
  FOR INSERT
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY saas_settings_update ON public.saas_settings
  FOR UPDATE
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY saas_settings_delete ON public.saas_settings
  FOR DELETE
  USING (public.is_super_admin(auth.uid()));

-- Trigger para updated_at + updated_by automáticos
CREATE OR REPLACE FUNCTION public.touch_saas_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_saas_settings ON public.saas_settings;
CREATE TRIGGER trg_touch_saas_settings
  BEFORE INSERT OR UPDATE ON public.saas_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_saas_settings();