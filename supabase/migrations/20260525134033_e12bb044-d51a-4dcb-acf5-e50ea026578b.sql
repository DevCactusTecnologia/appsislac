
-- ════════════════════════════════════════════════════════════════════
-- ONDA 2 — Database Registry + Provision Engine (Neon, dry-run)
-- ════════════════════════════════════════════════════════════════════

-- ── FASE 1: Evoluir tenant_registry ────────────────────────────────
ALTER TABLE public.tenant_registry
  ADD COLUMN IF NOT EXISTS db_provider           text,
  ADD COLUMN IF NOT EXISTS db_port               integer,
  ADD COLUMN IF NOT EXISTS db_region             text,
  ADD COLUMN IF NOT EXISTS onboarding_version    text NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS backup_status         text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS runtime_mode          text NOT NULL DEFAULT 'shared_db',
  ADD COLUMN IF NOT EXISTS last_health_check     timestamptz,
  ADD COLUMN IF NOT EXISTS last_health_duration_ms integer,
  ADD COLUMN IF NOT EXISTS last_health_result    text,
  ADD COLUMN IF NOT EXISTS last_health_failure   text;

-- Constraints (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_registry_runtime_mode_check') THEN
    ALTER TABLE public.tenant_registry
      ADD CONSTRAINT tenant_registry_runtime_mode_check
      CHECK (runtime_mode IN ('shared_db','isolated_db'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_registry_backup_status_check') THEN
    ALTER TABLE public.tenant_registry
      ADD CONSTRAINT tenant_registry_backup_status_check
      CHECK (backup_status IN ('unknown','ok','degraded','failed','disabled'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_registry_db_provider_check') THEN
    ALTER TABLE public.tenant_registry
      ADD CONSTRAINT tenant_registry_db_provider_check
      CHECK (db_provider IS NULL OR db_provider IN ('shared_supabase','neon','supabase_project','external_postgres'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_registry_last_health_result_check') THEN
    ALTER TABLE public.tenant_registry
      ADD CONSTRAINT tenant_registry_last_health_result_check
      CHECK (last_health_result IS NULL OR last_health_result IN ('ok','degraded','failed'));
  END IF;
END $$;

-- Backfill: tudo que é 'shared' = shared_db / provider = shared_supabase
UPDATE public.tenant_registry
   SET runtime_mode = CASE WHEN database_strategy = 'dedicated' THEN 'isolated_db' ELSE 'shared_db' END,
       db_provider  = COALESCE(db_provider, CASE WHEN database_strategy = 'dedicated' THEN 'neon' ELSE 'shared_supabase' END)
 WHERE runtime_mode IS NULL OR db_provider IS NULL;

CREATE INDEX IF NOT EXISTS tenant_registry_runtime_mode_idx ON public.tenant_registry(runtime_mode);
CREATE INDEX IF NOT EXISTS tenant_registry_provisioning_status_idx ON public.tenant_registry(provisioning_status);

-- ── FASE 8: tenant_migration_log ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tenant_migration_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  from_version    text,
  to_version      text NOT NULL,
  status          text NOT NULL CHECK (status IN ('pending','running','success','failed','rolled_back')),
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  duration_ms     integer,
  error_message   text,
  applied_by      uuid,
  notes           jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS tenant_migration_log_tenant_idx ON public.tenant_migration_log(tenant_id, started_at DESC);
CREATE INDEX IF NOT EXISTS tenant_migration_log_status_idx ON public.tenant_migration_log(status);

ALTER TABLE public.tenant_migration_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_migration_log super_admin all" ON public.tenant_migration_log;
CREATE POLICY "tenant_migration_log super_admin all"
  ON public.tenant_migration_log FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- ── FASE 9: tenant_provision_audit (transições de onboarding) ──────
CREATE TABLE IF NOT EXISTS public.tenant_provision_audit (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  from_state    text,
  to_state      text NOT NULL,
  actor_id      uuid,
  reason        text,
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tenant_provision_audit_tenant_idx ON public.tenant_provision_audit(tenant_id, created_at DESC);

ALTER TABLE public.tenant_provision_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_provision_audit super_admin all" ON public.tenant_provision_audit;
CREATE POLICY "tenant_provision_audit super_admin all"
  ON public.tenant_provision_audit FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Trigger: registra automaticamente toda transição de provisioning_status
CREATE OR REPLACE FUNCTION public.log_tenant_provisioning_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.provisioning_status IS DISTINCT FROM OLD.provisioning_status THEN
    INSERT INTO public.tenant_provision_audit (tenant_id, from_state, to_state, payload)
    VALUES (NEW.tenant_id, OLD.provisioning_status, NEW.provisioning_status,
            jsonb_build_object('runtime_mode', NEW.runtime_mode, 'db_provider', NEW.db_provider));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_tenant_registry_log_transition ON public.tenant_registry;
CREATE TRIGGER trg_tenant_registry_log_transition
  AFTER UPDATE ON public.tenant_registry
  FOR EACH ROW EXECUTE FUNCTION public.log_tenant_provisioning_transition();

-- ── FASE 7: View agregada de saúde da plataforma ───────────────────
CREATE OR REPLACE VIEW public.platform_health_aggregate AS
SELECT
  tr.tenant_id,
  tr.slug,
  tr.laboratorio,
  tr.runtime_mode,
  tr.db_provider,
  tr.provisioning_status,
  tr.runtime_status,
  tr.backup_status,
  tr.schema_version,
  tr.onboarding_version,
  tr.last_health_check,
  tr.last_health_result,
  tr.last_health_duration_ms,
  tr.last_health_failure,
  (SELECT count(*) FROM public.tenant_migration_log m
     WHERE m.tenant_id = tr.tenant_id AND m.status = 'failed') AS failed_migrations,
  (SELECT max(started_at) FROM public.tenant_migration_log m
     WHERE m.tenant_id = tr.tenant_id) AS last_migration_at
FROM public.tenant_registry tr;

-- View herda RLS da tenant_registry; restringimos a super_admin explicitamente:
REVOKE ALL ON public.platform_health_aggregate FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.platform_health_aggregate TO authenticated;

COMMENT ON TABLE public.tenant_registry IS
  'Onda 2: fonte única de verdade do control-plane. Conexão, provisioning, migrations, observabilidade e backups por tenant. db_provider=neon para isolated_db; shared_supabase para shared_db.';
COMMENT ON TABLE public.tenant_migration_log IS
  'Onda 2/Fase 8: histórico de aplicações de schema migration por tenant.';
COMMENT ON TABLE public.tenant_provision_audit IS
  'Onda 2/Fase 9: audit log de transições do ciclo de vida (pending→provisioning→…→active).';
