CREATE TABLE IF NOT EXISTS public.provider_catalog_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  integration_id uuid,
  provider text NOT NULL,
  storage_path text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  progress integer NOT NULL DEFAULT 0,
  total_rows integer,
  total_exams integer,
  processed integer NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  message text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_pcij_tenant ON public.provider_catalog_import_jobs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pcij_integration ON public.provider_catalog_import_jobs(integration_id);

ALTER TABLE public.provider_catalog_import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pcij_select_tenant"
  ON public.provider_catalog_import_jobs FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'integracoes.gerenciar'))
  );

CREATE POLICY "pcij_insert_tenant"
  ON public.provider_catalog_import_jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'integracoes.gerenciar'))
  );

CREATE POLICY "pcij_update_tenant"
  ON public.provider_catalog_import_jobs FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'integracoes.gerenciar'))
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'integracoes.gerenciar'))
  );

CREATE POLICY "pcij_delete_tenant"
  ON public.provider_catalog_import_jobs FOR DELETE
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (tenant_id = public.current_tenant_id() AND public.has_permission(auth.uid(), 'integracoes.gerenciar'))
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.provider_catalog_import_jobs;