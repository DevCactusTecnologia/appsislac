-- ============================================================================
-- FASE 1 — FUNDAÇÃO: Módulo de Integrações Laboratoriais (multi-provider)
-- ============================================================================

-- Função utilitária (idempotente)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ENUMs
DO $$ BEGIN
  CREATE TYPE public.integration_provider AS ENUM (
    'HERMES_PARDINI','DB_DIAGNOSTICOS','ALVARO','SABIN','DASA','FLEURY','PIXEON','HL7','FHIR','CUSTOM'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.integration_job_status AS ENUM ('PENDING','PROCESSING','COMPLETED','FAILED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.integration_job_kind AS ENUM (
    'SEND_ORDER','POLL_RESULT','FETCH_PDF','CANCEL_EXAM','CANCEL_SAMPLE','FETCH_PENDING','FETCH_TRACE','SYNC_EXAM_MAP'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.integration_log_level AS ENUM ('DEBUG','INFO','WARN','ERROR','CRITICAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1) integrations
CREATE TABLE public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  provider public.integration_provider NOT NULL,
  ativo boolean NOT NULL DEFAULT false,
  endpoint_url text,
  client_code text,
  polling_interval_seconds integer NOT NULL DEFAULT 300,
  timeout_seconds integer NOT NULL DEFAULT 60,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider)
);
CREATE INDEX idx_integrations_tenant ON public.integrations(tenant_id);

-- 2) integration_credentials
CREATE TABLE public.integration_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  integration_id uuid NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  username text,
  secret_encrypted text,
  extra_encrypted jsonb,
  rotated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_int_creds_tenant ON public.integration_credentials(tenant_id);
CREATE INDEX idx_int_creds_integration ON public.integration_credentials(integration_id);

-- 3) integration_exam_map
CREATE TABLE public.integration_exam_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  integration_id uuid NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  exame_sislac_id text NOT NULL,
  exame_apoio_codigo text NOT NULL,
  exame_apoio_nome text,
  material text,
  ativo boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (integration_id, exame_sislac_id)
);
CREATE INDEX idx_int_exam_map_tenant ON public.integration_exam_map(tenant_id);
CREATE INDEX idx_int_exam_map_codigo ON public.integration_exam_map(integration_id, exame_apoio_codigo);

-- 4) integration_requests
CREATE TABLE public.integration_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  integration_id uuid NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  job_id uuid,
  method text NOT NULL,
  endpoint text,
  envelope text,
  headers jsonb,
  status_code integer,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_int_req_tenant ON public.integration_requests(tenant_id);
CREATE INDEX idx_int_req_job ON public.integration_requests(job_id);
CREATE INDEX idx_int_req_created ON public.integration_requests(created_at DESC);

-- 5) integration_responses
CREATE TABLE public.integration_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  integration_id uuid NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  request_id uuid REFERENCES public.integration_requests(id) ON DELETE SET NULL,
  raw_payload text,
  parsed_payload jsonb,
  status_code integer,
  parse_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_int_resp_tenant ON public.integration_responses(tenant_id);
CREATE INDEX idx_int_resp_request ON public.integration_responses(request_id);

-- 6) integration_results
CREATE TABLE public.integration_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  integration_id uuid NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  atendimento_exame_id bigint,
  external_protocol text,
  exame_apoio_codigo text,
  status text,
  resultado jsonb NOT NULL DEFAULT '{}'::jsonb,
  liberado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_int_results_tenant ON public.integration_results(tenant_id);
CREATE INDEX idx_int_results_protocol ON public.integration_results(integration_id, external_protocol);
CREATE INDEX idx_int_results_atend ON public.integration_results(atendimento_exame_id);

-- 7) integration_pdfs
CREATE TABLE public.integration_pdfs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  integration_id uuid NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  result_id uuid REFERENCES public.integration_results(id) ON DELETE SET NULL,
  external_protocol text,
  kind text NOT NULL DEFAULT 'LAUDO',
  storage_path text NOT NULL,
  size_bytes integer,
  checksum text,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_int_pdfs_tenant ON public.integration_pdfs(tenant_id);
CREATE INDEX idx_int_pdfs_result ON public.integration_pdfs(result_id);

-- 8) integration_logs
CREATE TABLE public.integration_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  integration_id uuid REFERENCES public.integrations(id) ON DELETE CASCADE,
  job_id uuid,
  level public.integration_log_level NOT NULL DEFAULT 'INFO',
  message text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_int_logs_tenant ON public.integration_logs(tenant_id);
CREATE INDEX idx_int_logs_created ON public.integration_logs(created_at DESC);
CREATE INDEX idx_int_logs_level ON public.integration_logs(level);

-- 9) integration_sync_state
CREATE TABLE public.integration_sync_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  integration_id uuid NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'RESULTS',
  last_sync_at timestamptz,
  last_result_date timestamptz,
  status text NOT NULL DEFAULT 'IDLE',
  retries integer NOT NULL DEFAULT 0,
  last_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (integration_id, scope)
);
CREATE INDEX idx_int_sync_tenant ON public.integration_sync_state(tenant_id);

-- 10) integration_jobs
CREATE TABLE public.integration_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  integration_id uuid NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  kind public.integration_job_kind NOT NULL,
  status public.integration_job_status NOT NULL DEFAULT 'PENDING',
  priority integer NOT NULL DEFAULT 5,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  retry_count integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 5,
  next_retry_at timestamptz,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_int_jobs_tenant ON public.integration_jobs(tenant_id);
