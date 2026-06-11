-- =====================================================
-- SISTEMA DE SOROTECA (ADITIVO - SEM QUEBRAR NADA)
-- =====================================================

-- 1) Tabela de amostras
CREATE TABLE IF NOT EXISTS public.amostras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  atendimento_id bigint REFERENCES public.atendimentos(id) ON DELETE SET NULL,
  atendimento_exame_id bigint REFERENCES public.atendimento_exames(id) ON DELETE SET NULL,
  exame_id uuid REFERENCES public.exames_catalogo(id) ON DELETE SET NULL,
  paciente_id bigint REFERENCES public.pacientes(id) ON DELETE SET NULL,
  codigo_barra text NOT NULL,
  tipo_material text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'DISPONIVEL'
    CHECK (status IN ('DISPONIVEL','UTILIZADA','VENCIDA','DESCARTADA')),
  data_coleta timestamptz NOT NULL DEFAULT now(),
  data_validade timestamptz NOT NULL,
  localizacao text NOT NULL DEFAULT '',
  observacao text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT amostras_codigo_barra_tenant_unique UNIQUE (tenant_id, codigo_barra)
);

-- 2) Índices de performance
CREATE INDEX IF NOT EXISTS idx_amostras_atex
  ON public.amostras(atendimento_exame_id);
CREATE INDEX IF NOT EXISTS idx_amostras_status
  ON public.amostras(status);
CREATE INDEX IF NOT EXISTS idx_amostras_validade
  ON public.amostras(data_validade);
CREATE INDEX IF NOT EXISTS idx_amostras_paciente_exame
  ON public.amostras(tenant_id, paciente_id, exame_id, status);
CREATE INDEX IF NOT EXISTS idx_amostras_tenant
  ON public.amostras(tenant_id);

-- 3) Colunas ADITIVAS em atendimento_exames (não alteram nada existente)
ALTER TABLE public.atendimento_exames
  ADD COLUMN IF NOT EXISTS amostra_id uuid REFERENCES public.amostras(id) ON DELETE SET NULL;

ALTER TABLE public.atendimento_exames
  ADD COLUMN IF NOT EXISTS is_reutilizacao boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_atex_amostra
  ON public.atendimento_exames(amostra_id);

-- 4) Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_amostras_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS amostras_updated_at ON public.amostras;
CREATE TRIGGER amostras_updated_at
  BEFORE UPDATE ON public.amostras
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_amostras_updated_at();

-- 5) Função para marcar amostras vencidas (job)
CREATE OR REPLACE FUNCTION public.marcar_amostras_vencidas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.amostras
     SET status = 'VENCIDA'
   WHERE status = 'DISPONIVEL'
     AND data_validade < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 6) RLS
ALTER TABLE public.amostras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS amostras_select ON public.amostras;
CREATE POLICY amostras_select
  ON public.amostras
  FOR SELECT
  TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR (tenant_id = current_tenant_id()
        AND (has_permission(auth.uid(), 'visualizar_atendimentos')
             OR has_permission(auth.uid(), 'registrar_coleta')
             OR has_permission(auth.uid(), 'analisar_amostra')))
  );

DROP POLICY IF EXISTS amostras_insert ON public.amostras;
CREATE POLICY amostras_insert
  ON public.amostras
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND (has_permission(auth.uid(), 'registrar_coleta')
         OR has_permission(auth.uid(), 'editar_atendimento')
         OR has_permission(auth.uid(), 'criar_atendimento')
         OR has_role(auth.uid(), 'admin'::app_role))
  );

DROP POLICY IF EXISTS amostras_update ON public.amostras;
CREATE POLICY amostras_update
  ON public.amostras
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id = current_tenant_id()
    AND (has_permission(auth.uid(), 'registrar_coleta')
         OR has_permission(auth.uid(), 'editar_atendimento')
         OR has_permission(auth.uid(), 'analisar_amostra')
         OR has_role(auth.uid(), 'admin'::app_role))
  )
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND (has_permission(auth.uid(), 'registrar_coleta')
         OR has_permission(auth.uid(), 'editar_atendimento')
         OR has_permission(auth.uid(), 'analisar_amostra')
         OR has_role(auth.uid(), 'admin'::app_role))
  );

DROP POLICY IF EXISTS amostras_delete ON public.amostras;
CREATE POLICY amostras_delete
  ON public.amostras
  FOR DELETE
  TO authenticated
  USING (
    tenant_id = current_tenant_id()
    AND has_role(auth.uid(), 'admin'::app_role)
  );