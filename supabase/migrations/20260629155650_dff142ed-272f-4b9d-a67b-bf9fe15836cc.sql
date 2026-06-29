
-- 1) Coluna de configuração (default = manter comportamento atual)
ALTER TABLE public.tenant_lab_config
  ADD COLUMN IF NOT EXISTS rotina_coleta_analise_enabled boolean NOT NULL DEFAULT true;

-- 2) Trigger que promove exames quando a coleta/análise está desativada
CREATE OR REPLACE FUNCTION public.atendimento_exames_short_circuit_rotina()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled boolean;
BEGIN
  -- só age em INSERTs com status inicial "pendente"
  IF NEW.status IS DISTINCT FROM 'pendente' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(rotina_coleta_analise_enabled, true)
    INTO v_enabled
    FROM public.tenant_lab_config
   WHERE tenant_id = NEW.tenant_id
   LIMIT 1;

  -- ativado (ou sem config) → fluxo normal
  IF COALESCE(v_enabled, true) THEN
    RETURN NEW;
  END IF;

  -- desativado → pula coleta e análise
  NEW.status        := 'analisado';
  NEW.data_coleta   := COALESCE(NEW.data_coleta,   now());
  NEW.data_analise  := COALESCE(NEW.data_analise,  now());
  NEW.coletor       := COALESCE(NEW.coletor,  '__SEM_REGISTRO__');
  NEW.analista      := COALESCE(NEW.analista, '__SEM_REGISTRO__');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_atendimento_exames_short_circuit_rotina
  ON public.atendimento_exames;

CREATE TRIGGER trg_atendimento_exames_short_circuit_rotina
BEFORE INSERT ON public.atendimento_exames
FOR EACH ROW
EXECUTE FUNCTION public.atendimento_exames_short_circuit_rotina();
