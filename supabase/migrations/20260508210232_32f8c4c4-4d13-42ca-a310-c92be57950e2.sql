CREATE OR REPLACE FUNCTION public.atendimento_exames_snapshot_regulatorio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status_final boolean;
  v_status_anterior_final boolean;
BEGIN
  v_status_final := NEW.status IN ('finalizado','liberado') OR NEW.data_liberacao IS NOT NULL;

  IF TG_OP = 'INSERT' THEN
    v_status_anterior_final := false;
  ELSE
    v_status_anterior_final := COALESCE(OLD.status IN ('finalizado','liberado') OR OLD.data_liberacao IS NOT NULL, false);
  END IF;

  IF v_status_final AND NOT v_status_anterior_final THEN
    IF NEW.metodologia_snapshot IS NULL AND NEW.exame_id IS NOT NULL THEN
      SELECT NULLIF(metodologia, '') INTO NEW.metodologia_snapshot
        FROM public.exames_catalogo WHERE id = NEW.exame_id;
    END IF;
    IF NEW.unidade_snapshot IS NULL AND NEW.exame_id IS NOT NULL THEN
      SELECT NULLIF(unidade_padrao, '') INTO NEW.unidade_snapshot
        FROM public.exames_catalogo WHERE id = NEW.exame_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_atendimento_exames_snapshot_regulatorio ON public.atendimento_exames;
CREATE TRIGGER trg_atendimento_exames_snapshot_regulatorio
BEFORE INSERT OR UPDATE ON public.atendimento_exames
FOR EACH ROW
EXECUTE FUNCTION public.atendimento_exames_snapshot_regulatorio();