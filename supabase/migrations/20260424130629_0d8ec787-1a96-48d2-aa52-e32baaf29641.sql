
-- Reduce lab-apoio-cron-fetch frequency from every 5 minutes to once a day (03:00 UTC).
-- Safe re-schedule: works whether the job currently exists or not.
DO $$
DECLARE
  v_jobid bigint;
  v_jobname text;
BEGIN
  -- Look up by command pattern (job name varied across migrations).
  SELECT jobid, jobname INTO v_jobid, v_jobname
  FROM cron.job
  WHERE command ILIKE '%lab-apoio-cron-fetch%'
  ORDER BY jobid
  LIMIT 1;

  IF v_jobid IS NOT NULL THEN
    PERFORM cron.alter_job(job_id := v_jobid, schedule := '0 3 * * *');
    RAISE NOTICE 'Rescheduled cron job % (% ) to daily 03:00 UTC', v_jobid, v_jobname;
  ELSE
    RAISE NOTICE 'No lab-apoio-cron-fetch job found — nothing to reschedule.';
  END IF;
END;
$$;
