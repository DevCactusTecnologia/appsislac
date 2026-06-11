ALTER TABLE public.tenant_lab_config ADD COLUMN IF NOT EXISTS logo_key text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_key text;