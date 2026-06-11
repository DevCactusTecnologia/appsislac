CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Public read so the cleanup edge function and the frontend can read the
-- current PDF retention without authentication. Writes go through an
-- admin-only edge function (service role), never client-side.
DROP POLICY IF EXISTS "App settings are publicly readable" ON public.app_settings;
CREATE POLICY "App settings are publicly readable"
ON public.app_settings
FOR SELECT
USING (true);

CREATE OR REPLACE FUNCTION public.touch_app_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER trg_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_app_settings_updated_at();

-- Seed default retention (30 days)
INSERT INTO public.app_settings (key, value)
VALUES ('pdf_retention_days', '30'::jsonb)
ON CONFLICT (key) DO NOTHING;