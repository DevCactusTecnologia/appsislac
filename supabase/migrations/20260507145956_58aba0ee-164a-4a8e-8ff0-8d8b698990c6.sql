-- 1) Vínculo lab_apoio → integration (opcional, 1:1 lógico por tenant)
ALTER TABLE public.labs_apoio
  ADD COLUMN IF NOT EXISTS integration_id uuid REFERENCES public.integrations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_labs_apoio_integration
  ON public.labs_apoio(integration_id) WHERE integration_id IS NOT NULL;

-- 2) Índice de fila do runner
CREATE INDEX IF NOT EXISTS idx_integration_jobs_runner
  ON public.integration_jobs(status, scheduled_at)
  WHERE status IN ('PENDING','FAILED');

-- 3) Trigger: integration_results -> atendimento_exames
CREATE OR REPLACE FUNCTION public.propagate_integration_result_to_exame()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status_externo text;
  v_resultado_importado boolean;
  v_status_exame text;
BEGIN
  IF NEW.atendimento_exame_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'FINAL' THEN
    v_status_externo := 'IMPORTADO';
    v_resultado_importado := true;
    v_status_exame := 'finalizado';
  ELSIF NEW.status = 'PARCIAL' THEN
    v_status_externo := 'RESULTADO_RECEBIDO';
    v_resultado_importado := false;
    v_status_exame := NULL;
  ELSE
    -- PENDENTE / ERRO: não propaga
    RETURN NEW;
  END IF;

  UPDATE public.atendimento_exames
     SET status_externo       = v_status_externo,
         resultado_importado  = v_resultado_importado,
         data_retorno         = COALESCE(NEW.liberado_em, now()),
         data_liberacao       = CASE WHEN v_resultado_importado THEN COALESCE(NEW.liberado_em, now()) ELSE data_liberacao END,
         status               = COALESCE(v_status_exame, status),
         updated_at           = now()
   WHERE id = NEW.atendimento_exame_id
     AND tenant_id = NEW.tenant_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_integration_result ON public.integration_results;
CREATE TRIGGER trg_propagate_integration_result
AFTER INSERT OR UPDATE OF status, liberado_em
ON public.integration_results
FOR EACH ROW
EXECUTE FUNCTION public.propagate_integration_result_to_exame();