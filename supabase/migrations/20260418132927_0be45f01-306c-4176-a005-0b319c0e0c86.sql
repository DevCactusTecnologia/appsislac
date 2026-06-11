-- Tabela de setores laboratoriais customizados por tenant
CREATE TABLE public.setores_laboratoriais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT setores_lab_nome_tenant_unique UNIQUE (tenant_id, nome)
);

CREATE INDEX idx_setores_lab_tenant ON public.setores_laboratoriais(tenant_id) WHERE ativo = true;

ALTER TABLE public.setores_laboratoriais ENABLE ROW LEVEL SECURITY;

-- Policies (4) seguindo o padrão multi-tenant do projeto
CREATE POLICY "setlab_select" ON public.setores_laboratoriais
  FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR (tenant_id = current_tenant_id()));

CREATE POLICY "setlab_insert" ON public.setores_laboratoriais
  FOR INSERT TO authenticated
  WITH CHECK ((tenant_id = current_tenant_id()) AND (has_permission(auth.uid(), 'gestao_exames') OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "setlab_update" ON public.setores_laboratoriais
  FOR UPDATE TO authenticated
  USING ((tenant_id = current_tenant_id()) AND (has_permission(auth.uid(), 'gestao_exames') OR has_role(auth.uid(), 'admin'::app_role)))
  WITH CHECK ((tenant_id = current_tenant_id()) AND (has_permission(auth.uid(), 'gestao_exames') OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "setlab_delete" ON public.setores_laboratoriais
  FOR DELETE TO authenticated
  USING ((tenant_id = current_tenant_id()) AND has_role(auth.uid(), 'admin'::app_role));

-- Trigger updated_at
CREATE TRIGGER touch_setores_lab_updated_at
  BEFORE UPDATE ON public.setores_laboratoriais
  FOR EACH ROW EXECUTE FUNCTION public.touch_app_settings_updated_at();