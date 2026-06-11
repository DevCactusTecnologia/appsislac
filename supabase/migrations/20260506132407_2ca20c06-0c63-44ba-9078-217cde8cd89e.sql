ALTER TABLE public.tenant_settings_public
  ADD COLUMN IF NOT EXISTS secoes_visiveis jsonb NOT NULL DEFAULT '{}'::jsonb;