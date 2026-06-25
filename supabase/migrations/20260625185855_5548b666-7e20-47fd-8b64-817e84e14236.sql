-- Permite que uma régua etária seja específica de um exame (NULL = global/compartilhada).
ALTER TABLE public.reguas_etarias
  ADD COLUMN IF NOT EXISTS exame_id uuid NULL REFERENCES public.exames_catalogo(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_reguas_etarias_exame ON public.reguas_etarias(exame_id) WHERE exame_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reguas_etarias_tenant ON public.reguas_etarias(tenant_id);