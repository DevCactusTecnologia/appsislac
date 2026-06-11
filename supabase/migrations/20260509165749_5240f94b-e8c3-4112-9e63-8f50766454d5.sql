
CREATE OR REPLACE FUNCTION public.purge_integration_logs(p_retention_days integer DEFAULT 90)
RETURNS TABLE(logs_deleted bigint, requests_deleted bigint, responses_deleted bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cutoff timestamptz := now() - make_interval(days => GREATEST(p_retention_days, 1));
  l bigint := 0; q bigint := 0; r bigint := 0;
BEGIN
  WITH d AS (
    DELETE FROM public.integration_responses
     WHERE created_at < cutoff
     RETURNING 1
  ) SELECT count(*) INTO r FROM d;

  WITH d AS (
    DELETE FROM public.integration_requests
     WHERE created_at < cutoff
     RETURNING 1
  ) SELECT count(*) INTO q FROM d;

  WITH d AS (
    DELETE FROM public.integration_logs
     WHERE created_at < cutoff
     RETURNING 1
  ) SELECT count(*) INTO l FROM d;

  RETURN QUERY SELECT l, q, r;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_integration_logs(integer) FROM PUBLIC, anon, authenticated;
