-- Fase 3: extensões nas tabelas existentes (idempotente)

ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'MOCK',
  ADD COLUMN IF NOT EXISTS wsdl_url text,
  ADD COLUMN IF NOT EXISTS soap_action_prefix text;

DO $$ BEGIN
  ALTER TABLE public.integrations
    ADD CONSTRAINT integrations_mode_chk CHECK (mode IN ('MOCK','HOMOLOG','PROD'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.integration_credentials
  ADD COLUMN IF NOT EXISTS password_encrypted text,
  ADD COLUMN IF NOT EXISTS key_version integer NOT NULL DEFAULT 1;

ALTER TABLE public.integration_pdfs
  ADD COLUMN IF NOT EXISTS mime_type text NOT NULL DEFAULT 'application/pdf',
  ADD COLUMN IF NOT EXISTS source_url text;

ALTER TABLE public.integration_results
  ADD COLUMN IF NOT EXISTS pendencias jsonb,
  ADD COLUMN IF NOT EXISTS rastreabilidade jsonb;

CREATE INDEX IF NOT EXISTS idx_int_jobs_pending_sched
  ON public.integration_jobs(scheduled_at)
  WHERE status = 'PENDING';
