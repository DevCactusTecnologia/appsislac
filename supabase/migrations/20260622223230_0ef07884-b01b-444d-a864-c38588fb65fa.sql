
-- 1) Catálogo canônico de materiais
CREATE TABLE public.materiais_amostra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome text NOT NULL,
  sigla text NOT NULL DEFAULT '',
  dias_retencao integer NOT NULL DEFAULT 0,
  horas_validade integer NOT NULL DEFAULT 0,
  temperatura_recomendada text NOT NULL DEFAULT '',
  reutilizavel boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uniq_materiais_amostra_tenant_nome
  ON public.materiais_amostra (tenant_id, lower(nome));
CREATE INDEX idx_materiais_amostra_tenant_ativo
  ON public.materiais_amostra (tenant_id, ativo);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.materiais_amostra TO authenticated;
GRANT ALL ON public.materiais_amostra TO service_role;

ALTER TABLE public.materiais_amostra ENABLE ROW LEVEL SECURITY;

CREATE POLICY "materiais_amostra_select" ON public.materiais_amostra
  FOR SELECT TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR (tenant_id = current_tenant_id() AND (
      has_permission(auth.uid(), 'visualizar_atendimentos')
      OR has_permission(auth.uid(), 'registrar_coleta')
      OR has_permission(auth.uid(), 'analisar_amostra')
      OR has_permission(auth.uid(), 'editar_atendimento')
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    ))
  );

CREATE POLICY "materiais_amostra_insert" ON public.materiais_amostra
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = current_tenant_id() AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    )
  );

CREATE POLICY "materiais_amostra_update" ON public.materiais_amostra
  FOR UPDATE TO authenticated
  USING (
    tenant_id = current_tenant_id() AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    )
  )
  WITH CHECK (
    tenant_id = current_tenant_id() AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    )
  );

CREATE POLICY "materiais_amostra_delete" ON public.materiais_amostra
  FOR DELETE TO authenticated
  USING (
    tenant_id = current_tenant_id() AND has_role(auth.uid(), 'admin'::app_role)
  );

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_materiais_amostra_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER materiais_amostra_updated_at
  BEFORE UPDATE ON public.materiais_amostra
  FOR EACH ROW EXECUTE FUNCTION public.tg_materiais_amostra_updated_at();

CREATE TRIGGER audit_materiais_amostra
  AFTER INSERT OR UPDATE OR DELETE ON public.materiais_amostra
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- 2) Coluna material_id em amostras (legado mantido)
ALTER TABLE public.amostras
  ADD COLUMN material_id uuid NULL REFERENCES public.materiais_amostra(id) ON DELETE SET NULL;

CREATE INDEX idx_amostras_material_id ON public.amostras (material_id);

-- 3) Trigger de sincronização: material_id -> tipo_material
CREATE OR REPLACE FUNCTION public.sync_amostra_tipo_material()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_nome text;
BEGIN
  IF NEW.material_id IS NOT NULL THEN
    SELECT nome INTO v_nome FROM public.materiais_amostra WHERE id = NEW.material_id;
    IF v_nome IS NOT NULL AND v_nome <> '' THEN
      NEW.tipo_material := upper(v_nome);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.sync_amostra_tipo_material() FROM PUBLIC;

CREATE TRIGGER sync_amostra_tipo_material_biu
  BEFORE INSERT OR UPDATE OF material_id ON public.amostras
  FOR EACH ROW EXECUTE FUNCTION public.sync_amostra_tipo_material();

-- 4) Seed por tenant
INSERT INTO public.materiais_amostra (tenant_id, nome, sigla, dias_retencao, horas_validade, temperatura_recomendada, reutilizavel)
SELECT t.id, m.nome, m.sigla, m.dias_retencao, m.horas_validade, m.temperatura, false
FROM public.tenants t
CROSS JOIN (VALUES
  ('Soro',          'SOR', 30, 72,  '2-8°C'),
  ('Plasma',        'PLA', 30, 72,  '2-8°C'),
  ('Sangue Total',  'ST',   2, 24,  '2-8°C'),
  ('Urina',         'URI',  7, 24,  '2-8°C'),
  ('Fezes',         'FEZ',  3, 24,  '2-8°C'),
  ('Swab',          'SWB',  7, 48,  '2-8°C'),
  ('Líquor',        'LCR', 30, 48,  '2-8°C'),
  ('Secreção',      'SEC',  7, 48,  '2-8°C')
) AS m(nome, sigla, dias_retencao, horas_validade, temperatura)
ON CONFLICT DO NOTHING;
