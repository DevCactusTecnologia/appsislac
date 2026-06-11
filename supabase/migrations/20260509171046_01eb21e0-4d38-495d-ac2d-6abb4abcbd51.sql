
-- Resiliência Enterprise: Circuit Breaker + DLQ + Health Metrics

-- 1) provider_circuit_state
CREATE TABLE IF NOT EXISTS public.provider_circuit_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  provider text NOT NULL,
  state text NOT NULL DEFAULT 'CLOSED' CHECK (state IN ('CLOSED','OPEN','HALF_OPEN')),
  consecutive_failures int NOT NULL DEFAULT 0,
  opened_at timestamptz,
  half_open_at timestamptz,
  next_probe_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  window_start timestamptz NOT NULL DEFAULT now(),
  failure_count int NOT NULL DEFAULT 0,
  success_count int NOT NULL DEFAULT 0,
  timeout_count int NOT NULL DEFAULT 0,
  open_streak int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider)
);
ALTER TABLE public.provider_circuit_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pcs_select ON public.provider_circuit_state;
CREATE POLICY pcs_select ON public.provider_circuit_state
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS pcs_insert ON public.provider_circuit_state;
CREATE POLICY pcs_insert ON public.provider_circuit_state
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS pcs_update ON public.provider_circuit_state;
CREATE POLICY pcs_update ON public.provider_circuit_state
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS pcs_delete ON public.provider_circuit_state;
CREATE POLICY pcs_delete ON public.provider_circuit_state
  FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.circuit_should_allow(p_tenant uuid, p_provider text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.provider_circuit_state%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.provider_circuit_state
   WHERE tenant_id = p_tenant AND provider = p_provider FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.provider_circuit_state (tenant_id, provider) VALUES (p_tenant, p_provider)
      ON CONFLICT (tenant_id, provider) DO NOTHING;
    RETURN true;
  END IF;
  IF v_row.state IN ('CLOSED','HALF_OPEN') THEN RETURN true; END IF;
  IF v_row.next_probe_at IS NOT NULL AND now() >= v_row.next_probe_at THEN
    UPDATE public.provider_circuit_state
       SET state = 'HALF_OPEN', half_open_at = now(), updated_at = now()
     WHERE id = v_row.id;
    RETURN true;
  END IF;
  RETURN false;
END;$$;

CREATE OR REPLACE FUNCTION public.circuit_record_success(p_tenant uuid, p_provider text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.provider_circuit_state (tenant_id, provider, state, last_success_at, success_count)
  VALUES (p_tenant, p_provider, 'CLOSED', now(), 1)
  ON CONFLICT (tenant_id, provider) DO UPDATE
    SET state = 'CLOSED',
        consecutive_failures = 0,
        opened_at = NULL,
        next_probe_at = NULL,
        open_streak = 0,
        last_success_at = now(),
        success_count = public.provider_circuit_state.success_count + 1,
        updated_at = now();
END;$$;

CREATE OR REPLACE FUNCTION public.circuit_record_failure(
  p_tenant uuid, p_provider text, p_kind text DEFAULT 'failure'
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.provider_circuit_state%ROWTYPE; v_threshold int := 5; v_backoff_seconds int;
BEGIN
  INSERT INTO public.provider_circuit_state (tenant_id, provider) VALUES (p_tenant, p_provider)
    ON CONFLICT (tenant_id, provider) DO NOTHING;
  SELECT * INTO v_row FROM public.provider_circuit_state
   WHERE tenant_id = p_tenant AND provider = p_provider FOR UPDATE;
  UPDATE public.provider_circuit_state
     SET consecutive_failures = v_row.consecutive_failures + 1,
         failure_count = v_row.failure_count + 1,
         timeout_count = v_row.timeout_count + (CASE WHEN p_kind='timeout' THEN 1 ELSE 0 END),
         last_failure_at = now(), updated_at = now()
   WHERE id = v_row.id;
  SELECT * INTO v_row FROM public.provider_circuit_state WHERE id = v_row.id;
  IF v_row.consecutive_failures >= v_threshold OR v_row.state = 'HALF_OPEN' THEN
    v_backoff_seconds := LEAST(300, 30 * GREATEST(1, v_row.open_streak + 1));
    UPDATE public.provider_circuit_state
       SET state = 'OPEN', opened_at = now(),
           next_probe_at = now() + make_interval(secs => v_backoff_seconds),
           open_streak = v_row.open_streak + 1, updated_at = now()
     WHERE id = v_row.id;
  END IF;
END;$$;

GRANT EXECUTE ON FUNCTION public.circuit_should_allow(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.circuit_record_success(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.circuit_record_failure(uuid, text, text) TO authenticated, service_role;

-- 2) integration_dead_jobs (DLQ)
CREATE TABLE IF NOT EXISTS public.integration_dead_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  integration_id uuid NOT NULL,
  provider text NOT NULL,
  original_job_id uuid,
  kind text NOT NULL,
  correlation_id uuid,
  death_reason text NOT NULL,
  death_message text,
  payload jsonb NOT NULL,
  request_envelope text,
  response_body text,
  stacktrace text,
  retry_history jsonb,
  died_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_idj_tenant_provider_died
  ON public.integration_dead_jobs (tenant_id, provider, died_at DESC);
CREATE INDEX IF NOT EXISTS idx_idj_original
  ON public.integration_dead_jobs (original_job_id);
ALTER TABLE public.integration_dead_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS idj_select ON public.integration_dead_jobs;
CREATE POLICY idj_select ON public.integration_dead_jobs
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS idj_insert ON public.integration_dead_jobs;
CREATE POLICY idj_insert ON public.integration_dead_jobs
  FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS idj_update ON public.integration_dead_jobs;
CREATE POLICY idj_update ON public.integration_dead_jobs
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS idj_delete ON public.integration_dead_jobs;
CREATE POLICY idj_delete ON public.integration_dead_jobs
  FOR DELETE TO authenticated USING (public.is_super_admin(auth.uid()));

-- 3) provider_health_metrics
CREATE TABLE IF NOT EXISTS public.provider_health_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  provider text NOT NULL,
  window_start timestamptz NOT NULL,
  total_latency_ms bigint NOT NULL DEFAULT 0,
  max_latency_ms int NOT NULL DEFAULT 0,
  success_count int NOT NULL DEFAULT 0,
  failure_count int NOT NULL DEFAULT 0,
  timeout_count int NOT NULL DEFAULT 0,
  transport_error_count int NOT NULL DEFAULT 0,
  retry_count int NOT NULL DEFAULT 0,
  dead_count int NOT NULL DEFAULT 0,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  health_status text NOT NULL DEFAULT 'HEALTHY' CHECK (health_status IN ('HEALTHY','DEGRADED','UNSTABLE','DOWN')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider, window_start)
);
CREATE INDEX IF NOT EXISTS idx_phm_tenant_provider_window
  ON public.provider_health_metrics (tenant_id, provider, window_start DESC);
ALTER TABLE public.provider_health_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS phm_select ON public.provider_health_metrics;
CREATE POLICY phm_select ON public.provider_health_metrics
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS phm_insert ON public.provider_health_metrics;
CREATE POLICY phm_insert ON public.provider_health_metrics
  FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS phm_update ON public.provider_health_metrics;
CREATE POLICY phm_update ON public.provider_health_metrics
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.health_record_sample(
  p_tenant uuid, p_provider text, p_latency_ms int,
  p_outcome text, p_was_retry boolean DEFAULT false
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_window timestamptz := date_trunc('minute', now());
BEGIN
  INSERT INTO public.provider_health_metrics (
    tenant_id, provider, window_start, total_latency_ms, max_latency_ms,
    success_count, failure_count, timeout_count, transport_error_count, retry_count, dead_count,
    last_success_at, last_failure_at
  ) VALUES (
    p_tenant, p_provider, v_window, COALESCE(p_latency_ms,0), COALESCE(p_latency_ms,0),
    CASE WHEN p_outcome='success' THEN 1 ELSE 0 END,
    CASE WHEN p_outcome='failure' THEN 1 ELSE 0 END,
    CASE WHEN p_outcome='timeout' THEN 1 ELSE 0 END,
    CASE WHEN p_outcome='transport' THEN 1 ELSE 0 END,
    CASE WHEN p_was_retry THEN 1 ELSE 0 END,
    CASE WHEN p_outcome='dead' THEN 1 ELSE 0 END,
    CASE WHEN p_outcome='success' THEN now() ELSE NULL END,
    CASE WHEN p_outcome IN ('failure','timeout','transport','dead') THEN now() ELSE NULL END
  )
  ON CONFLICT (tenant_id, provider, window_start) DO UPDATE
    SET total_latency_ms = public.provider_health_metrics.total_latency_ms + COALESCE(p_latency_ms,0),
        max_latency_ms   = GREATEST(public.provider_health_metrics.max_latency_ms, COALESCE(p_latency_ms,0)),
        success_count    = public.provider_health_metrics.success_count + (CASE WHEN p_outcome='success' THEN 1 ELSE 0 END),
        failure_count    = public.provider_health_metrics.failure_count + (CASE WHEN p_outcome='failure' THEN 1 ELSE 0 END),
        timeout_count    = public.provider_health_metrics.timeout_count + (CASE WHEN p_outcome='timeout' THEN 1 ELSE 0 END),
        transport_error_count = public.provider_health_metrics.transport_error_count + (CASE WHEN p_outcome='transport' THEN 1 ELSE 0 END),
        retry_count      = public.provider_health_metrics.retry_count + (CASE WHEN p_was_retry THEN 1 ELSE 0 END),
        dead_count       = public.provider_health_metrics.dead_count + (CASE WHEN p_outcome='dead' THEN 1 ELSE 0 END),
        last_success_at  = CASE WHEN p_outcome='success' THEN now() ELSE public.provider_health_metrics.last_success_at END,
        last_failure_at  = CASE WHEN p_outcome IN ('failure','timeout','transport','dead') THEN now() ELSE public.provider_health_metrics.last_failure_at END,
        updated_at = now();
END;$$;
GRANT EXECUTE ON FUNCTION public.health_record_sample(uuid, text, int, text, boolean) TO authenticated, service_role;

CREATE OR REPLACE VIEW public.provider_health_current AS
SELECT
  tenant_id, provider,
  SUM(success_count) AS success_count,
  SUM(failure_count) AS failure_count,
  SUM(timeout_count) AS timeout_count,
  SUM(transport_error_count) AS transport_error_count,
  SUM(retry_count) AS retry_count,
  SUM(dead_count) AS dead_count,
  CASE WHEN SUM(success_count + failure_count + timeout_count + transport_error_count) > 0
       THEN ROUND(SUM(total_latency_ms)::numeric / NULLIF(SUM(success_count + failure_count + timeout_count + transport_error_count),0), 2)
       ELSE NULL END AS avg_latency_ms,
  MAX(max_latency_ms) AS max_latency_ms,
  MAX(last_success_at) AS last_success_at,
  MAX(last_failure_at) AS last_failure_at,
  MAX(health_status) AS health_status
FROM public.provider_health_metrics
WHERE window_start >= now() - interval '5 minutes'
GROUP BY tenant_id, provider;
