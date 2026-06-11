
ALTER TABLE public.atendimento_exames
  ADD COLUMN IF NOT EXISTS metodologia_snapshot text,
  ADD COLUMN IF NOT EXISTS unidade_snapshot text;

COMMENT ON COLUMN public.atendimento_exames.metodologia_snapshot IS
  'Snapshot regulatório (RDC 786/2023): metodologia congelada do catálogo no momento da finalização/liberação. Render usa COALESCE(snapshot, catalogo_vivo).';
COMMENT ON COLUMN public.atendimento_exames.unidade_snapshot IS
  'Snapshot regulatório (RDC 786/2023): unidade padrão congelada do catálogo no momento da finalização/liberação.';

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
  v_status_anterior_final := COALESCE(OLD.status IN ('finalizado','liberado') OR OLD.data_liberacao IS NOT NULL, false);

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
BEFORE UPDATE ON public.atendimento_exames
FOR EACH ROW
EXECUTE FUNCTION public.atendimento_exames_snapshot_regulatorio();
