-- =============================================================
-- Consolidação canônica do destino operacional do exame.
--
-- A partir desta migration, a fonte oficial de verdade é:
--   tipo_processo  ('INTERNO' | 'TERCEIRIZADO')
--   lab_apoio_id   (uuid do laboratório de apoio, NULL quando INTERNO)
--
-- O campo `analise` ('INTERNA' | 'EXTERNA' | '<uuid>') é LEGADO.
-- Mantemos a coluna por compatibilidade temporária com leitores antigos,
-- mas ela passa a ser DERIVADA via trigger — nunca mais editada manualmente
-- como fonte de verdade.
-- =============================================================

-- 1) Backfill defensivo: garante consistência total entre colunas.
--    (Auditoria atual já indica zero inconsistências, então é idempotente.)
UPDATE public.exames_catalogo
SET tipo_processo = 'TERCEIRIZADO'
WHERE lab_apoio_id IS NOT NULL
  AND tipo_processo IS DISTINCT FROM 'TERCEIRIZADO';

UPDATE public.exames_catalogo
SET tipo_processo = 'INTERNO',
    lab_apoio_id  = NULL
WHERE tipo_processo = 'INTERNO'
  AND lab_apoio_id IS NOT NULL;

-- Caso raro: marcado como TERCEIRIZADO mas sem lab_apoio_id → restaura para INTERNO
UPDATE public.exames_catalogo
SET tipo_processo = 'INTERNO'
WHERE tipo_processo = 'TERCEIRIZADO'
  AND lab_apoio_id IS NULL;

-- Backfill do legado `analise` quando ele estiver fora de sincronia
-- (mantém coluna preenchida e coerente para qualquer leitor antigo).
UPDATE public.exames_catalogo
SET analise = CASE
  WHEN tipo_processo = 'TERCEIRIZADO' AND lab_apoio_id IS NOT NULL THEN lab_apoio_id::text
  ELSE 'INTERNA'
END
WHERE analise IS DISTINCT FROM CASE
  WHEN tipo_processo = 'TERCEIRIZADO' AND lab_apoio_id IS NOT NULL THEN lab_apoio_id::text
  ELSE 'INTERNA'
END;

-- 2) Trigger de sincronização: `analise` é DERIVADO de tipo_processo + lab_apoio_id.
--    Qualquer INSERT/UPDATE futuro reescreve `analise` automaticamente,
--    eliminando drift semântico para sempre.
CREATE OR REPLACE FUNCTION public.sync_exame_analise_legacy()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo_processo = 'TERCEIRIZADO' AND NEW.lab_apoio_id IS NOT NULL THEN
    NEW.analise := NEW.lab_apoio_id::text;
  ELSE
    NEW.analise := 'INTERNA';
    -- Defesa adicional: se marcado como TERCEIRIZADO sem lab, força INTERNO.
    IF NEW.tipo_processo = 'TERCEIRIZADO' AND NEW.lab_apoio_id IS NULL THEN
      NEW.tipo_processo := 'INTERNO';
    END IF;
    -- Limpa lab_apoio_id quando INTERNO.
    IF NEW.tipo_processo = 'INTERNO' AND NEW.lab_apoio_id IS NOT NULL THEN
      NEW.lab_apoio_id := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_exame_analise_legacy ON public.exames_catalogo;
CREATE TRIGGER trg_sync_exame_analise_legacy
BEFORE INSERT OR UPDATE OF tipo_processo, lab_apoio_id, analise
ON public.exames_catalogo
FOR EACH ROW
EXECUTE FUNCTION public.sync_exame_analise_legacy();

COMMENT ON COLUMN public.exames_catalogo.analise IS
  'DEPRECATED: mantido por compatibilidade. Fonte oficial = tipo_processo + lab_apoio_id. Sincronizado automaticamente via trigger trg_sync_exame_analise_legacy.';