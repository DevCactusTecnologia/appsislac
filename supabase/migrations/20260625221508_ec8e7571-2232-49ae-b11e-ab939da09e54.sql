ALTER TABLE public.valores_referencia
  ADD COLUMN IF NOT EXISTS unidade_idade_max text NOT NULL DEFAULT 'Anos';

-- Backfill: faz a unidade do "até" começar igual à do "de" (modelo antigo)
UPDATE public.valores_referencia
   SET unidade_idade_max = unidade_idade
 WHERE unidade_idade_max IS DISTINCT FROM unidade_idade;