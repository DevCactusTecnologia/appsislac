
-- Fase A: catálogo operacional por provider (não-destrutivo)

CREATE TABLE public.integration_provider_exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  integration_id uuid NULL REFERENCES public.integrations(id) ON DELETE SET NULL,
  provider text NOT NULL,
  provider_exam_code text NOT NULL,
  provider_exam_name text NOT NULL,
  provider_exam_alias text NULL,
  material text NULL,
  metodologia text NULL,
  unidade text NULL,
  recipiente text NULL,
  volume_ml numeric NULL,
  preparo text NULL,
  prazo_dias integer NULL,
  sexo text NULL,
  idade_min_meses integer NULL,
  idade_max_meses integer NULL,
  payload_raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider, provider_exam_code)
);
CREATE INDEX idx_ipe_tenant_provider ON public.integration_provider_exams (tenant_id, provider);
CREATE INDEX idx_ipe_integration ON public.integration_provider_exams (integration_id);
CREATE INDEX idx_ipe_name_trgm ON public.integration_provider_exams USING gin (provider_exam_name gin_trgm_ops);

ALTER TABLE public.integration_provider_exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ipe_select" ON public.integration_provider_exams FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR tenant_id = public.current_tenant_id());
CREATE POLICY "ipe_insert" ON public.integration_provider_exams FOR INSERT TO authenticated
  WITH CHECK ((public.is_super_admin(auth.uid()) OR tenant_id = public.current_tenant_id())
              AND public.has_permission(auth.uid(), 'integracoes.gerenciar'));
CREATE POLICY "ipe_update" ON public.integration_provider_exams FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR tenant_id = public.current_tenant_id())
  WITH CHECK ((public.is_super_admin(auth.uid()) OR tenant_id = public.current_tenant_id())
              AND public.has_permission(auth.uid(), 'integracoes.gerenciar'));
CREATE POLICY "ipe_delete" ON public.integration_provider_exams FOR DELETE TO authenticated
  USING ((public.is_super_admin(auth.uid()) OR tenant_id = public.current_tenant_id())
         AND public.has_permission(auth.uid(), 'integracoes.gerenciar'));

CREATE TRIGGER trg_ipe_updated BEFORE UPDATE ON public.integration_provider_exams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE public.integration_provider_exam_params (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  provider_exam_id uuid NOT NULL REFERENCES public.integration_provider_exams(id) ON DELETE CASCADE,
  sequencia integer NOT NULL DEFAULT 1,
  codigo text NULL,
  nome text NOT NULL,
  unidade text NULL,
  decimais integer NULL,
  tipo text NULL,
  possui_vr boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ipep_provider_exam ON public.integration_provider_exam_params (provider_exam_id);

ALTER TABLE public.integration_provider_exam_params ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ipep_select" ON public.integration_provider_exam_params FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR tenant_id = public.current_tenant_id());
CREATE POLICY "ipep_insert" ON public.integration_provider_exam_params FOR INSERT TO authenticated
  WITH CHECK ((public.is_super_admin(auth.uid()) OR tenant_id = public.current_tenant_id())
              AND public.has_permission(auth.uid(), 'integracoes.gerenciar'));
CREATE POLICY "ipep_update" ON public.integration_provider_exam_params FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR tenant_id = public.current_tenant_id())
  WITH CHECK ((public.is_super_admin(auth.uid()) OR tenant_id = public.current_tenant_id())
              AND public.has_permission(auth.uid(), 'integracoes.gerenciar'));
CREATE POLICY "ipep_delete" ON public.integration_provider_exam_params FOR DELETE TO authenticated
  USING ((public.is_super_admin(auth.uid()) OR tenant_id = public.current_tenant_id())
         AND public.has_permission(auth.uid(), 'integracoes.gerenciar'));

CREATE TRIGGER trg_ipep_updated BEFORE UPDATE ON public.integration_provider_exam_params
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE public.integration_provider_exam_refs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  param_id uuid NOT NULL REFERENCES public.integration_provider_exam_params(id) ON DELETE CASCADE,
  sexo text NULL,
  idade_inferior text NULL,
  idade_superior text NULL,
  valor_referencia text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_iper_param ON public.integration_provider_exam_refs (param_id);

ALTER TABLE public.integration_provider_exam_refs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "iper_select" ON public.integration_provider_exam_refs FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR tenant_id = public.current_tenant_id());
CREATE POLICY "iper_insert" ON public.integration_provider_exam_refs FOR INSERT TO authenticated
  WITH CHECK ((public.is_super_admin(auth.uid()) OR tenant_id = public.current_tenant_id())
              AND public.has_permission(auth.uid(), 'integracoes.gerenciar'));
CREATE POLICY "iper_update" ON public.integration_provider_exam_refs FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR tenant_id = public.current_tenant_id())
  WITH CHECK ((public.is_super_admin(auth.uid()) OR tenant_id = public.current_tenant_id())
              AND public.has_permission(auth.uid(), 'integracoes.gerenciar'));
CREATE POLICY "iper_delete" ON public.integration_provider_exam_refs FOR DELETE TO authenticated
  USING ((public.is_super_admin(auth.uid()) OR tenant_id = public.current_tenant_id())
         AND public.has_permission(auth.uid(), 'integracoes.gerenciar'));

CREATE TRIGGER trg_iper_updated BEFORE UPDATE ON public.integration_provider_exam_refs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- Liga o mapa canônico↔apoio ao item operacional (opcional, retrocompatível)
ALTER TABLE public.integration_exam_map
  ADD COLUMN IF NOT EXISTS provider_exam_id uuid NULL REFERENCES public.integration_provider_exams(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_iem_provider_exam ON public.integration_exam_map(provider_exam_id);
