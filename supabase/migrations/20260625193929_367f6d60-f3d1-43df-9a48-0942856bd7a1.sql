ALTER TABLE public.valores_referencia
  ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS prioridade integer NOT NULL DEFAULT 0;

ALTER TABLE public.valores_referencia
  DROP CONSTRAINT IF EXISTS valores_referencia_categoria_check;

ALTER TABLE public.valores_referencia
  ADD CONSTRAINT valores_referencia_categoria_check
  CHECK (categoria IN ('padrao','gestante','recem_nascido','crianca','adolescente','adulto','idoso','masculino','feminino','custom'));

-- Prioridade derivada da categoria (maior = vence). Padrão é fallback (1).
UPDATE public.valores_referencia
SET prioridade = CASE categoria
  WHEN 'gestante' THEN 100
  WHEN 'recem_nascido' THEN 90
  WHEN 'crianca' THEN 80
  WHEN 'adolescente' THEN 70
  WHEN 'idoso' THEN 60
  WHEN 'adulto' THEN 50
  WHEN 'masculino' THEN 40
  WHEN 'feminino' THEN 40
  WHEN 'custom' THEN 30
  WHEN 'padrao' THEN 1
  ELSE 0
END
WHERE prioridade = 0;

CREATE INDEX IF NOT EXISTS idx_valores_referencia_parametro_categoria
  ON public.valores_referencia (parametro_id, categoria);

-- Trigger para manter prioridade em sincronia com categoria automaticamente
CREATE OR REPLACE FUNCTION public.valores_referencia_set_prioridade()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.prioridade := CASE NEW.categoria
    WHEN 'gestante' THEN 100
    WHEN 'recem_nascido' THEN 90
    WHEN 'crianca' THEN 80
    WHEN 'adolescente' THEN 70
    WHEN 'idoso' THEN 60
    WHEN 'adulto' THEN 50
    WHEN 'masculino' THEN 40
    WHEN 'feminino' THEN 40
    WHEN 'custom' THEN 30
    WHEN 'padrao' THEN 1
    ELSE 0
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_valores_referencia_set_prioridade ON public.valores_referencia;
CREATE TRIGGER trg_valores_referencia_set_prioridade
  BEFORE INSERT OR UPDATE OF categoria ON public.valores_referencia
  FOR EACH ROW EXECUTE FUNCTION public.valores_referencia_set_prioridade();