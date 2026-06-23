-- EXAMES 2.2 — Desacoplamento Layout Científico (texto_interpretativo já estava removido)

ALTER TABLE public.exame_layouts
  ADD COLUMN IF NOT EXISTS metodologia text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS unidade_padrao text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS texto_interpretativo_padrao text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS exibir_metodologia_laudo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS exibir_unidade_laudo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS exibir_material_laudo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.exame_layouts.metodologia IS
  'Metodologia analítica oficial (RDC 786/2023). Substitui exames_catalogo.metodologia.';
COMMENT ON COLUMN public.exame_layouts.unidade_padrao IS
  'Unidade de medida padrão do laudo. Substitui exames_catalogo.unidade_padrao.';

-- Backfill: layouts existentes <- catálogo
UPDATE public.exame_layouts l
SET
  metodologia = COALESCE(NULLIF(c.metodologia, ''), l.metodologia),
  unidade_padrao = COALESCE(NULLIF(c.unidade_padrao, ''), l.unidade_padrao),
  exibir_metodologia_laudo = c.exibir_metodologia_laudo,
  exibir_unidade_laudo = c.exibir_unidade_laudo,
  exibir_material_laudo = c.exibir_material_laudo
FROM public.exames_catalogo c
WHERE l.exame_id = c.id;

-- Backfill: stub padrão para exames sem nenhum layout
INSERT INTO public.exame_layouts (
  exame_id, tenant_id, nome, conteudo, padrao, criado_por,
  metodologia, unidade_padrao,
  exibir_metodologia_laudo, exibir_unidade_laudo, exibir_material_laudo,
  config
)
SELECT
  c.id, c.tenant_id, 'Layout padrão', '', true, 'system:exames-2.2-backfill',
  COALESCE(c.metodologia, ''),
  COALESCE(c.unidade_padrao, ''),
  c.exibir_metodologia_laudo,
  c.exibir_unidade_laudo,
  c.exibir_material_laudo,
  '{}'::jsonb
FROM public.exames_catalogo c
WHERE NOT EXISTS (SELECT 1 FROM public.exame_layouts l WHERE l.exame_id = c.id);

-- Trigger snapshot regulatório passa a ler do layout padrão
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
        FROM public.exame_layouts
       WHERE exame_id = NEW.exame_id AND padrao = true
       ORDER BY created_at ASC LIMIT 1;
    END IF;
    IF NEW.unidade_snapshot IS NULL AND NEW.exame_id IS NOT NULL THEN
      SELECT NULLIF(unidade_padrao, '') INTO NEW.unidade_snapshot
        FROM public.exame_layouts
       WHERE exame_id = NEW.exame_id AND padrao = true
       ORDER BY created_at ASC LIMIT 1;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Dropa colunas científicas do catálogo
ALTER TABLE public.exames_catalogo
  DROP COLUMN IF EXISTS metodologia,
  DROP COLUMN IF EXISTS unidade_padrao,
  DROP COLUMN IF EXISTS exibir_metodologia_laudo,
  DROP COLUMN IF EXISTS exibir_unidade_laudo,
  DROP COLUMN IF EXISTS exibir_material_laudo;