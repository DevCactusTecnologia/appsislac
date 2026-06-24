ALTER TABLE public.exame_parametros ADD COLUMN IF NOT EXISTS formula text NOT NULL DEFAULT '';

-- Migra expressões existentes do tipo Formula (hoje em valor_referencia) para a nova coluna,
-- e libera valor_referencia para receber o texto descritivo de VR.
UPDATE public.exame_parametros
   SET formula = COALESCE(valor_referencia, ''),
       valor_referencia = ''
 WHERE tipo = 'Formula'
   AND COALESCE(formula, '') = ''
   AND COALESCE(valor_referencia, '') <> '';