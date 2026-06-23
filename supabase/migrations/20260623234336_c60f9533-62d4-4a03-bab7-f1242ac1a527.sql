ALTER TABLE public.inscricoes ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.inscricoes ADD COLUMN IF NOT EXISTS senha_hash text;