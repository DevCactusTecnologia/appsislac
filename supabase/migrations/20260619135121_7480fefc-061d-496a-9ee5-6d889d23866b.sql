-- Fase 9 — Estorno formal
-- DOWN: DROP TABLE financeiro_estornos CASCADE; DROP FUNCTION financeiro_estornar; DROP FUNCTION block_delete_use_estorno CASCADE;

-- 1) Tabela financeiro_estornos
CREATE TABLE public.financeiro_estornos (
  id bigserial PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  origem_tipo text NOT NULL CHECK (origem_tipo IN ('pagamento','fatura','saida')),
  origem_id bigint NOT NULL,
  motivo text NOT NULL CHECK (length(btrim(motivo)) > 0),
  valor numeric(14,2) NOT NULL,
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fin_estornos_tenant ON public.financeiro_estornos(tenant_id, criado_em DESC);
CREATE INDEX idx_fin_estornos_origem ON public.financeiro_estornos(tenant_id, origem_tipo, origem_id);

-- 2) GRANTs
GRANT SELECT, INSERT ON public.financeiro_estornos TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.financeiro_estornos_id_seq TO authenticated;
GRANT ALL ON public.financeiro_estornos TO service_role;
GRANT ALL ON SEQUENCE public.financeiro_estornos_id_seq TO service_role;

-- 3) RLS
ALTER TABLE public.financeiro_estornos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estornos_select" ON public.financeiro_estornos
  FOR SELECT TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR (tenant_id = current_tenant_id() AND (
      has_permission(auth.uid(), 'visualizar_financeiro')
      OR has_permission(auth.uid(), 'gestao_financeira')
    ))
  );

CREATE POLICY "estornos_insert" ON public.financeiro_estornos
  FOR INSERT TO authenticated
  WITH CHECK (
    is_super_admin(auth.uid())
    OR (tenant_id = current_tenant_id() AND has_permission(auth.uid(), 'gestao_financeira'))
  );

CREATE POLICY "estornos_no_update" ON public.financeiro_estornos
  FOR UPDATE TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "estornos_no_delete" ON public.financeiro_estornos
  FOR DELETE TO authenticated
  USING (is_super_admin(auth.uid()));

-- updated_at trigger
CREATE TRIGGER trg_fin_estornos_updated_at
  BEFORE UPDATE ON public.financeiro_estornos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Marca deploy_ts em app_settings para todos os tenants existentes
INSERT INTO public.app_settings (tenant_id, key, value)
SELECT t.id, 'financeiro_estorno_deploy_ts', to_jsonb(now())
FROM public.tenants t
ON CONFLICT (tenant_id, key) DO NOTHING;

-- 5) Função guard genérica: bloqueia DELETE de registros pós-deploy
CREATE OR REPLACE FUNCTION public.block_delete_use_estorno()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_created timestamptz;
  v_deploy_ts timestamptz;
BEGIN
  -- Super admin pode tudo (regra geral do projeto não dá exceção, mas mantemos consistência)
  -- Plan: "Super_admin segue regra geral (sem exceção)" → não liberamos.
  v_tenant := OLD.tenant_id;
  v_created := OLD.created_at;

  SELECT (value #>> '{}')::timestamptz INTO v_deploy_ts
  FROM public.app_settings
  WHERE tenant_id = v_tenant AND key = 'financeiro_estorno_deploy_ts';

  -- Sem cutoff configurado → bloqueia (regra estrita p/ tenants novos)
  IF v_deploy_ts IS NULL THEN
    RAISE EXCEPTION 'Use estorno: DELETE bloqueado em %.', TG_TABLE_NAME
      USING ERRCODE = 'check_violation';
  END IF;

  -- Registros antigos (pré-deploy) podem ser deletados por compatibilidade
  IF v_created IS NOT NULL AND v_created < v_deploy_ts THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'Use estorno: DELETE bloqueado em % para registros pós-deploy.', TG_TABLE_NAME
    USING ERRCODE = 'check_violation';
END;
$$;

-- 6) Triggers BEFORE DELETE
DROP TRIGGER IF EXISTS trg_block_delete_pagamentos ON public.atendimento_pagamentos;
CREATE TRIGGER trg_block_delete_pagamentos
  BEFORE DELETE ON public.atendimento_pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.block_delete_use_estorno();

