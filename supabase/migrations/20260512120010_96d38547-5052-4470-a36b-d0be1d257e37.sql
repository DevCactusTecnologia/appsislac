
CREATE TABLE public.tenant_lab_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome text NOT NULL DEFAULT '',
  razao_social text NOT NULL DEFAULT '',
  cnpj text NOT NULL DEFAULT '',
  inscricao_municipal text NOT NULL DEFAULT '',
  cnes text NOT NULL DEFAULT '',
  telefone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  estado text NOT NULL DEFAULT '',
  cidade text NOT NULL DEFAULT '',
  endereco text NOT NULL DEFAULT '',
  logo text,
  responsavel_tecnico text NOT NULL DEFAULT '',
  responsavel_tecnico_conselho text NOT NULL DEFAULT '',
  responsavel_tecnico_numero text NOT NULL DEFAULT '',
  responsavel_tecnico_uf text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_lab_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lab_config_select_own_tenant"
  ON public.tenant_lab_config FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "lab_config_insert_own_tenant"
  ON public.tenant_lab_config FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "lab_config_update_own_tenant"
  ON public.tenant_lab_config FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "lab_config_delete_own_tenant"
  ON public.tenant_lab_config FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_tenant_lab_config_updated_at
  BEFORE UPDATE ON public.tenant_lab_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
