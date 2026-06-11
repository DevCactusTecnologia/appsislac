
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS codigo text;

CREATE UNIQUE INDEX IF NOT EXISTS tenants_codigo_unique
  ON public.tenants (codigo)
  WHERE codigo IS NOT NULL;

-- Validação: só dígitos, 4 a 6 caracteres
ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_codigo_format_chk;
ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_codigo_format_chk
  CHECK (codigo IS NULL OR codigo ~ '^[0-9]{4,6}$');

-- Backfill do laboratório demo
UPDATE public.tenants
  SET codigo = '1234'
  WHERE id = '00000000-0000-0000-0000-000000000001'
    AND codigo IS NULL;