DROP TRIGGER IF EXISTS trg_block_delete_faturas ON public.convenio_faturas;
CREATE TRIGGER trg_block_delete_faturas
  BEFORE DELETE ON public.convenio_faturas
  FOR EACH ROW EXECUTE FUNCTION public.block_delete_use_estorno();

DROP TRIGGER IF EXISTS trg_block_delete_saidas ON public.financeiro_saidas;
CREATE TRIGGER trg_block_delete_saidas
  BEFORE DELETE ON public.financeiro_saidas
  FOR EACH ROW EXECUTE FUNCTION public.block_delete_use_estorno();

-- 7) RPC financeiro_estornar — registra estorno e cancela o registro de origem
CREATE OR REPLACE FUNCTION public.financeiro_estornar(
  p_tipo text,
  p_id bigint,
  p_motivo text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_valor numeric(14,2);
  v_user uuid := auth.uid();
  v_estorno_id bigint;
BEGIN
  IF p_tipo NOT IN ('pagamento','fatura','saida') THEN
    RAISE EXCEPTION 'Tipo inválido: %', p_tipo;
  END IF;

  IF p_motivo IS NULL OR length(btrim(p_motivo)) = 0 THEN
    RAISE EXCEPTION 'Motivo do estorno é obrigatório';
  END IF;

  -- Permissão: super admin OU gestao_financeira no tenant atual
  IF NOT (is_super_admin(v_user) OR has_permission(v_user, 'gestao_financeira')) THEN
    RAISE EXCEPTION 'Sem permissão para estornar';
  END IF;

  IF p_tipo = 'pagamento' THEN
    SELECT tenant_id, valor INTO v_tenant, v_valor
    FROM public.atendimento_pagamentos WHERE id = p_id;
    IF v_tenant IS NULL THEN RAISE EXCEPTION 'Pagamento % não encontrado', p_id; END IF;
    IF NOT is_super_admin(v_user) AND v_tenant <> current_tenant_id() THEN
      RAISE EXCEPTION 'Pagamento de outro tenant';
    END IF;
    UPDATE public.atendimento_pagamentos
       SET status_pagamento = 'estornado', updated_at = now()
     WHERE id = p_id;

  ELSIF p_tipo = 'fatura' THEN
    SELECT tenant_id, COALESCE(valor_total, 0) INTO v_tenant, v_valor
    FROM public.convenio_faturas WHERE id = p_id;
    IF v_tenant IS NULL THEN RAISE EXCEPTION 'Fatura % não encontrada', p_id; END IF;
    IF NOT is_super_admin(v_user) AND v_tenant <> current_tenant_id() THEN
      RAISE EXCEPTION 'Fatura de outro tenant';
    END IF;
    UPDATE public.convenio_faturas
       SET status = 'cancelada', updated_at = now()
     WHERE id = p_id;

  ELSIF p_tipo = 'saida' THEN
    SELECT tenant_id, valor INTO v_tenant, v_valor
    FROM public.financeiro_saidas WHERE id = p_id;
    IF v_tenant IS NULL THEN RAISE EXCEPTION 'Saída % não encontrada', p_id; END IF;
    IF NOT is_super_admin(v_user) AND v_tenant <> current_tenant_id() THEN
      RAISE EXCEPTION 'Saída de outro tenant';
    END IF;
    UPDATE public.financeiro_saidas
       SET status = 'cancelada', foi_pago = false, updated_at = now()
     WHERE id = p_id;
  END IF;

  INSERT INTO public.financeiro_estornos
    (tenant_id, origem_tipo, origem_id, motivo, valor, criado_por)
  VALUES
    (v_tenant, p_tipo, p_id, btrim(p_motivo), COALESCE(v_valor, 0), v_user)
  RETURNING id INTO v_estorno_id;

  RETURN v_estorno_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.financeiro_estornar(text, bigint, text) TO authenticated;