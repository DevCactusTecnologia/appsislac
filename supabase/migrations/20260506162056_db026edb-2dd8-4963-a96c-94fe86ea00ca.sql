
-- Garante upsert idempotente em integration_results / integration_sync_state
CREATE UNIQUE INDEX IF NOT EXISTS uq_int_results_protocol
  ON public.integration_results (integration_id, external_protocol);

-- (sync_state já tem UNIQUE(integration_id, scope) na criação, mas garantimos)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public'
      AND indexname='uq_int_sync_state_scope'
  ) THEN
    BEGIN
      CREATE UNIQUE INDEX uq_int_sync_state_scope
        ON public.integration_sync_state (integration_id, scope);
    EXCEPTION WHEN duplicate_table THEN NULL;
    END;
  END IF;
END $$;