CREATE INDEX idx_int_jobs_status_sched ON public.integration_jobs(status, scheduled_at);
CREATE INDEX idx_int_jobs_kind ON public.integration_jobs(kind);

-- triggers updated_at
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'integrations','integration_credentials','integration_exam_map',
    'integration_results','integration_sync_state','integration_jobs'
  ])
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%1$I_updated_at BEFORE UPDATE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()',
      t
    );
  END LOOP;
END $$;

-- RLS
ALTER TABLE public.integrations              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_credentials   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_exam_map      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_requests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_responses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_results       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_pdfs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_sync_state    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_jobs          ENABLE ROW LEVEL SECURITY;

-- integrations
CREATE POLICY int_sel ON public.integrations FOR SELECT
  USING (public.is_super_admin(auth.uid()) OR tenant_id = public.current_tenant_id());
CREATE POLICY int_ins ON public.integrations FOR INSERT
  WITH CHECK (tenant_id = public.current_tenant_id() AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_permission(auth.uid(),'configuracoes')));
CREATE POLICY int_upd ON public.integrations FOR UPDATE
  USING (tenant_id = public.current_tenant_id() AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_permission(auth.uid(),'configuracoes')))
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY int_del ON public.integrations FOR DELETE
  USING (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin'::app_role));

-- credentials (segredo)
CREATE POLICY intc_sel ON public.integration_credentials FOR SELECT
  USING (public.is_super_admin(auth.uid()) OR (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin'::app_role)));
CREATE POLICY intc_ins ON public.integration_credentials FOR INSERT
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY intc_upd ON public.integration_credentials FOR UPDATE
  USING (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY intc_del ON public.integration_credentials FOR DELETE
  USING (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin'::app_role));

-- exam_map
CREATE POLICY intem_sel ON public.integration_exam_map FOR SELECT
  USING (public.is_super_admin(auth.uid()) OR tenant_id = public.current_tenant_id());
CREATE POLICY intem_ins ON public.integration_exam_map FOR INSERT
  WITH CHECK (tenant_id = public.current_tenant_id() AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_permission(auth.uid(),'configuracoes')));
CREATE POLICY intem_upd ON public.integration_exam_map FOR UPDATE
  USING (tenant_id = public.current_tenant_id() AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_permission(auth.uid(),'configuracoes')))
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY intem_del ON public.integration_exam_map FOR DELETE
  USING (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(),'admin'::app_role));

-- requests/responses/logs (somente leitura por usuário; escrita só service-role)
CREATE POLICY intr_sel ON public.integration_requests FOR SELECT
  USING (public.is_super_admin(auth.uid()) OR tenant_id = public.current_tenant_id());
CREATE POLICY intresp_sel ON public.integration_responses FOR SELECT
  USING (public.is_super_admin(auth.uid()) OR tenant_id = public.current_tenant_id());
CREATE POLICY intlog_sel ON public.integration_logs FOR SELECT
  USING (public.is_super_admin(auth.uid()) OR tenant_id = public.current_tenant_id());

-- results
CREATE POLICY intres_sel ON public.integration_results FOR SELECT
  USING (public.is_super_admin(auth.uid()) OR tenant_id = public.current_tenant_id());

-- pdfs
CREATE POLICY intpdf_sel ON public.integration_pdfs FOR SELECT
  USING (public.is_super_admin(auth.uid()) OR tenant_id = public.current_tenant_id());

-- sync_state
CREATE POLICY intss_sel ON public.integration_sync_state FOR SELECT
  USING (public.is_super_admin(auth.uid()) OR tenant_id = public.current_tenant_id());
CREATE POLICY intss_upd ON public.integration_sync_state FOR UPDATE
  USING (tenant_id = public.current_tenant_id() AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_permission(auth.uid(),'configuracoes')))
  WITH CHECK (tenant_id = public.current_tenant_id());

-- jobs
CREATE POLICY intjob_sel ON public.integration_jobs FOR SELECT
  USING (public.is_super_admin(auth.uid()) OR tenant_id = public.current_tenant_id());
CREATE POLICY intjob_upd ON public.integration_jobs FOR UPDATE
  USING (tenant_id = public.current_tenant_id() AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_permission(auth.uid(),'configuracoes')))
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY intjob_ins ON public.integration_jobs FOR INSERT
  WITH CHECK (tenant_id = public.current_tenant_id() AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_permission(auth.uid(),'configuracoes')));

-- Storage bucket privado
INSERT INTO storage.buckets (id, name, public)
VALUES ('integration-assets', 'integration-assets', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "integration assets: tenant read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'integration-assets'
    AND (
      public.is_super_admin(auth.uid())
      OR (storage.foldername(name))[1]::uuid = public.current_tenant_id()
    )
  );

CREATE POLICY "integration assets: admin write"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'integration-assets'
    AND (storage.foldername(name))[1]::uuid = public.current_tenant_id()
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "integration assets: admin update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'integration-assets'
    AND (storage.foldername(name))[1]::uuid = public.current_tenant_id()
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "integration assets: admin delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'integration-assets'
    AND (storage.foldername(name))[1]::uuid = public.current_tenant_id()
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );
