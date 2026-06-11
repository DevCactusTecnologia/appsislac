-- Tabela de telemetria de execuções de cron jobs
CREATE TABLE IF NOT EXISTS public.cron_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  duration_ms integer NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('ok','error')),
  items_processed integer NOT NULL DEFAULT 0,
  error_message text,
  context jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cron_health_job_started
  ON public.cron_health (job_name, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_cron_health_status_started
  ON public.cron_health (status, started_at DESC);

ALTER TABLE public.cron_health ENABLE ROW LEVEL SECURITY;

-- Apenas super_admin pode ler (escrita é via service-role nas edge functions)
DROP POLICY IF EXISTS "super_admin_select_cron_health" ON public.cron_health;
CREATE POLICY "super_admin_select_cron_health"
  ON public.cron_health
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "super_admin_delete_cron_health" ON public.cron_health;
CREATE POLICY "super_admin_delete_cron_health"
  ON public.cron_health
  FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

-- Helper RPC para inserir telemetria de forma padronizada (chamada via service-role)
CREATE OR REPLACE FUNCTION public.cron_health_record(
  p_job_name text,
  p_started_at timestamptz,
  p_duration_ms integer,
  p_status text,
  p_items_processed integer DEFAULT 0,
  p_error_message text DEFAULT NULL,
  p_context jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.cron_health (
    job_name, started_at, duration_ms, status,
    items_processed, error_message, context
  ) VALUES (
    p_job_name, p_started_at, p_duration_ms, p_status,
    COALESCE(p_items_processed, 0), p_error_message, p_context
  )
  RETURNING id INTO v_id;

  -- Retenção curta: mantém apenas últimos 14 dias por job (best-effort)
  DELETE FROM public.cron_health
   WHERE job_name = p_job_name
     AND started_at < now() - interval '14 days';

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.cron_health_record(text, timestamptz, integer, text, integer, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cron_health_record(text, timestamptz, integer, text, integer, text, jsonb) TO service_role;