
ALTER TABLE public.exames_catalogo
  ADD COLUMN IF NOT EXISTS material_id uuid NULL REFERENCES public.materiais_amostra(id) ON DELETE SET NULL;

ALTER TABLE public.atendimento_exames
  ADD COLUMN IF NOT EXISTS material_id uuid NULL REFERENCES public.materiais_amostra(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_exames_catalogo_material_id
  ON public.exames_catalogo(material_id) WHERE material_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_atendimento_exames_material_id
  ON public.atendimento_exames(material_id) WHERE material_id IS NOT NULL;
