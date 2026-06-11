-- Grant cron usage so we can schedule jobs
GRANT USAGE ON SCHEMA cron TO postgres;

-- Remove any existing job with the same name (idempotent re-run)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-pdfs-daily') THEN
    PERFORM cron.unschedule('cleanup-pdfs-daily');
  END IF;
END $$;

-- Schedule daily at 03:00 UTC
SELECT cron.schedule(
  'cleanup-pdfs-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url:='https://gocmtvwvanpdgxhjkfgt.supabase.co/functions/v1/cleanup-pdfs',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdvY210dnd2YW5wZGd4aGprZmd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNzQ0MjYsImV4cCI6MjA5MTk1MDQyNn0.RefvlNjgkutvcDh8GdATsd9AeCpAC4M0LS4HrVUlSRI"}'::jsonb,
    body:=concat('{"triggered_at": "', now(), '"}')::jsonb
  ) AS request_id;
  $$
);