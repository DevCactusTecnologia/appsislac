
-- ============================================================
-- Forwarder genérico: dicionários legados → select_options
-- ============================================================
-- TG_ARGV[0] = categoria alvo em select_options.

CREATE OR REPLACE FUNCTION public.fwd_legacy_dict_to_select_options()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cat     text  := TG_ARGV[0];
  j_new     jsonb := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  j_old     jsonb := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  v_tenant  uuid;
  v_nome    text;
  v_ordem   int;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_tenant := (j_old ->> 'tenant_id')::uuid;
    v_nome   := j_old ->> 'nome';
    DELETE FROM public.select_options
     WHERE categoria = v_cat
       AND valor     = v_nome
       AND tenant_id IS NOT DISTINCT FROM v_tenant;
    RETURN OLD;
  END IF;

  v_tenant := (j_new ->> 'tenant_id')::uuid;
  v_nome   := j_new ->> 'nome';
  v_ordem  := COALESCE(NULLIF(j_new ->> 'ordem','')::int, 0);

  IF TG_OP = 'UPDATE' THEN
    -- Se renomeou, apaga a linha antiga em select_options para não duplicar.
    IF (j_old ->> 'nome') IS DISTINCT FROM v_nome THEN
      DELETE FROM public.select_options
       WHERE categoria = v_cat
         AND valor     = (j_old ->> 'nome')
         AND tenant_id IS NOT DISTINCT FROM v_tenant;
    END IF;
  END IF;

  -- Upsert lógico (sem unique constraint): tenta UPDATE; se 0 linhas, INSERT.
  UPDATE public.select_options
     SET label      = v_nome,
         ordem      = v_ordem,
         ativo      = COALESCE((j_new ->> 'ativo')::boolean, true),
         sistema    = COALESCE((j_new ->> 'sistema')::boolean, false),
         updated_at = now()
   WHERE categoria = v_cat
     AND valor     = v_nome
     AND tenant_id IS NOT DISTINCT FROM v_tenant;

  IF NOT FOUND THEN
    INSERT INTO public.select_options
      (tenant_id, categoria, valor, label, ordem, ativo, sistema, created_at, updated_at)
    VALUES (
      v_tenant, v_cat, v_nome, v_nome, v_ordem,
      COALESCE((j_new ->> 'ativo')::boolean, true),
      COALESCE((j_new ->> 'sistema')::boolean, false),
      now(), now()
    );
  END IF;

  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.fwd_legacy_dict_to_select_options() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- Triggers nas 5 tabelas legadas (INSERT/UPDATE/DELETE)
-- ============================================================

DROP TRIGGER IF EXISTS motivos_cancelamento_fwd_so          ON public.motivos_cancelamento;
DROP TRIGGER IF EXISTS recoletas_motivos_fwd_so             ON public.recoletas_motivos;
DROP TRIGGER IF EXISTS financeiro_destinos_pagamento_fwd_so ON public.financeiro_destinos_pagamento;
DROP TRIGGER IF EXISTS financeiro_formas_pagamento_fwd_so   ON public.financeiro_formas_pagamento;
DROP TRIGGER IF EXISTS financeiro_tipos_despesa_fwd_so      ON public.financeiro_tipos_despesa;

CREATE TRIGGER motivos_cancelamento_fwd_so
  AFTER INSERT OR UPDATE OR DELETE ON public.motivos_cancelamento
  FOR EACH ROW EXECUTE FUNCTION public.fwd_legacy_dict_to_select_options('motivo_cancelamento');

CREATE TRIGGER recoletas_motivos_fwd_so
  AFTER INSERT OR UPDATE OR DELETE ON public.recoletas_motivos
  FOR EACH ROW EXECUTE FUNCTION public.fwd_legacy_dict_to_select_options('recoleta_motivo');

CREATE TRIGGER financeiro_destinos_pagamento_fwd_so
  AFTER INSERT OR UPDATE OR DELETE ON public.financeiro_destinos_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.fwd_legacy_dict_to_select_options('financeiro_destino_pagamento');

CREATE TRIGGER financeiro_formas_pagamento_fwd_so
  AFTER INSERT OR UPDATE OR DELETE ON public.financeiro_formas_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.fwd_legacy_dict_to_select_options('financeiro_forma_pagamento');

CREATE TRIGGER financeiro_tipos_despesa_fwd_so
  AFTER INSERT OR UPDATE OR DELETE ON public.financeiro_tipos_despesa
  FOR EACH ROW EXECUTE FUNCTION public.fwd_legacy_dict_to_select_options('financeiro_tipo_despesa');
