
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tipo_profissional text,
  ADD COLUMN IF NOT EXISTS cbo text,
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS cns text,
  ADD COLUMN IF NOT EXISTS conselho_classe text,
  ADD COLUMN IF NOT EXISTS conselho_uf text,
  ADD COLUMN IF NOT EXISTS conselho_numero text;

COMMENT ON COLUMN public.profiles.tipo_profissional IS 'Tipo profissional do analista (ex.: Biomédico, Farmacêutica, Bioquímico Citologista).';
COMMENT ON COLUMN public.profiles.cbo IS 'Código Brasileiro de Ocupações.';
COMMENT ON COLUMN public.profiles.cpf IS 'CPF do profissional (texto, mascarado).';
COMMENT ON COLUMN public.profiles.cns IS 'Cartão Nacional de Saúde do profissional.';
COMMENT ON COLUMN public.profiles.conselho_classe IS 'Conselho de classe (CRBM, CRF, CRBio etc.).';
COMMENT ON COLUMN public.profiles.conselho_uf IS 'UF emissora do conselho.';
COMMENT ON COLUMN public.profiles.conselho_numero IS 'Número do registro no conselho.';
