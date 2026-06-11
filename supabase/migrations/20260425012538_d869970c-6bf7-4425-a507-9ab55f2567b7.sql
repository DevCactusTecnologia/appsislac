ALTER TABLE public.tenant_settings_public
ADD COLUMN IF NOT EXISTS tema TEXT NOT NULL DEFAULT 'indigo';

-- Restringe aos presets suportados
ALTER TABLE public.tenant_settings_public
DROP CONSTRAINT IF EXISTS tenant_settings_public_tema_check;

ALTER TABLE public.tenant_settings_public
ADD CONSTRAINT tenant_settings_public_tema_check
CHECK (tema IN ('indigo','emerald','rose','ocean','amber','violet'));