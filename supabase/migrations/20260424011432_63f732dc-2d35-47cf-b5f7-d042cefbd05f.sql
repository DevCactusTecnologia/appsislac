-- ==========================================
-- Tabela: recoletas_motivos
-- ==========================================
CREATE TABLE IF NOT EXISTS public.recoletas_motivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  sistema boolean NOT NULL DEFAULT false,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recoletas_motivos_tenant ON public.recoletas_motivos(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_recoletas_motivos_nome_tenant ON public.recoletas_motivos(tenant_id, lower(nome));

ALTER TABLE public.recoletas_motivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rcm_select" ON public.recoletas_motivos
  FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR tenant_id = current_tenant_id());

CREATE POLICY "rcm_insert" ON public.recoletas_motivos
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_tenant_id() AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "rcm_update" ON public.recoletas_motivos
  FOR UPDATE TO authenticated
  USING (tenant_id = current_tenant_id() AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (tenant_id = current_tenant_id() AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "rcm_delete" ON public.recoletas_motivos
  FOR DELETE TO authenticated
  USING (tenant_id = current_tenant_id() AND has_role(auth.uid(), 'admin'::app_role) AND sistema = false);

-- Trigger: protege motivos do sistema
CREATE OR REPLACE FUNCTION public.protect_recoletas_motivos_sistema()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.sistema = true THEN
    RAISE EXCEPTION 'Motivos de recoleta do sistema não podem ser excluídos';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.sistema = true AND NEW.nome <> OLD.nome THEN
    RAISE EXCEPTION 'Motivos de recoleta do sistema não podem ser renomeados';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_recoletas_motivos_sistema
BEFORE UPDATE OR DELETE ON public.recoletas_motivos
FOR EACH ROW EXECUTE FUNCTION public.protect_recoletas_motivos_sistema();

CREATE OR REPLACE FUNCTION public.touch_recoletas_motivos_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_touch_recoletas_motivos_updated_at
BEFORE UPDATE ON public.recoletas_motivos
FOR EACH ROW EXECUTE FUNCTION public.touch_recoletas_motivos_updated_at();

-- ==========================================
-- Tabela: recoletas
-- ==========================================
CREATE TABLE IF NOT EXISTS public.recoletas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  atendimento_id bigint NOT NULL,
  atendimento_exame_id bigint NOT NULL,
  exame_nome text NOT NULL DEFAULT '',
  paciente_nome text NOT NULL DEFAULT '',
  protocolo text NOT NULL DEFAULT '',
  motivo_id uuid REFERENCES public.recoletas_motivos(id) ON DELETE SET NULL,
  motivo_nome text NOT NULL,
  etapa text NOT NULL CHECK (etapa IN ('coleta','triagem','analise','liberacao')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','realizada','cancelada')),
  observacao text NOT NULL DEFAULT '',
  solicitante_email text NOT NULL DEFAULT '',
  solicitante_id uuid,
  data_solicitacao timestamptz NOT NULL DEFAULT now(),
  data_nova_coleta timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recoletas_tenant ON public.recoletas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_recoletas_atendimento ON public.recoletas(atendimento_id);
CREATE INDEX IF NOT EXISTS idx_recoletas_data ON public.recoletas(data_solicitacao DESC);
CREATE INDEX IF NOT EXISTS idx_recoletas_etapa ON public.recoletas(etapa);

ALTER TABLE public.recoletas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rec_select" ON public.recoletas
  FOR SELECT TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR (tenant_id = current_tenant_id()
        AND has_permission(auth.uid(), 'visualizar_atendimentos'))
  );

CREATE POLICY "rec_insert" ON public.recoletas
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND (
      has_permission(auth.uid(), 'registrar_coleta')
      OR has_permission(auth.uid(), 'analisar_amostra')
      OR has_permission(auth.uid(), 'liberar_resultado')
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  );

CREATE POLICY "rec_update" ON public.recoletas
  FOR UPDATE TO authenticated
  USING (
    tenant_id = current_tenant_id()
    AND (
      has_permission(auth.uid(), 'registrar_coleta')
      OR has_permission(auth.uid(), 'analisar_amostra')
      OR has_permission(auth.uid(), 'liberar_resultado')
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  )
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "rec_delete" ON public.recoletas
  FOR DELETE TO authenticated
  USING (tenant_id = current_tenant_id() AND has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.touch_recoletas_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_touch_recoletas_updated_at
BEFORE UPDATE ON public.recoletas
FOR EACH ROW EXECUTE FUNCTION public.touch_recoletas_updated_at();

-- ==========================================
-- Seed: motivos do sistema para todos os tenants existentes
-- ==========================================
INSERT INTO public.recoletas_motivos (tenant_id, nome, sistema, ordem)
SELECT t.id, m.nome, true, m.ordem
FROM public.tenants t
CROSS JOIN (VALUES
  ('Hemólise', 1),
  ('Lipemia', 2),
  ('Volume insuficiente', 3),
  ('Coagulação inadequada', 4),
  ('Identificação incorreta', 5),
  ('Quebra de tubo', 6),
  ('Resultado discrepante', 7)
) AS m(nome, ordem)
ON CONFLICT (tenant_id, lower(nome)) DO NOTHING;

-- ==========================================
-- Seed automático para novos tenants via função reutilizável
-- ==========================================
CREATE OR REPLACE FUNCTION public.seed_default_recoletas_motivos_for_tenant(_tenant_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _count integer;
BEGIN
  INSERT INTO public.recoletas_motivos (tenant_id, nome, sistema, ordem)
  VALUES
    (_tenant_id, 'Hemólise', true, 1),
    (_tenant_id, 'Lipemia', true, 2),
    (_tenant_id, 'Volume insuficiente', true, 3),
    (_tenant_id, 'Coagulação inadequada', true, 4),
    (_tenant_id, 'Identificação incorreta', true, 5),
    (_tenant_id, 'Quebra de tubo', true, 6),
    (_tenant_id, 'Resultado discrepante', true, 7)
  ON CONFLICT (tenant_id, lower(nome)) DO NOTHING;
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;