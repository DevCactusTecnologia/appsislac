ALTER TABLE public.exame_parametros
ADD COLUMN IF NOT EXISTS casas_decimais smallint NOT NULL DEFAULT 2;