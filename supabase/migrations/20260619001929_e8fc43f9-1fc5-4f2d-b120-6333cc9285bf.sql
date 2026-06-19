ALTER TABLE public.pacientes ALTER COLUMN cpf DROP NOT NULL;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS nome_social TEXT;