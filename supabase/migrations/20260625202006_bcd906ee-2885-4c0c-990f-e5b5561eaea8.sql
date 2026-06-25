ALTER TABLE public.valores_referencia
  ADD COLUMN IF NOT EXISTS jejum text NOT NULL DEFAULT 'qualquer',
  ADD COLUMN IF NOT EXISTS operador text NOT NULL DEFAULT 'entre';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valores_referencia_jejum_check') THEN
    ALTER TABLE public.valores_referencia
      ADD CONSTRAINT valores_referencia_jejum_check
      CHECK (jejum IN ('qualquer','com_jejum','sem_jejum'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valores_referencia_operador_check') THEN
    ALTER TABLE public.valores_referencia
      ADD CONSTRAINT valores_referencia_operador_check
      CHECK (operador IN ('entre','menor','menor_igual','maior','maior_igual','igual'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_valores_referencia_jejum
  ON public.valores_referencia (exame_nome, parametro_nome)
  WHERE jejum <> 'qualquer';
