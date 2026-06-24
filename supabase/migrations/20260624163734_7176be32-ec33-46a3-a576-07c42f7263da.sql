ALTER TABLE public.valores_referencia
  ADD COLUMN IF NOT EXISTS critico_min text NULL,
  ADD COLUMN IF NOT EXISTS critico_max text NULL;

COMMENT ON COLUMN public.valores_referencia.critico_min IS 'Valor crítico mínimo (pânico) específico para esta combinação de sexo/idade. NULL = usar fallback de exame_parametros.';
COMMENT ON COLUMN public.valores_referencia.critico_max IS 'Valor crítico máximo (pânico) específico para esta combinação de sexo/idade. NULL = usar fallback de exame_parametros.';