
-- 1) valores_referencia: dimensão de risco CV
ALTER TABLE public.valores_referencia
  ADD COLUMN IF NOT EXISTS risco_cv text NOT NULL DEFAULT 'qualquer';

ALTER TABLE public.valores_referencia
  DROP CONSTRAINT IF EXISTS valores_referencia_risco_cv_chk;
ALTER TABLE public.valores_referencia
  ADD CONSTRAINT valores_referencia_risco_cv_chk
  CHECK (risco_cv IN ('qualquer','baixo','intermediario','alto','muito_alto'));

-- 2) exame_parametros: toggles que ativam dimensões extras na matriz de VR
ALTER TABLE public.exame_parametros
  ADD COLUMN IF NOT EXISTS sensivel_jejum boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS estratificado_risco_cv boolean NOT NULL DEFAULT false;

-- 3) atendimentos: classificação opcional de risco cardiovascular do paciente
ALTER TABLE public.atendimentos
  ADD COLUMN IF NOT EXISTS risco_cardiovascular text;

ALTER TABLE public.atendimentos
  DROP CONSTRAINT IF EXISTS atendimentos_risco_cv_chk;
ALTER TABLE public.atendimentos
  ADD CONSTRAINT atendimentos_risco_cv_chk
  CHECK (risco_cardiovascular IS NULL OR risco_cardiovascular IN ('baixo','intermediario','alto','muito_alto'));
