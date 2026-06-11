
-- 1) Enum: FETCH_LABEL (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'integration_job_kind'::regtype
      AND enumlabel = 'FETCH_LABEL'
  ) THEN
    ALTER TYPE integration_job_kind ADD VALUE 'FETCH_LABEL';
  END IF;
END$$;

-- 2) Colunas novas em integration_jobs (aditivas)
ALTER TABLE public.integration_jobs
  ADD COLUMN IF NOT EXISTS idempotency_key   text,
  ADD COLUMN IF NOT EXISTS correlation_id    uuid,
  ADD COLUMN IF NOT EXISTS provider_request_id text;

-- 3) Índice único parcial p/ idempotência
CREATE UNIQUE INDEX IF NOT EXISTS integration_jobs_idem_uniq
  ON public.integration_jobs(integration_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 4) Função de claim com SKIP LOCKED (lock seguro p/ múltiplos runners)
CREATE OR REPLACE FUNCTION public.claim_integration_jobs(p_batch integer DEFAULT 10)
RETURNS SETOF public.integration_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT id
    FROM public.integration_jobs
    WHERE status IN ('PENDING','FAILED')
      AND scheduled_at <= now()
      AND (next_retry_at IS NULL OR next_retry_at <= now())
    ORDER BY priority ASC, scheduled_at ASC
    LIMIT GREATEST(p_batch, 1)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.integration_jobs j
     SET status = 'PROCESSING',
         started_at = now()
   FROM picked
   WHERE j.id = picked.id
   RETURNING j.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_integration_jobs(integer) FROM PUBLIC, anon, authenticated;
