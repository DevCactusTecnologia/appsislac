ALTER TABLE public.atendimentos
  ADD COLUMN IF NOT EXISTS prioridade_clinica text NOT NULL DEFAULT 'normal';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'atendimentos_prioridade_clinica_check'
  ) THEN
    ALTER TABLE public.atendimentos
      ADD CONSTRAINT atendimentos_prioridade_clinica_check
      CHECK (prioridade_clinica IN ('normal','urgencia','emergencia'));
  END IF;
END $$;

COMMENT ON COLUMN public.atendimentos.prioridade_clinica IS
  'Prioridade clínica do atendimento: normal | urgencia | emergencia. Definida no Novo Atendimento.';