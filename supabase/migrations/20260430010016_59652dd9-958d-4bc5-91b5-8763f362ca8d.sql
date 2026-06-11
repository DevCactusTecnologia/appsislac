ALTER TABLE public.atendimento_exames
  ADD COLUMN IF NOT EXISTS solicitante text NOT NULL DEFAULT '';