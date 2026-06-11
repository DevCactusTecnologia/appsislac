ALTER TABLE public.tenant_settings_public
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS og_image_url text,
  ADD COLUMN IF NOT EXISTS hero_image_url text,
  ADD COLUMN IF NOT EXISTS sobre_image_url text,
  ADD COLUMN IF NOT EXISTS servicos_images jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS unidades_images jsonb NOT NULL DEFAULT '{}'::jsonb;
