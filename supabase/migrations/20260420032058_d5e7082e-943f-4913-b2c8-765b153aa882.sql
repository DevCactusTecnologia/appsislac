-- ============================================================
-- MAPAS DE TRABALHO LABORATORIAIS
-- ============================================================

-- Tabela: mapas_trabalho
CREATE TABLE public.mapas_trabalho (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  tipo text NOT NULL DEFAULT 'INDIVIDUAL'
    CHECK (tipo IN ('INDIVIDUAL', 'LOTE', 'DINAMICO')),
  conteudo text NOT NULL DEFAULT '',
  placeholders_usados jsonb NOT NULL DEFAULT '[]'::jsonb,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  criado_por text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mapas_trabalho_tenant ON public.mapas_trabalho(tenant_id);
CREATE INDEX idx_mapas_trabalho_ativo ON public.mapas_trabalho(tenant_id, ativo);

ALTER TABLE public.mapas_trabalho ENABLE ROW LEVEL SECURITY;

CREATE POLICY mapas_trabalho_select ON public.mapas_trabalho
  FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR tenant_id = current_tenant_id());

CREATE POLICY mapas_trabalho_insert ON public.mapas_trabalho
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND (has_permission(auth.uid(), 'gestao_exames') OR has_role(auth.uid(), 'admin'))
  );

CREATE POLICY mapas_trabalho_update ON public.mapas_trabalho
  FOR UPDATE TO authenticated
  USING (
    tenant_id = current_tenant_id()
    AND (has_permission(auth.uid(), 'gestao_exames') OR has_role(auth.uid(), 'admin'))
  )
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND (has_permission(auth.uid(), 'gestao_exames') OR has_role(auth.uid(), 'admin'))
  );

CREATE POLICY mapas_trabalho_delete ON public.mapas_trabalho
  FOR DELETE TO authenticated
  USING (
    tenant_id = current_tenant_id()
    AND (has_permission(auth.uid(), 'gestao_exames') OR has_role(auth.uid(), 'admin'))
  );

CREATE TRIGGER trg_mapas_trabalho_updated_at
  BEFORE UPDATE ON public.mapas_trabalho
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_app_settings_updated_at();

-- ============================================================
-- Tabela: mapa_exames (junção N:N)
-- ============================================================
CREATE TABLE public.mapa_exames (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  mapa_id uuid NOT NULL REFERENCES public.mapas_trabalho(id) ON DELETE CASCADE,
  exame_id uuid NOT NULL REFERENCES public.exames_catalogo(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mapa_id, exame_id)
);

CREATE INDEX idx_mapa_exames_tenant ON public.mapa_exames(tenant_id);
CREATE INDEX idx_mapa_exames_exame ON public.mapa_exames(exame_id);
CREATE INDEX idx_mapa_exames_mapa ON public.mapa_exames(mapa_id);

ALTER TABLE public.mapa_exames ENABLE ROW LEVEL SECURITY;

CREATE POLICY mapa_exames_select ON public.mapa_exames
  FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR tenant_id = current_tenant_id());

CREATE POLICY mapa_exames_insert ON public.mapa_exames
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND (has_permission(auth.uid(), 'gestao_exames') OR has_role(auth.uid(), 'admin'))
  );

CREATE POLICY mapa_exames_update ON public.mapa_exames
  FOR UPDATE TO authenticated
  USING (
    tenant_id = current_tenant_id()
    AND (has_permission(auth.uid(), 'gestao_exames') OR has_role(auth.uid(), 'admin'))
  )
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND (has_permission(auth.uid(), 'gestao_exames') OR has_role(auth.uid(), 'admin'))
  );

CREATE POLICY mapa_exames_delete ON public.mapa_exames
  FOR DELETE TO authenticated
  USING (
    tenant_id = current_tenant_id()
    AND (has_permission(auth.uid(), 'gestao_exames') OR has_role(auth.uid(), 'admin'))
  );