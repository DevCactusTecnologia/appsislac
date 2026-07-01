
-- Fase 3: Migração Shared → Dedicated (control plane)

-- 1) Tabela de execuções de migração
CREATE TABLE IF NOT EXISTS public.tenant_migration_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  phase TEXT NOT NULL CHECK (phase IN ('schema','dryrun','auth','data','storage','smoke','flip','rollback','purge')),
  status TEXT NOT NULL CHECK (status IN ('running','ok','failed','aborted')),
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT,
  initiated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.tenant_migration_runs TO authenticated;
GRANT ALL ON public.tenant_migration_runs TO service_role;

ALTER TABLE public.tenant_migration_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_all_migration_runs"
  ON public.tenant_migration_runs
  FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_tenant_migration_runs_tenant ON public.tenant_migration_runs(tenant_id, started_at DESC);

-- 2) Colunas de estado em tenant_registry
ALTER TABLE public.tenant_registry
  ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS migration_state TEXT NOT NULL DEFAULT 'idle'
    CHECK (migration_state IN ('idle','provisioning','migrating','dedicated','frozen_shared','rolled_back'));

COMMENT ON COLUMN public.tenant_registry.frozen_at IS 'Timestamp em que o shared foi congelado (read-only) após cutover para dedicado.';
COMMENT ON COLUMN public.tenant_registry.migration_state IS 'Estado da migração shared→dedicated para este tenant.';
