ALTER TABLE public.exame_parametros
  ADD COLUMN IF NOT EXISTS separador_decimal text NOT NULL DEFAULT '.',
  ADD COLUMN IF NOT EXISTS qtd_digitos smallint;

ALTER TABLE public.exame_parametros
  DROP CONSTRAINT IF EXISTS exame_parametros_separador_decimal_chk;

ALTER TABLE public.exame_parametros
  ADD CONSTRAINT exame_parametros_separador_decimal_chk
  CHECK (separador_decimal IN ('.', ','));