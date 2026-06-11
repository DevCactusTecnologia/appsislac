
ALTER TABLE public.exame_parametros
  ADD COLUMN IF NOT EXISTS critico_min text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS critico_max text NOT NULL DEFAULT '';

ALTER TABLE public.atendimento_audit
  ADD COLUMN IF NOT EXISTS resultado_critico boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_atendimento_audit_critico
  ON public.atendimento_audit (tenant_id, changed_at DESC)
  WHERE resultado_critico = true;
