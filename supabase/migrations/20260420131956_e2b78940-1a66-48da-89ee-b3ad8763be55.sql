-- Adiciona template_key à tabela de mapas de trabalho.
-- 'auto' (padrão) mantém o comportamento atual de detecção por nome do exame.
-- Valores explícitos forçam o layout: hemogram, hiv, urina, fezes, others.
ALTER TABLE public.mapas_trabalho
  ADD COLUMN IF NOT EXISTS template_key text NOT NULL DEFAULT 'auto';

-- Restringe valores aceitos.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mapas_trabalho_template_key_check'
  ) THEN
    ALTER TABLE public.mapas_trabalho
      ADD CONSTRAINT mapas_trabalho_template_key_check
      CHECK (template_key IN ('auto','hemogram','hiv','urina','fezes','others'));
  END IF;
END$$;

COMMENT ON COLUMN public.mapas_trabalho.template_key IS
  'Layout visual do mapa: auto (detecta pelo nome do exame), hemogram, hiv, urina, fezes, others.';