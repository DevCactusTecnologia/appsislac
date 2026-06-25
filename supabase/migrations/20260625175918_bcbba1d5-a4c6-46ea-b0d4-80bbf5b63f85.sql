
ALTER TABLE public.valores_referencia
  ADD COLUMN IF NOT EXISTS idade_min_dias integer,
  ADD COLUMN IF NOT EXISTS idade_max_dias integer;

UPDATE public.valores_referencia
SET
  idade_min_dias = CASE unidade_idade
    WHEN 'Anos'  THEN ROUND(NULLIF(REPLACE(idade_min, ',', '.'), '')::numeric * 365)
    WHEN 'Meses' THEN ROUND(NULLIF(REPLACE(idade_min, ',', '.'), '')::numeric * 30)
    WHEN 'Dias'  THEN ROUND(NULLIF(REPLACE(idade_min, ',', '.'), '')::numeric)
    ELSE NULL
  END,
  idade_max_dias = CASE unidade_idade
    WHEN 'Anos'  THEN ROUND(NULLIF(REPLACE(idade_max, ',', '.'), '')::numeric * 365)
    WHEN 'Meses' THEN ROUND(NULLIF(REPLACE(idade_max, ',', '.'), '')::numeric * 30)
    WHEN 'Dias'  THEN ROUND(NULLIF(REPLACE(idade_max, ',', '.'), '')::numeric)
    ELSE NULL
  END
WHERE idade_min_dias IS NULL OR idade_max_dias IS NULL;

CREATE INDEX IF NOT EXISTS idx_valores_referencia_idade
  ON public.valores_referencia(parametro_id, idade_min_dias, idade_max_dias);
