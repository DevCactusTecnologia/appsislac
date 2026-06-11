ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS assinatura_tipo text NOT NULL DEFAULT 'carimbo',
  ADD COLUMN IF NOT EXISTS assinatura_imagem_key text,
  ADD COLUMN IF NOT EXISTS assinatura_conselho text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_assinatura_tipo_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_assinatura_tipo_check
  CHECK (assinatura_tipo IN ('carimbo', 'imagem'));