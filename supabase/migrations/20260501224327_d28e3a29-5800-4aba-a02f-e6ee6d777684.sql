-- Função: auto-preenche motivo_nome a partir de motivo_id se faltar; bloqueia se vazio
CREATE OR REPLACE FUNCTION public.ensure_recoleta_motivo_nome()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.motivo_id IS NOT NULL 
     AND (NEW.motivo_nome IS NULL OR btrim(NEW.motivo_nome) = '') THEN
    SELECT nome INTO NEW.motivo_nome
    FROM public.recoletas_motivos
    WHERE id = NEW.motivo_id;
  END IF;

  IF NEW.motivo_nome IS NULL OR btrim(NEW.motivo_nome) = '' THEN
    RAISE EXCEPTION 'Motivo da recoleta é obrigatório (motivo_nome não pode ser vazio)'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_recoleta_motivo_nome ON public.recoletas;
CREATE TRIGGER trg_ensure_recoleta_motivo_nome
BEFORE INSERT OR UPDATE ON public.recoletas
FOR EACH ROW
EXECUTE FUNCTION public.ensure_recoleta_motivo_nome();

CREATE INDEX IF NOT EXISTS idx_recoletas_motivo_id ON public.recoletas(motivo_id);

COMMENT ON COLUMN public.recoletas.motivo_id IS 
  'Referência opcional para recoletas_motivos (ON DELETE SET NULL). Pode ficar NULL se o motivo for apagado — motivo_nome preserva o texto histórico.';
COMMENT ON COLUMN public.recoletas.motivo_nome IS 
  'Snapshot textual do motivo no momento do registro. Sempre preenchido (auto-copiado de motivo_id via trigger ensure_recoleta_motivo_nome). Garante integridade de relatórios.';