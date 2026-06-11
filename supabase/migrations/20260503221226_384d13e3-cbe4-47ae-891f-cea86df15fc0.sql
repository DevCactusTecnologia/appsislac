
-- 1. Padroniza status
UPDATE public.solicitacoes_publicas SET status = 'NOVO' WHERE status IN ('PENDENTE', 'pendente', 'novo');

ALTER TABLE public.solicitacoes_publicas
  ALTER COLUMN status SET DEFAULT 'NOVO';

-- Constraint validando os 4 valores permitidos
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'solicitacoes_publicas_status_chk') THEN
    ALTER TABLE public.solicitacoes_publicas DROP CONSTRAINT solicitacoes_publicas_status_chk;
  END IF;
END $$;

ALTER TABLE public.solicitacoes_publicas
  ADD CONSTRAINT solicitacoes_publicas_status_chk
  CHECK (status IN ('NOVO', 'EM_CONTATO', 'CONVERTIDO', 'DESCARTADO'));

-- 2. Novos campos
ALTER TABLE public.solicitacoes_publicas
  ADD COLUMN IF NOT EXISTS lida boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS convertido_atendimento_id text,
  ADD COLUMN IF NOT EXISTS convertido_em timestamptz,
  ADD COLUMN IF NOT EXISTS notas_internas text NOT NULL DEFAULT '';

-- 3. Índices
CREATE INDEX IF NOT EXISTS idx_solicpub_tenant_status
  ON public.solicitacoes_publicas (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_solicpub_tenant_unread
  ON public.solicitacoes_publicas (tenant_id) WHERE lida = false;

-- 4. Realtime
ALTER TABLE public.solicitacoes_publicas REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'solicitacoes_publicas'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.solicitacoes_publicas';
  END IF;
END $$;
