-- Adiciona coluna opcoes_select para tipo Select e índice em (exame_id, ordem) para reordenação rápida
ALTER TABLE public.exame_parametros
  ADD COLUMN IF NOT EXISTS opcoes_select text[] NOT NULL DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS idx_exame_parametros_exame_ordem
  ON public.exame_parametros(exame_id, ordem);

-- Constraint de chave única por exame (evita placeholders duplicados que quebram laudos)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exame_parametros_chave_unica_por_exame'
  ) THEN
    ALTER TABLE public.exame_parametros
      ADD CONSTRAINT exame_parametros_chave_unica_por_exame
      UNIQUE (exame_id, chave);
  END IF;
END $$;